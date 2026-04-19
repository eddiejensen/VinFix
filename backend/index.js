let dotenvLoaded = false;

try {
  require('dotenv').config();
  dotenvLoaded = true;
} catch (error) {
  console.warn('dotenv is not installed, falling back to a simple .env loader.');
}

const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

if (!dotenvLoaded) {
  const envPath = path.join(__dirname, '.env');

  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');

    envFile.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
        return;
      }

      const [key, ...rest] = trimmed.split('=');
      const value = rest.join('=').trim();

      if (key && !process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    });
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const CURRENT_YEAR = 2026;
const MIN_YEAR = 1996;
const YEARS = Array.from({ length: CURRENT_YEAR - MIN_YEAR + 1 }, (_, i) =>
  String(CURRENT_YEAR - i)
);

const PASSENGER_VEHICLE_MAKES = [
  'ACURA',
  'ALFA ROMEO',
  'AUDI',
  'BMW',
  'BUICK',
  'CADILLAC',
  'CHEVROLET',
  'CHRYSLER',
  'DODGE',
  'FIAT',
  'FORD',
  'GENESIS',
  'GMC',
  'HONDA',
  'HYUNDAI',
  'INFINITI',
  'JAGUAR',
  'JEEP',
  'KIA',
  'LAND ROVER',
  'LEXUS',
  'LINCOLN',
  'MAZDA',
  'MERCEDES-BENZ',
  'MERCURY',
  'MINI',
  'MITSUBISHI',
  'NISSAN',
  'OLDSMOBILE',
  'PLYMOUTH',
  'PONTIAC',
  'PORSCHE',
  'RAM',
  'SAAB',
  'SATURN',
  'SCION',
  'SMART',
  'SUBARU',
  'SUZUKI',
  'TESLA',
  'TOYOTA',
  'VOLKSWAGEN',
  'VOLVO',
];

const MAKES_BY_YEAR_CACHE = new Map();

const FITMENT_OPTIONS = {
  '2004|CHEVROLET|SUBURBAN': {
    drivetrains: ['2WD', '4WD'],
    engines: ['5.3L V8', '6.0L V8', '8.1L V8'],
  },
  '2004|HONDA|ACCORD': {
    drivetrains: ['FWD'],
    engines: ['2.4L I4', '3.0L V6'],
  },
  '2004|HONDA|CR-V': {
    drivetrains: ['FWD', 'AWD'],
    engines: ['2.4L I4'],
  },
  '2004|FORD|F-150': {
    drivetrains: ['2WD', '4WD'],
    engines: ['4.2L V6', '4.6L V8', '5.4L V8'],
  },
  '*|CHEVROLET|EQUINOX': {
    drivetrains: ['FWD', 'AWD'],
    engines: ['1.5L I4 Turbo', '2.0L I4 Turbo'],
  },
  '*|CHEVROLET|MALIBU': {
    drivetrains: ['FWD'],
    engines: ['1.5L I4 Turbo', '2.0L I4 Turbo'],
  },
  '*|CHEVROLET|SILVERADO 1500': {
    drivetrains: ['2WD', '4WD'],
    engines: ['2.7L I4 Turbo', '5.3L V8', '6.2L V8'],
  },
  '*|FORD|ESCAPE': {
    drivetrains: ['FWD', 'AWD'],
    engines: ['1.5L I3 Turbo', '2.0L I4 Turbo', '2.5L Hybrid'],
  },
  '*|FORD|EXPLORER': {
    drivetrains: ['RWD', '4WD'],
    engines: ['2.3L I4 Turbo', '3.0L V6 Turbo'],
  },
  '*|FORD|F-150': {
    drivetrains: ['2WD', '4WD'],
    engines: ['2.7L V6 Turbo', '3.5L V6 Turbo', '5.0L V8'],
  },
  '*|HONDA|ACCORD': {
    drivetrains: ['FWD'],
    engines: ['1.5L I4 Turbo', '2.0L I4 Turbo', '2.0L Hybrid'],
  },
  '*|HONDA|CIVIC': {
    drivetrains: ['FWD'],
    engines: ['2.0L I4', '1.5L I4 Turbo'],
  },
  '*|HONDA|CR-V': {
    drivetrains: ['FWD', 'AWD'],
    engines: ['1.5L I4 Turbo', '2.0L Hybrid'],
  },
  '*|HONDA|ODYSSEY': {
    drivetrains: ['FWD'],
    engines: ['3.5L V6'],
  },
  '*|HONDA|PILOT': {
    drivetrains: ['FWD', 'AWD'],
    engines: ['3.5L V6'],
  },
  '*|HYUNDAI|SANTA FE': {
    drivetrains: ['FWD', 'AWD'],
    engines: ['2.5L I4', '2.5L I4 Turbo', '1.6L Hybrid'],
  },
  '*|HYUNDAI|SONATA': {
    drivetrains: ['FWD'],
    engines: ['2.5L I4', '1.6L I4 Turbo', '2.0L Hybrid'],
  },
  '*|JEEP|GRAND CHEROKEE': {
    drivetrains: ['RWD', '4WD'],
    engines: ['3.6L V6', '5.7L V8'],
  },
  '*|JEEP|WRANGLER': {
    drivetrains: ['4WD'],
    engines: ['3.6L V6', '2.0L I4 Turbo'],
  },
  '*|NISSAN|ALTIMA': {
    drivetrains: ['FWD', 'AWD'],
    engines: ['2.5L I4', '2.0L I4 Turbo'],
  },
  '*|NISSAN|ROGUE': {
    drivetrains: ['FWD', 'AWD'],
    engines: ['1.5L I3 Turbo', '2.5L I4'],
  },
  '*|SUBARU|OUTBACK': {
    drivetrains: ['AWD'],
    engines: ['2.5L H4', '2.4L Turbo H4'],
  },
  '*|TOYOTA|4RUNNER': {
    drivetrains: ['2WD', '4WD'],
    engines: ['4.0L V6'],
  },
  '*|TOYOTA|CAMRY': {
    drivetrains: ['FWD', 'AWD'],
    engines: ['2.5L I4', '3.5L V6', '2.5L Hybrid'],
  },
  '*|TOYOTA|COROLLA': {
    drivetrains: ['FWD', 'AWD'],
    engines: ['2.0L I4', '1.8L Hybrid'],
  },
  '*|TOYOTA|HIGHLANDER': {
    drivetrains: ['FWD', 'AWD'],
    engines: ['2.4L I4 Turbo', '2.5L Hybrid'],
  },
  '*|TOYOTA|RAV4': {
    drivetrains: ['FWD', 'AWD'],
    engines: ['2.5L I4', '2.5L Hybrid'],
  },
  '*|TOYOTA|TACOMA': {
    drivetrains: ['2WD', '4WD'],
    engines: ['2.7L I4', '3.5L V6', '2.4L I4 Turbo'],
  },
};

const MODEL_ALIASES = {
  'CRV': 'CR-V',
  'CR V': 'CR-V',
  'F150': 'F-150',
  'GRANDCHEROKEE': 'GRAND CHEROKEE',
  'HRV': 'HR-V',
  'RAV 4': 'RAV4',
  'SILVERADO': 'SILVERADO 1500',
};

const SCHEMATIC_DISCIPLINES = [
  'Power Distribution',
  'Starting and Charging',
  'Engine Controls',
  'Body Controls',
  'Lighting',
  'HVAC',
  'ABS and Chassis',
  'Audio and Infotainment',
  'Connectors and Grounds',
];

const SOURCE_URLS = {
  recallsSearch: 'https://www.nhtsa.gov/recalls',
  manufacturerCommunications: 'https://www.nhtsa.gov/resources-investigations-recalls',
  manufacturerCommunicationsData: 'https://www.nhtsa.gov/es/nhtsa-datasets-and-apis',
  complaintsApiDocs: 'https://www.nhtsa.gov/es/nhtsa-datasets-and-apis',
  nastfAutomakerInfo:
    'https://support.nastf.org/support/solutions/articles/43000756394-nastf-automaker-info-pages',
  motorWiringDiagrams:
    'https://www.motor.com/products-services/data-products/wiring-diagrams/',
  alldataWiringDiagrams: 'https://www.alldata.com/eu/en/OEM-Wiring-Diagrams',
};

const PARTS_CATALOG = [
  'Body & Lamp Assembly',
  'Brake & Wheel Hub',
  'Belt Drive',
  'Cooling System',
  'Electrical',
  'Engine',
  'Exhaust & Emission',
  'Fuel & Air',
  'Heating & Air Conditioning',
  'Ignition',
  'Interior',
  'Steering',
  'Suspension',
  'Transmission',
  'Wiper & Washer',
];

function sortStrings(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function normalizeText(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeModel(value) {
  const normalized = normalizeText(value)
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ');

  return MODEL_ALIASES[normalized] || normalized;
}

function canonicalizeModel(value) {
  return normalizeModel(value).replace(/[^A-Z0-9]/g, '');
}

function getField(item, names) {
  for (const name of names) {
    if (item && item[name] !== undefined && item[name] !== null && item[name] !== '') {
      return item[name];
    }
  }

  return null;
}

function buildVehicleLabel(year, make, model) {
  return `${year} ${make} ${model}`;
}

function buildRecallSourceUrl(campaignNumber) {
  return `https://www.nhtsa.gov/recalls?nhtsaid=${encodeURIComponent(campaignNumber)}`;
}

function buildComplaintSourceUrl(odiNumber) {
  return `https://api.nhtsa.gov/complaints/odinumber?odinumber=${encodeURIComponent(
    odiNumber
  )}`;
}

function parseInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseMoney(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseBooleanOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true' || value === 'yes') {
    return true;
  }

  if (value === 'false' || value === 'no') {
    return false;
  }

  return null;
}

function resolveFitmentOptions(year, make, model) {
  const normalizedYear = normalizeText(year);
  const normalizedMake = normalizeText(make);
  const normalizedModel = normalizeModel(model);
  const specificKey = `${normalizedYear}|${normalizedMake}|${normalizedModel}`;
  const genericKey = `*|${normalizedMake}|${normalizedModel}`;

  if (FITMENT_OPTIONS[specificKey]) {
    return FITMENT_OPTIONS[specificKey];
  }

  if (FITMENT_OPTIONS[genericKey]) {
    return FITMENT_OPTIONS[genericKey];
  }

  const requestedCanonicalModel = canonicalizeModel(normalizedModel);

  const matchingEntry = Object.entries(FITMENT_OPTIONS).find(([key]) => {
    const [entryYear, entryMake, entryModel] = key.split('|');
    const canonicalEntryModel = canonicalizeModel(entryModel);
    const yearMatches = entryYear === '*' || entryYear === normalizedYear;
    const makeMatches = entryMake === normalizedMake;
    const modelMatches =
      requestedCanonicalModel === canonicalEntryModel ||
      requestedCanonicalModel.startsWith(canonicalEntryModel) ||
      canonicalEntryModel.startsWith(requestedCanonicalModel);

    return yearMatches && makeMatches && modelMatches;
  });

  return matchingEntry ? matchingEntry[1] : { drivetrains: [], engines: [] };
}

async function fetchModelsForMakeYear(make, year) {
  const response = await axios.get(
    `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(
      make
    )}/modelyear/${encodeURIComponent(year)}?format=json`
  );

  return sortStrings(
    Array.from(
      new Set(
        (response.data.Results || [])
          .map((item) => item.Model_Name)
          .filter(Boolean)
      )
    )
  );
}

async function getYearAwareMakes(year) {
  const cacheKey = String(year);

  if (MAKES_BY_YEAR_CACHE.has(cacheKey)) {
    return MAKES_BY_YEAR_CACHE.get(cacheKey);
  }

  const matches = [];
  const batchSize = 6;

  for (let i = 0; i < PASSENGER_VEHICLE_MAKES.length; i += batchSize) {
    const batch = PASSENGER_VEHICLE_MAKES.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (make) => {
        try {
          const models = await fetchModelsForMakeYear(make, cacheKey);
          return models.length > 0 ? make : null;
        } catch (error) {
          console.error(`Make probe failed for ${make} ${cacheKey}:`, error.message);
          return null;
        }
      })
    );

    results.filter(Boolean).forEach((make) => matches.push(make));
  }

  const makes =
    matches.length > 0
      ? sortStrings(Array.from(new Set(matches)))
      : sortStrings(PASSENGER_VEHICLE_MAKES);

  MAKES_BY_YEAR_CACHE.set(cacheKey, makes);
  return makes;
}

function buildTsbResources(year, make, model) {
  const vehicleLabel = buildVehicleLabel(year, make, model);

  return [
    {
      id: 'nhtsa-recalls-search',
      title: 'NHTSA safety issues search',
      summary: `NHTSA says recalls, complaints, investigations, and manufacturer communications for ${vehicleLabel} can be reviewed from its recalls search experience.`,
      sourceName: 'NHTSA Recalls',
      sourceUrl: SOURCE_URLS.recallsSearch,
    },
    {
      id: 'nhtsa-manufacturer-communications',
      title: 'Manufacturer communications and bulletin resources',
      summary:
        'NHTSA states that manufacturer communications, including bulletins and notices, are available through its manufacturer communications resources.',
      sourceName: 'NHTSA Manufacturer Communications',
      sourceUrl: SOURCE_URLS.manufacturerCommunications,
    },
    {
      id: 'nhtsa-manufacturer-communications-data',
      title: 'NHTSA manufacturer communications datasets',
      summary:
        'NHTSA publishes manufacturer communications downloads and TSBS metadata in its datasets and APIs catalog.',
      sourceName: 'NHTSA Datasets and APIs',
      sourceUrl: SOURCE_URLS.manufacturerCommunicationsData,
    },
  ];
}

function buildSchematicResources(year, make, model, discipline) {
  const vehicleLabel = buildVehicleLabel(year, make, model);

  return [
    {
      id: 'nastf-automaker-info',
      title: `${discipline} service information via automaker info pages`,
      summary: `NASTF provides automaker information pages that point repairers to OEM service information sources for ${vehicleLabel}.`,
      sourceName: 'NASTF Automaker Info Pages',
      sourceUrl: SOURCE_URLS.nastfAutomakerInfo,
      access: 'Usually leads to OEM service information and subscription pages',
    },
    {
      id: 'motor-wiring-diagrams',
      title: `${discipline} diagrams from MOTOR`,
      summary:
        'MOTOR advertises OEM-based wiring diagrams covering power distribution, connectors, grounds, lighting, and control modules.',
      sourceName: 'MOTOR Wiring Diagrams',
      sourceUrl: SOURCE_URLS.motorWiringDiagrams,
      access: 'Licensed product',
    },
    {
      id: 'alldata-wiring-diagrams',
      title: `${discipline} diagrams from ALLDATA`,
      summary:
        'ALLDATA says its wiring diagrams come directly from OEM source material and include connector views and technical drawings.',
      sourceName: 'ALLDATA OEM Wiring Diagrams',
      sourceUrl: SOURCE_URLS.alldataWiringDiagrams,
      access: 'Licensed product',
    },
  ];
}

function buildVehiclePartsSearchQuery({
  year,
  make,
  model,
  engine,
  drivetrain,
  partTitle,
  partLabel,
}) {
  return [
    year,
    make,
    model,
    drivetrain || null,
    engine || null,
    partTitle,
    partLabel,
  ]
    .filter(Boolean)
    .join(' ');
}

function slugifyRockAutoSegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/%/g, ' percent ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '%2B');
}

function buildPartsData(make, model, year, options = {}) {
  const { engine = '', drivetrain = '' } = options;
  const rockAutoVehicleUrl = `https://www.rockauto.com/en/catalog/${slugifyRockAutoSegment(
    make
  )}%2C${encodeURIComponent(year)}%2C${slugifyRockAutoSegment(model)}`;

  return PARTS_CATALOG.map((category) => {
    const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const categoryHint = buildVehiclePartsSearchQuery({
      year,
      make,
      model,
      engine,
      drivetrain,
      partTitle: category,
    });

    return {
      slug,
      title: category,
      category: 'RockAuto Category',
      fitmentContext: {
        year,
        make,
        model,
        drivetrain: drivetrain || null,
        engine: engine || null,
      },
      rockAutoVehicleUrl,
      searchHint: categoryHint,
      searchUrl: rockAutoVehicleUrl,
      oe: {
        url: rockAutoVehicleUrl,
      },
    };
  });
}

function getResponseText(responseData) {
  if (typeof responseData.output_text === 'string' && responseData.output_text.trim()) {
    return responseData.output_text.trim();
  }

  const output = Array.isArray(responseData.output) ? responseData.output : [];

  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const chunk of content) {
      if (typeof chunk.text === 'string' && chunk.text.trim()) {
        return chunk.text.trim();
      }
    }
  }

  return null;
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      vin TEXT UNIQUE,
      make TEXT,
      manufacturer TEXT,
      model TEXT,
      year TEXT,
      series TEXT,
      trim TEXT,
      body_class TEXT,
      vehicle_type TEXT,
      plant_city TEXT,
      plant_state TEXT,
      plant_country TEXT,
      drivetrain TEXT,
      engine TEXT,
      zip_code TEXT,
      purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      current_kbb_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_kbb_value NUMERIC(12,2) NOT NULL DEFAULT 0;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS repair_history_entries (
      id SERIAL PRIMARY KEY,
      vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      entry_type TEXT NOT NULL DEFAULT 'repair',
      service_date DATE,
      mileage INT,
      problem_symptom TEXT,
      suspected_cause TEXT,
      repair_performed TEXT,
      parts_used TEXT,
      labor_notes TEXT,
      parts_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      labor_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      fixed_issue BOOLEAN,
      follow_up_repair TEXT,
      actual_fix_later TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicle_todo_items (
      id SERIAL PRIMARY KEY,
      vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL DEFAULT 'maintenance',
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date DATE,
      target_mileage INT,
      estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getRepairHistoryByVehicle(vehicleId) {
  const result = await pool.query(
    `SELECT * FROM repair_history_entries
     WHERE vehicle_id = $1
     ORDER BY COALESCE(service_date, created_at) DESC, id DESC`,
    [vehicleId]
  );

  return result.rows;
}

async function getTodoItemsByVehicle(vehicleId) {
  const result = await pool.query(
    `SELECT * FROM vehicle_todo_items
     WHERE vehicle_id = $1
     ORDER BY
       CASE status
         WHEN 'open' THEN 0
         WHEN 'in progress' THEN 1
         WHEN 'completed' THEN 2
         ELSE 3
       END,
       CASE priority
         WHEN 'high' THEN 0
         WHEN 'medium' THEN 1
         WHEN 'low' THEN 2
         ELSE 3
       END,
       COALESCE(due_date, CURRENT_DATE + INTERVAL '100 years') ASC,
       id DESC`,
    [vehicleId]
  );

  return result.rows;
}

function buildKbbValueUrl(vehicle = {}) {
  return 'https://www.kbb.com/whats-my-car-worth/';
}

function buildCostSummary(vehicle, historyEntries, todoItems) {
  const repairEntries = historyEntries.filter((entry) => entry.entry_type === 'repair');
  const maintenanceEntries = historyEntries.filter((entry) => entry.entry_type === 'maintenance');

  const partsSpent = historyEntries.reduce(
    (sum, entry) => sum + Number.parseFloat(entry.parts_cost || 0),
    0
  );
  const laborSpent = historyEntries.reduce(
    (sum, entry) => sum + Number.parseFloat(entry.labor_cost || 0),
    0
  );
  const repairSpent = repairEntries.reduce(
    (sum, entry) => sum + Number.parseFloat(entry.total_cost || 0),
    0
  );
  const maintenanceSpent = maintenanceEntries.reduce(
    (sum, entry) => sum + Number.parseFloat(entry.total_cost || 0),
    0
  );
  const recentRepairCosts = repairEntries
    .slice(0, 5)
    .reduce((sum, entry) => sum + Number.parseFloat(entry.total_cost || 0), 0);
  const openTodoEstimatedTotal = todoItems
    .filter((item) => item.status !== 'completed')
    .reduce((sum, item) => sum + Number.parseFloat(item.estimated_cost || 0), 0);
  const purchasePrice = Number.parseFloat(vehicle?.purchase_price || 0) || 0;
  const currentKbbValue = Number.parseFloat(vehicle?.current_kbb_value || 0) || 0;
  const totalInvested = purchasePrice + partsSpent + laborSpent;
  const totalIntoVehicle = purchasePrice + repairSpent + maintenanceSpent;

  return {
    purchasePrice,
    currentKbbValue,
    partsSpent,
    laborSpent,
    repairSpent,
    maintenanceSpent,
    recentRepairCosts,
    openTodoEstimatedTotal,
    totalInvested,
    totalIntoVehicle,
    equityVsKbb: currentKbbValue - totalInvested,
    kbbValueUrl: buildKbbValueUrl(vehicle),
  };
}

function buildDiagnosticContext(historyEntries) {
  const unresolvedRepairs = historyEntries
    .filter((entry) => entry.fixed_issue === false)
    .slice(0, 5)
    .map((entry) => ({
      id: entry.id,
      problemSymptom: entry.problem_symptom,
      attemptedRepair: entry.repair_performed,
      actualFixLater: entry.actual_fix_later,
      followUpRepair: entry.follow_up_repair,
      serviceDate: entry.service_date,
    }));

  const repeatedSymptomsMap = historyEntries.reduce((acc, entry) => {
    const key = (entry.problem_symptom || '').trim().toLowerCase();

    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = {
        symptom: entry.problem_symptom,
        count: 0,
        attemptedRepairs: [],
      };
    }

    acc[key].count += 1;

    if (
      entry.repair_performed &&
      !acc[key].attemptedRepairs.includes(entry.repair_performed) &&
      acc[key].attemptedRepairs.length < 3
    ) {
      acc[key].attemptedRepairs.push(entry.repair_performed);
    }

    return acc;
  }, {});

  const repeatedSymptoms = Object.values(repeatedSymptomsMap)
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const recentParts = historyEntries
    .filter((entry) => entry.parts_used)
    .slice(0, 5)
    .map((entry) => ({
      id: entry.id,
      partsUsed: entry.parts_used,
      repairPerformed: entry.repair_performed,
      serviceDate: entry.service_date,
    }));

  return {
    unresolvedRepairs,
    repeatedSymptoms,
    recentParts,
  };
}

app.get('/', (req, res) => {
  res.send('Auto Fix Help API running');
});

app.get('/years', (req, res) => {
  res.json(YEARS);
});

app.get('/makes', async (req, res) => {
  const { year } = req.query;

  try {
    if (!year) {
      return res.json(sortStrings(PASSENGER_VEHICLE_MAKES));
    }

    const makes = await getYearAwareMakes(year);
    res.json(makes);
  } catch (error) {
    console.error('Makes lookup error:', error.message);
    res.status(500).json({ error: 'Failed to fetch filtered makes' });
  }
});

app.get('/models', async (req, res) => {
  const { year, make } = req.query;

  if (!year || !make) {
    return res.status(400).json({ error: 'year and make are required' });
  }

  try {
    const models = await fetchModelsForMakeYear(make, year);
    res.json(models);
  } catch (error) {
    console.error('Models lookup error:', error.message);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

app.get('/fitment-options', (req, res) => {
  const { year, make, model } = req.query;

  if (!year || !make || !model) {
    return res.status(400).json({ error: 'year, make, and model are required' });
  }

  res.json(resolveFitmentOptions(year, make, model));
});

app.get('/vin/:vin', async (req, res) => {
  const vin = req.params.vin?.trim().toUpperCase();

  try {
    const response = await axios.get(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`
    );

    const results = response.data.Results || [];

    const getValue = (name) => {
      const item = results.find((r) => r.Variable === name);
      return item && item.Value ? item.Value : null;
    };

    res.json({
      vin,
      make: getValue('Make'),
      manufacturer: getValue('Manufacturer Name'),
      model: getValue('Model'),
      year: getValue('Model Year'),
      series: getValue('Series'),
      trim: getValue('Trim'),
      bodyClass: getValue('Body Class'),
      vehicleType: getValue('Vehicle Type'),
      plantCity: getValue('Plant City'),
      plantState: getValue('Plant State'),
      plantCountry: getValue('Plant Country'),
      drivetrain: getValue('Drive Type'),
      engine: getValue('Engine Configuration'),
      zipCode: null,
    });
  } catch (error) {
    console.error('VIN lookup error:', error.message);
    res.status(500).json({ error: 'VIN lookup failed' });
  }
});

app.post('/vehicles', async (req, res) => {
  const v = req.body;

  try {
    if (v.vin) {
      const existing = await pool.query('SELECT * FROM vehicles WHERE vin = $1', [v.vin]);

      if (existing.rows.length > 0) {
        const updated = await pool.query(
          `UPDATE vehicles
           SET make = COALESCE($2, make),
               manufacturer = COALESCE($3, manufacturer),
               model = COALESCE($4, model),
               year = COALESCE($5, year),
               series = COALESCE($6, series),
               trim = COALESCE($7, trim),
               body_class = COALESCE($8, body_class),
               vehicle_type = COALESCE($9, vehicle_type),
               plant_city = COALESCE($10, plant_city),
               plant_state = COALESCE($11, plant_state),
               plant_country = COALESCE($12, plant_country),
               drivetrain = COALESCE($13, drivetrain),
               engine = COALESCE($14, engine),
               zip_code = COALESCE($15, zip_code),
               purchase_price = COALESCE($16, purchase_price),
               current_kbb_value = COALESCE($17, current_kbb_value)
           WHERE vin = $1
           RETURNING *`,
          [
            v.vin,
            v.make || null,
            v.manufacturer || null,
            v.model || null,
            v.year || null,
            v.series || null,
            v.trim || null,
            v.bodyClass || null,
            v.vehicleType || null,
            v.plantCity || null,
            v.plantState || null,
            v.plantCountry || null,
            v.drivetrain || null,
            v.engine || null,
            v.zipCode || null,
            v.purchasePrice ?? null,
            v.currentKbbValue ?? null,
          ]
        );

        return res.json(updated.rows[0]);
      }
    }

    const result = await pool.query(
      `INSERT INTO vehicles
      (vin, make, manufacturer, model, year, series, trim, body_class, vehicle_type, plant_city, plant_state, plant_country, drivetrain, engine, zip_code, purchase_price, current_kbb_value)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [
        v.vin || null,
        v.make || null,
        v.manufacturer || null,
        v.model || null,
        v.year || null,
        v.series || null,
        v.trim || null,
        v.bodyClass || null,
        v.vehicleType || null,
        v.plantCity || null,
        v.plantState || null,
        v.plantCountry || null,
        v.drivetrain || null,
        v.engine || null,
        v.zipCode || null,
        parseMoney(v.purchasePrice),
        parseMoney(v.currentKbbValue),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Database insert error:', error.message);
    res.status(500).json({ error: 'Database insert failed' });
  }
});

app.get('/vehicles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicles ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Database fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

app.patch('/vehicles/:vehicleId/financials', async (req, res) => {
  const { vehicleId } = req.params;
  const { purchasePrice, currentKbbValue } = req.body || {};

  try {
    const result = await pool.query(
      `UPDATE vehicles
       SET purchase_price = COALESCE($2, purchase_price),
           current_kbb_value = COALESCE($3, current_kbb_value)
       WHERE id = $1
       RETURNING *`,
      [vehicleId, purchasePrice === '' ? null : parseMoney(purchasePrice), currentKbbValue === '' ? null : parseMoney(currentKbbValue)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Vehicle financial update error:', error.message);
    res.status(500).json({ error: 'Failed to update vehicle financials' });
  }
});

app.get('/recalls/:make/:model/:year', async (req, res) => {
  const { make, model, year } = req.params;

  try {
    const response = await axios.get(
      `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(
        make
      )}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`
    );

    const recalls = (response.data.results || []).map((item, index) => {
      const campaignNumber = item.NHTSACampaignNumber || `NHTSA-${index}`;

      return {
        id: campaignNumber,
        campaignNumber,
        component: item.Component || 'N/A',
        summary: item.Summary || 'No summary available',
        remedy: item.Remedy || 'N/A',
        sourceName: 'NHTSA Recalls',
        sourceUrl: buildRecallSourceUrl(campaignNumber),
      };
    });

    res.json(recalls);
  } catch (error) {
    console.error('Recall lookup error:', error.message);
    res.status(500).json({ error: 'Recall lookup failed' });
  }
});

app.get('/tsbs/:make/:model/:year', async (req, res) => {
  const { make, model, year } = req.params;
  res.json(buildTsbResources(year, make, model));
});

app.get('/common-issues/:make/:model/:year', async (req, res) => {
  const { make, model, year } = req.params;

  try {
    const response = await axios.get(
      `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=${encodeURIComponent(
        make
      )}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`
    );

    const complaints = response.data.results || response.data.Results || [];

    if (!Array.isArray(complaints) || complaints.length === 0) {
      return res.json([]);
    }

    const grouped = complaints.reduce((acc, complaint) => {
      const component =
        getField(complaint, ['components', 'Components', 'Component', 'component']) ||
        'General complaints';
      const odiNumber = getField(complaint, [
        'odiNumber',
        'ODINumber',
        'odi_number',
        'ODI_NUMBER',
      ]);
      const summary =
        getField(complaint, ['summary', 'Summary', 'description', 'Description']) ||
        'No complaint summary available.';

      if (!acc[component]) {
        acc[component] = {
          component,
          count: 0,
          summaries: [],
          sourceLinks: [],
        };
      }

      acc[component].count += 1;

      if (acc[component].summaries.length < 2) {
        acc[component].summaries.push(summary);
      }

      if (odiNumber && acc[component].sourceLinks.length < 3) {
        acc[component].sourceLinks.push({
          label: `ODI ${odiNumber}`,
          url: buildComplaintSourceUrl(odiNumber),
        });
      }

      return acc;
    }, {});

    const issues = Object.values(grouped)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((issue, index) => ({
        id: `${issue.component}-${index}`,
        title: issue.component,
        complaintCount: issue.count,
        summary: issue.summaries[0],
        supportingDetail: issue.summaries[1] || null,
        sourceName: 'NHTSA Complaints API',
        sourceUrl: SOURCE_URLS.complaintsApiDocs,
        sourceLinks: issue.sourceLinks,
      }));

    res.json(issues);
  } catch (error) {
    console.error('Complaint lookup error:', error.message);
    res.status(500).json({ error: 'Common issues lookup failed' });
  }
});

app.get('/electrical-schematics/:make/:model/:year', (req, res) => {
  const { make, model, year } = req.params;
  const discipline = req.query.discipline || SCHEMATIC_DISCIPLINES[0];

  res.json({
    disciplines: SCHEMATIC_DISCIPLINES,
    selectedDiscipline: discipline,
    resources: buildSchematicResources(year, make, model, discipline),
    note:
      'Full wiring diagrams usually come from OEM or licensed service-information providers rather than a free public API.',
  });
});

app.get('/parts/:make/:model/:year', (req, res) => {
  const { make, model, year } = req.params;
  const { engine, drivetrain } = req.query;

  res.json({
    note:
      'Parts pricing here is a practical quick-compare guide with search links scoped to the selected vehicle. For real-time catalog pricing and exact fitment confirmation, a commercial fitment and pricing API would be needed.',
    parts: buildPartsData(make, model, year, {
      engine: typeof engine === 'string' ? engine : '',
      drivetrain: typeof drivetrain === 'string' ? drivetrain : '',
    }),
  });
});

app.post('/ai-diagnostic-chat', async (req, res) => {
  const { vehicle, message, repairHistory, todoItems, diagnosticContext } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({
      error:
        'OPENAI_API_KEY is not configured on the backend. Put OPENAI_API_KEY=your_key in backend/.env or export it in the same terminal before starting node index.js.',
    });
  }

  if (!message || !vehicle?.make || !vehicle?.model || !vehicle?.year) {
    return res.status(400).json({
      error: 'vehicle and message are required',
    });
  }

  try {
    const prompt = [
      `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      `Drivetrain: ${vehicle.drivetrain || 'unknown'}`,
      `Engine: ${vehicle.engine || 'unknown'}`,
      `User question: ${message}`,
      `Repair history: ${JSON.stringify(repairHistory || []).slice(0, 5000)}`,
      `Open to do items: ${JSON.stringify(todoItems || []).slice(0, 3000)}`,
      `Diagnostic context: ${JSON.stringify(diagnosticContext || {}).slice(0, 3000)}`,
      'Help as a practical automotive diagnostic assistant.',
      'Use the vehicle history to lower confidence in parts already replaced or failed repairs already attempted.',
      'Explain likely causes, quick checks, and recommended next diagnostic steps.',
      'Do not claim certainty when the evidence is limited.',
    ].join('\n');

    const response = await axios.post(
      'https://api.openai.com/v1/responses',
      {
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: prompt,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = getResponseText(response.data);

    if (!text) {
      return res.status(500).json({ error: 'AI response did not include text output.' });
    }

    res.json({
      reply: text,
      sourceName: 'OpenAI Responses API',
      sourceUrl: 'https://platform.openai.com/docs/api-reference/responses',
    });
  } catch (error) {
    console.error('AI diagnostic chat error:', error.response?.data || error.message);
    res.status(500).json({ error: 'AI diagnostic chat failed' });
  }
});

app.get('/shops', (req, res) => {
  const { make, issue, zip } = req.query;

  res.json([
    {
      id: 1,
      name: `${make || 'Vehicle'} Specialty Auto Care`,
      rating: 4.9,
      distance: '2.1 miles',
      specialty: `${make || 'General'} diagnostics`,
      matchReason: issue ? `Strong match for ${issue}` : 'Good match for your vehicle',
      zipCode: zip || null,
      sourceName: 'Demo local shop data',
      sourceUrl: null,
    },
    {
      id: 2,
      name: 'Local Drivability & Electrical',
      rating: 4.8,
      distance: '3.8 miles',
      specialty: 'Electrical and drivability',
      matchReason: 'Highly rated independent shop',
      zipCode: zip || null,
      sourceName: 'Demo local shop data',
      sourceUrl: null,
    },
    {
      id: 3,
      name: `${make || 'Brand'} Dealer Service Center`,
      rating: 4.4,
      distance: '6.2 miles',
      specialty: 'OEM service and recalls',
      matchReason: 'Best option for recalls and factory bulletins',
      zipCode: zip || null,
      sourceName: 'Demo local shop data',
      sourceUrl: null,
    },
  ]);
});

app.get('/vehicles/:vehicleId/repair-history', async (req, res) => {
  try {
    const rows = await getRepairHistoryByVehicle(req.params.vehicleId);
    res.json(rows);
  } catch (error) {
    console.error('Repair history fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch repair history' });
  }
});

app.post('/vehicles/:vehicleId/repair-history', async (req, res) => {
  const { vehicleId } = req.params;
  const entry = req.body;
  const partsCost = parseMoney(entry.partsCost);
  const laborCost = parseMoney(entry.laborCost);
  const totalCost = entry.totalCost !== undefined ? parseMoney(entry.totalCost) : partsCost + laborCost;

  try {
    const result = await pool.query(
      `INSERT INTO repair_history_entries
      (vehicle_id, entry_type, service_date, mileage, problem_symptom, suspected_cause, repair_performed, parts_used, labor_notes, parts_cost, labor_cost, total_cost, fixed_issue, follow_up_repair, actual_fix_later, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        vehicleId,
        entry.entryType || 'repair',
        entry.serviceDate || null,
        parseInteger(entry.mileage),
        entry.problemSymptom || null,
        entry.suspectedCause || null,
        entry.repairPerformed || null,
        entry.partsUsed || null,
        entry.laborNotes || null,
        partsCost,
        laborCost,
        totalCost,
        parseBooleanOrNull(entry.fixedIssue),
        entry.followUpRepair || null,
        entry.actualFixLater || null,
        entry.notes || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Repair history insert error:', error.message);
    res.status(500).json({ error: 'Failed to save repair history entry' });
  }
});

app.put('/repair-history/:id', async (req, res) => {
  const { id } = req.params;
  const entry = req.body;
  const partsCost = parseMoney(entry.partsCost);
  const laborCost = parseMoney(entry.laborCost);
  const totalCost = entry.totalCost !== undefined ? parseMoney(entry.totalCost) : partsCost + laborCost;

  try {
    const result = await pool.query(
      `UPDATE repair_history_entries
       SET entry_type = $2,
           service_date = $3,
           mileage = $4,
           problem_symptom = $5,
           suspected_cause = $6,
           repair_performed = $7,
           parts_used = $8,
           labor_notes = $9,
           parts_cost = $10,
           labor_cost = $11,
           total_cost = $12,
           fixed_issue = $13,
           follow_up_repair = $14,
           actual_fix_later = $15,
           notes = $16,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        entry.entryType || 'repair',
        entry.serviceDate || null,
        parseInteger(entry.mileage),
        entry.problemSymptom || null,
        entry.suspectedCause || null,
        entry.repairPerformed || null,
        entry.partsUsed || null,
        entry.laborNotes || null,
        partsCost,
        laborCost,
        totalCost,
        parseBooleanOrNull(entry.fixedIssue),
        entry.followUpRepair || null,
        entry.actualFixLater || null,
        entry.notes || null,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Repair history entry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Repair history update error:', error.message);
    res.status(500).json({ error: 'Failed to update repair history entry' });
  }
});

app.patch('/repair-history/:id/outcome', async (req, res) => {
  const { id } = req.params;
  const { fixedIssue, actualFixLater, followUpRepair } = req.body;

  try {
    const result = await pool.query(
      `UPDATE repair_history_entries
       SET fixed_issue = COALESCE($2, fixed_issue),
           actual_fix_later = COALESCE($3, actual_fix_later),
           follow_up_repair = COALESCE($4, follow_up_repair),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        parseBooleanOrNull(fixedIssue),
        actualFixLater || null,
        followUpRepair || null,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Repair history entry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Repair outcome update error:', error.message);
    res.status(500).json({ error: 'Failed to update repair outcome' });
  }
});

app.get('/vehicles/:vehicleId/todos', async (req, res) => {
  try {
    const rows = await getTodoItemsByVehicle(req.params.vehicleId);
    res.json(rows);
  } catch (error) {
    console.error('To do fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch to do list' });
  }
});

app.post('/vehicles/:vehicleId/todos', async (req, res) => {
  const { vehicleId } = req.params;
  const item = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO vehicle_todo_items
      (vehicle_id, item_type, title, description, priority, due_date, target_mileage, estimated_cost, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        vehicleId,
        item.itemType || 'maintenance',
        item.title,
        item.description || null,
        item.priority || 'medium',
        item.dueDate || null,
        parseInteger(item.targetMileage),
        parseMoney(item.estimatedCost),
        item.status || 'open',
        item.notes || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('To do insert error:', error.message);
    res.status(500).json({ error: 'Failed to save to do item' });
  }
});

app.put('/todos/:id', async (req, res) => {
  const { id } = req.params;
  const item = req.body;

  try {
    const result = await pool.query(
      `UPDATE vehicle_todo_items
       SET item_type = $2,
           title = $3,
           description = $4,
           priority = $5,
           due_date = $6,
           target_mileage = $7,
           estimated_cost = $8,
           status = $9,
           notes = $10,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        item.itemType || 'maintenance',
        item.title,
        item.description || null,
        item.priority || 'medium',
        item.dueDate || null,
        parseInteger(item.targetMileage),
        parseMoney(item.estimatedCost),
        item.status || 'open',
        item.notes || null,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'To do item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('To do update error:', error.message);
    res.status(500).json({ error: 'Failed to update to do item' });
  }
});

app.patch('/todos/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      `UPDATE vehicle_todo_items
       SET status = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, status || 'completed']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'To do item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('To do status update error:', error.message);
    res.status(500).json({ error: 'Failed to update to do status' });
  }
});

app.get('/vehicles/:vehicleId/cost-summary', async (req, res) => {
  try {
    const vehicleResult = await pool.query('SELECT * FROM vehicles WHERE id = $1', [
      req.params.vehicleId,
    ]);

    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const historyEntries = await getRepairHistoryByVehicle(req.params.vehicleId);
    const todoItems = await getTodoItemsByVehicle(req.params.vehicleId);
    res.json(buildCostSummary(vehicleResult.rows[0], historyEntries, todoItems));
  } catch (error) {
    console.error('Cost summary fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch cost summary' });
  }
});

app.get('/vehicles/:vehicleId/diagnostic-context', async (req, res) => {
  try {
    const historyEntries = await getRepairHistoryByVehicle(req.params.vehicleId);
    res.json(buildDiagnosticContext(historyEntries));
  } catch (error) {
    console.error('Diagnostic context fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch diagnostic context' });
  }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
    return;
  }

  console.log('Database connected:', res.rows[0]);

  initializeDatabase()
    .then(() => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error('Database initialization error:', error.message);
      process.exit(1);
    });
});
