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
  experimental: {
    // Inline the (single, ~23 KB brotli) global stylesheet into the HTML
    // instead of a render-blocking <link> (PageSpeed: ~600 ms on mobile). The
    // HTML is not edge-cached, so the repeat-view cost is only bytes.
    inlineCss: true,
  },
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
    // Kept open on purpose: imported (WordPress) content and section media
    // can hold absolute URLs on third-party hosts, not only the API origin.
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
    // The image optimizer blocks upstreams that resolve to private/loopback IPs
    // (SSRF protection). In dev the API serves images from localhost, so allow
    // it there only — production uses a public API host where the block is moot.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
    // AVIF first (smaller), WebP fallback for browsers without AVIF.
    formats: ['image/avif', 'image/webp'],
    // Upload URLs get a fresh name per upload and are served `immutable` for a year by
    // the API, so optimized variants can be cached just as long.
    minimumCacheTTL: 31536000,
    // Uploads are capped at 2000px by the API, so the 3840 default is dropped.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
  },
};

export default withNextIntl(nextConfig);
