// Thin connector for the Perplexity API (chat completions with live web
// search). Used by the prospector (find real named contacts) and the news
// agent (find trigger events). Requires PERPLEXITY_API_KEY.
const API_URL = 'https://api.perplexity.ai/chat/completions';
const DEFAULT_MODEL = 'sonar-pro';

function isConfigured() {
  return Boolean(process.env.PERPLEXITY_API_KEY);
}

// Sends one user prompt to Perplexity and returns the raw answer text
// (grounded in live web search results). Throws with a clear message when
// the key is missing so pipeline steps can log/skip cleanly.
async function search(prompt, { model = DEFAULT_MODEL, maxTokens = 2000 } = {}) {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    throw new Error('PERPLEXITY_API_KEY is not set');
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Perplexity API returned an empty response');
  }
  return text;
}

module.exports = { search, isConfigured };
