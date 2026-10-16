// Provider switch. ENRICHMENT_PROVIDER=vibe (default when a key is present).
function getProvider() {
  const choice = (process.env.ENRICHMENT_PROVIDER || '').toLowerCase();
  if (choice === 'vibe' || (!choice && process.env.EXPLORIUM_API_KEY)) {
    return require('./vibe');
  }
  return null;
}

function isConfigured() {
  return getProvider() !== null && Boolean(process.env.EXPLORIUM_API_KEY);
}

module.exports = { getProvider, isConfigured };
