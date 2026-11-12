// Runs the additive migrations (005, 006, 007) once per server instance so
// nobody has to press a migrate button before the app works. Each one is
// idempotent; a failure is logged and retried on the next request.
const db = require('./db');

let ready = null;

function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      await require('./migrations/005-enrichment').run(db);
      await require('./migrations/006-gmail').run(db);
      await require('./migrations/007-keepwarm').run(db);
    })().catch((err) => {
      console.error('ensureSchema failed:', err.message);
      ready = null;
      throw err;
    });
  }
  return ready;
}

module.exports = { ensureSchema };
