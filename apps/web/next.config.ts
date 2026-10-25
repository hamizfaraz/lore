import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

const API =
  process.env.API_INTERNAL_URL ??
  (process.env.VERCEL ? 'https://lore-api-c79x.onrender.com' : 'http://localhost:4000');

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV !== 'production',
  reloadOnOnline: false,
});

/** Dev: rewrite /v1, /api/auth and /socket.io to the api so the browser is always same-origin. Caddy does it in prod. */
const config: NextConfig = {
  // Lets CI/E2E build beside an active dev server without both processes corrupting `.next`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  transpilePackages: ['@lore/shared', '@lore/tokens'],
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: '/v1/:path*', destination: `${API}/v1/:path*` },
      { source: '/api/auth/:path*', destination: `${API}/api/auth/:path*` },
      { source: '/socket.io/:path*', destination: `${API}/socket.io/:path*` },
    ];
  },
};

export default withSerwist(config);
