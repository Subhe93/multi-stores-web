import 'server-only';
import { headers } from 'next/headers';
import { MARKET_GEO_HEADER, MARKET_HEADER, MARKET_SUGGEST_HEADER } from './market';

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
