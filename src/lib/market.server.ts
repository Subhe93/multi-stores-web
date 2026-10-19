import 'server-only';
import { headers } from 'next/headers';
import { MARKET_GEO_HEADER, MARKET_HEADER, MARKET_PREVIEW_HEADER, MARKET_SUGGEST_HEADER } from './market';

// Request-scoped readers of the headers `src/proxy.ts` sets for market
// stores. Server components / route handlers only — `src/lib/market.ts`
// holds the shared types and constants so client code never pulls
// `next/headers` into its bundle.

/** Market key of the current request, or undefined for non-market stores. */
export async function getRequestMarketKey(): Promise<string | undefined> {
  try {
    const value = (await headers()).get(MARKET_HEADER);
    return value || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The market of the current request as a `MarketRef` for the API helpers:
 * `{ key }` on a market host, `{ key, preview: true }` on a market-preview
 * host (`x-market-preview: 1`), undefined for non-market stores. Pass it
 * wherever a bare key was passed before — `marketQuery` adds `preview=1`.
 */
export async function getRequestMarket(): Promise<{ key: string; preview?: true } | undefined> {
  try {
    const reqHeaders = await headers();
    const key = reqHeaders.get(MARKET_HEADER);
    if (!key) return undefined;
    return reqHeaders.get(MARKET_PREVIEW_HEADER) === '1' ? { key, preview: true } : { key };
  } catch {
    return undefined;
  }
}

/** `{ key, country }` of the market the proxy suggests, or null. */
export async function getRequestSuggestedMarket(): Promise<{ key: string; country: string | null } | null> {
  try {
    const reqHeaders = await headers();
    const key = reqHeaders.get(MARKET_SUGGEST_HEADER);
    if (!key) return null;
    return { key, country: reqHeaders.get(MARKET_GEO_HEADER) };
  } catch {
    return null;
  }
}
