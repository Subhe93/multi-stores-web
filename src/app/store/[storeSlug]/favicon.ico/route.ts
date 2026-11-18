import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { requestMarketRef } from '@/lib/market';
import { storeGate } from '@/lib/storeGate';

interface RouteCtx {
  params: Promise<{ storeSlug: string }>;
}

const PLATFORM_URL = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';

/**
 * `GET /favicon.ico` on a store host (the proxy rewrites it here). Browsers,
 * bookmarks and crawlers request this URL without reading the page's
 * `<link rel="icon">`, so a store with its own favicon must answer with it:
 * a 307 to the uploaded file. A store without a favicon, a store that is not
 * LIVE and any lookup failure keep the platform icon, as before.
 */
export async function GET(req: Request, ctx: RouteCtx) {
  const { storeSlug } = await ctx.params;
  let faviconUrl = '';
  try {
    const store = (await storefront.getStore(storeSlug, requestMarketRef(req.headers))) as {
      favicon_url?: string | null;
      status?: string;
      coming_soon?: boolean;
      paused?: boolean;
    };
    if (storeGate(store) === 'live') faviconUrl = resolveMediaUrl(store.favicon_url);
  } catch {
    faviconUrl = '';
  }

  if (faviconUrl) {
    return new Response(null, {
      status: 307,
      headers: { Location: faviconUrl, 'Cache-Control': 'public, max-age=300' },
    });
  }

  // Platform icon: the same bytes the platform host serves from `public/`.
  try {
    const bytes = await readFile(path.join(process.cwd(), 'public', 'favicon.ico'));
    return new Response(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'image/x-icon', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    // `public/` not readable from this process: send the browser to the
    // platform host, which serves the file statically.
    return new Response(null, {
      status: 307,
      headers: { Location: `${PLATFORM_URL.replace(/\/+$/, '')}/favicon.ico` },
    });
  }
}
