// Platform-level metadata inherited from the admin-configured PlatformConfig.
// platform_name (Admin → Settings → Platform Info) is the single source of the
// platform name across the storefront — no hardcoded brand strings.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const DEFAULT_PLATFORM_NAME = 'Multi Stores';

/**
 * Server-side fetch of the platform name. Cost profile:
 *  - Next Data Cache (revalidate 300s): at most one API round-trip per 5 min
 *    per server instance; every other render reads the cached ~40-byte body.
 *  - Request memoization: the layout, header, footer and metadata calls within
 *    one render collapse into a single fetch.
 *  - 3s abort + fallback: a hung API can never stall a page render.
 */
export async function getPlatformName(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/storefront/platform-meta`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return DEFAULT_PLATFORM_NAME;
    const json = (await res.json()) as {
      platform_name?: string;
      data?: { platform_name?: string };
    };
    return json.data?.platform_name || json.platform_name || DEFAULT_PLATFORM_NAME;
  } catch {
    return DEFAULT_PLATFORM_NAME;
  }
}
