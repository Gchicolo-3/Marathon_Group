/** @type {import('next').NextConfig} */
const nextConfig = {
  // The copywriter reads its prompt-context markdown at runtime; make sure
  // Vercel's serverless bundle includes the files.
  outputFileTracingIncludes: {
    '/api/deals/[id]/regenerate': ['./lib/skills/**/*'],
  },
};

module.exports = nextConfig;
