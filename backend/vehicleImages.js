const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
const REQUEST_TIMEOUT_MS = 6000;
const WIKIMEDIA_HEADERS = {
  'User-Agent': 'VinFix/1.0 (local development; vehicle image lookup)',
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchQueries({ year, make, model, trim }) {
  return [
    [year, make, model, trim].filter(Boolean).join(' '),
    [make, model, year].filter(Boolean).join(' '),
    [make, model].filter(Boolean).join(' '),
  ].filter(Boolean);
}

function mapCachedVehicleImage(row, requested = {}) {
  if (!row) return null;
  return {
    year: Number.parseInt(row.year || requested.year, 10) || requested.year || null,
    make: row.make || requested.make || '',
    model: row.model || requested.model || '',
    title: row.title || [row.make, row.model].filter(Boolean).join(' '),
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    source: row.source || 'wikimedia',
    license: row.license || '',
    author: row.author || '',
    attributionUrl: row.attribution_url || '',
    confidence: row.confidence || 'medium',
    matchType: row.match_type || 'model',
    fallbackUsed: false,
  };
}

async function getCachedVehicleImage(pool, { year, make, model, trim }) {
  const exact = await pool.query(
    `SELECT *
     FROM vehicle_images
     WHERE year = $1
       AND LOWER(make) = LOWER($2)
       AND LOWER(model) = LOWER($3)
       AND COALESCE(LOWER(trim), '') = COALESCE(LOWER($4), '')
     ORDER BY updated_at DESC
     LIMIT 1`,
    [String(year || ''), make || '', model || '', trim || '']
  );

  if (exact.rows[0]) {
    return mapCachedVehicleImage(exact.rows[0], { year, make, model });
  }

  const modelResult = await pool.query(
    `SELECT *
     FROM vehicle_images
     WHERE year IS NULL
       AND LOWER(make) = LOWER($1)
       AND LOWER(model) = LOWER($2)
     ORDER BY updated_at DESC
     LIMIT 1`,
    [make || '', model || '']
  );

  return mapCachedVehicleImage(modelResult.rows[0], { year, make, model });
}

async function cacheVehicleImage(pool, image) {
  if (!image?.imageUrl && !image?.thumbnailUrl) {
    return null;
  }

  const cacheYear = image.matchType === 'year' ? String(image.year || '') : null;
  const result = await pool.query(
    `INSERT INTO vehicle_images
     (year, make, model, trim, title, image_url, thumbnail_url, source, license, author, attribution_url, confidence, match_type, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP)
     RETURNING *`,
    [
      cacheYear,
      image.make || '',
      image.model || '',
      image.trim || '',
      image.title || '',
      image.imageUrl || '',
      image.thumbnailUrl || image.imageUrl || '',
      image.source || 'wikimedia',
      image.license || '',
      image.author || '',
      image.attributionUrl || '',
      image.confidence || 'medium',
      image.matchType || 'model',
    ]
  );

  return mapCachedVehicleImage(result.rows[0], image);
}

function normalizeVehicleImageResult({ requested, page, imageInfo }) {
  if (!page || (!page.original?.source && !page.thumbnail?.source && !imageInfo?.url)) {
    return null;
  }

  const titleText = normalizeText([page.title, page.pageimage].filter(Boolean).join(' '));
  const requestedYear = String(requested.year || '');
  const hasYearInTitle = requestedYear && titleText.includes(requestedYear);
  const metadata = imageInfo?.metadata || {};

  return {
    year: Number.parseInt(String(requested.year || ''), 10) || requested.year || null,
    make: requested.make,
    model: requested.model,
    trim: requested.trim || '',
    title: page.title || `${requested.make} ${requested.model}`,
    imageUrl: imageInfo?.url || page.original?.source || page.thumbnail?.source || '',
    thumbnailUrl: imageInfo?.thumburl || page.thumbnail?.source || imageInfo?.url || page.original?.source || '',
    source: 'wikimedia',
    license: metadata.LicenseShortName?.value || metadata.UsageTerms?.value || '',
    author: metadata.Artist?.value?.replace(/<[^>]+>/g, '').trim() || '',
    attributionUrl: metadata.Credit?.value?.match(/href="([^"]+)"/)?.[1] || page.fullurl || '',
    confidence: hasYearInTitle ? 'high' : 'medium',
    matchType: hasYearInTitle ? 'year' : 'model',
    fallbackUsed: !hasYearInTitle,
  };
}

async function lookupImageInfoFromCommons(axios, fileName) {
  if (!fileName) {
    return null;
  }

  const title = fileName.startsWith('File:') ? fileName : `File:${fileName}`;
  const response = await axios.get(COMMONS_API_URL, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: WIKIMEDIA_HEADERS,
    params: {
      action: 'query',
      format: 'json',
      origin: '*',
      titles: title,
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: 900,
    },
  });

  const pages = response.data?.query?.pages || {};
  const imageInfo = Object.values(pages)[0]?.imageinfo?.[0];
  if (!imageInfo) {
    return null;
  }

  return {
    url: imageInfo.url,
    thumburl: imageInfo.thumburl,
    metadata: imageInfo.extmetadata || {},
  };
}

async function lookupVehicleImageFromWikimedia(axios, { year, make, model, trim }) {
  const requested = { year, make, model, trim };

  for (const query of buildSearchQueries(requested)) {
    try {
      const response = await axios.get(WIKIPEDIA_API_URL, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: WIKIMEDIA_HEADERS,
        params: {
          action: 'query',
          format: 'json',
          origin: '*',
          generator: 'search',
          gsrsearch: query,
          gsrlimit: 5,
          prop: 'pageimages|info',
          piprop: 'original|thumbnail',
          pithumbsize: 900,
          inprop: 'url',
        },
      });

      const pages = Object.values(response.data?.query?.pages || {}).sort(
        (a, b) => (a.index || 0) - (b.index || 0)
      );
      const page = pages.find((item) => item.pageimage || item.original?.source || item.thumbnail?.source);

      if (!page) {
        continue;
      }

      let imageInfo = null;
      try {
        imageInfo = await lookupImageInfoFromCommons(axios, page.pageimage);
      } catch (error) {
        console.warn('Commons imageinfo lookup failed:', error.message);
      }

      const normalized = normalizeVehicleImageResult({ requested, page, imageInfo });
      if (normalized) {
        return normalized;
      }
    } catch (error) {
      console.warn(`Wikimedia vehicle image lookup failed for "${query}":`, error.message);
    }
  }

  return null;
}

async function getVehicleImage(pool, axios, vehicle) {
  const cached = await getCachedVehicleImage(pool, vehicle);
  if (cached) {
    return cached;
  }

  const image = await lookupVehicleImageFromWikimedia(axios, vehicle);
  if (!image) {
    return null;
  }

  return cacheVehicleImage(pool, image);
}

module.exports = {
  getVehicleImage,
  lookupVehicleImageFromWikimedia,
  normalizeVehicleImageResult,
  cacheVehicleImage,
  getCachedVehicleImage,
};
