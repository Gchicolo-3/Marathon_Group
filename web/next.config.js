/** @type {import('next').NextConfig} */
const nextConfig = {
  // The copywriter reads its prompt-context markdown at runtime; make sure
  // Vercel's serverless bundles include the files for every route that drafts.
  outputFileTracingIncludes: {
    '/api/deals/[id]/regenerate': ['./lib/skills/**/*'],
    '/api/pipeline/run': ['./lib/skills/**/*'],
    '/api/cron/pipeline': ['./lib/skills/**/*'],
  },
};

module.exports = nextConfig;
