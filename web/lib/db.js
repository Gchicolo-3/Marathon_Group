// Same connection pattern as the pipeline agents' db/client.js:
// a pg Pool reading the Neon connection string from DATABASE_URL,
// exposing a query(text, params) helper.
const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon requires TLS; sslmode=require in the URL covers most cases,
      // this keeps it working even if the param is omitted.
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

module.exports = { query };
