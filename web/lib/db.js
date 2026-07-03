// Neon serverless driver over HTTP — reads the same DATABASE_URL the
// pipeline agents' db/client.js uses, and exposes the same
// query(text, params) -> { rows } helper. The HTTP transport works on
// Vercel serverless/edge and anywhere raw Postgres TCP is unavailable.
const { neon } = require('@neondatabase/serverless');

let sql;

function getClient() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    sql = neon(process.env.DATABASE_URL, { fullResults: true });
  }
  return sql;
}

async function query(text, params) {
  return getClient().query(text, params);
}

module.exports = { query };
