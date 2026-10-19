import path from 'node:path';
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// @multi-stores/core is a file: dependency linked from the sibling repo
// multi-stores-shared/packages/core (M5.3). Turbopack only reads files inside
// its root, so the root (and the output tracing root, which must match) is
// the parent folder that holds all four repos, here and on the server.
const workspaceRoot = path.join(__dirname, '..');

// Security headers for every storefront response. No CSP here (the dashboard
// and API are handled separately). `/builder-preview` is framed by the
// dashboard's builder, so it gets everything except X-Frame-Options.
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

const nextConfig: NextConfig = {
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  poweredByHeader: false,
  // The trailing-slash 308 ran before the proxy, so an imported WordPress URL
  // (`/produkt/x/`) needed two hops (308 → 301). The proxy now strips the
  // slash itself, after the store redirects (see stripTrailingSlash).
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      { source: '/builder-preview/:path*', headers: SECURITY_HEADERS },
      {
        source: '/((?!builder-preview).*)',
        headers: [...SECURITY_HEADERS, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
    // The image optimizer blocks upstreams that resolve to private/loopback IPs
    // (SSRF protection). In dev the API serves images from localhost, so allow
    // it there only — production uses a public API host where the block is moot.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
  },
};

export default withNextIntl(nextConfig);
