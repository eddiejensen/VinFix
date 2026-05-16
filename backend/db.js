const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const LOCAL_PG_PORT = Number(process.env.LOCAL_PG_PORT || 54329);
const LOCAL_PG_USER = process.env.LOCAL_PG_USER || 'vinfix';
const LOCAL_PG_PASSWORD = process.env.LOCAL_PG_PASSWORD || 'vinfix';
const DATA_DIR = path.join(__dirname, '.data', 'postgres');

let pool = null;
let embeddedInstance = null;

function useLocalDatabase() {
  if (process.env.USE_LOCAL_DB === 'false') {
    return false;
  }
  if (process.env.USE_LOCAL_DB === 'true') {
    return true;
  }
  return !process.env.DATABASE_URL;
}

async function startEmbeddedPostgres() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');

  fs.mkdirSync(DATA_DIR, { recursive: true });

  embeddedInstance = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: LOCAL_PG_USER,
    password: LOCAL_PG_PASSWORD,
    port: LOCAL_PG_PORT,
    persistent: true,
  });

  const isInitialized = fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));
  if (!isInitialized) {
    await embeddedInstance.initialise();
  }

  try {
    await embeddedInstance.start();
  } catch (error) {
    // If a previous dev server was killed, the embedded Postgres process can
    // keep running. Reuse it instead of failing local startup.
    console.warn('Embedded Postgres start warning:', error?.message || 'already running');
  }

  pool = new Pool({
    host: 'localhost',
    port: LOCAL_PG_PORT,
    user: LOCAL_PG_USER,
    password: LOCAL_PG_PASSWORD,
    database: 'postgres',
  });

  console.log(`Local database running (data: ${DATA_DIR}, port ${LOCAL_PG_PORT})`);
}

async function connectRemotePostgres() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });
  console.log('Using remote DATABASE_URL');
}

async function initDatabase() {
  if (useLocalDatabase()) {
    await startEmbeddedPostgres();
  } else {
    await connectRemotePostgres();
  }

  const result = await pool.query('SELECT NOW() AS now');
  console.log('Database connected:', result.rows[0]);
  return pool;
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (embeddedInstance) {
    await embeddedInstance.stop();
    embeddedInstance = null;
  }
}

module.exports = {
  initDatabase,
  closeDatabase,
  useLocalDatabase,
};
