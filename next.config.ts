import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
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
