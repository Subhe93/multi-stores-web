import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { storefront } from './api';
import { normalizeCheckoutSettings } from './checkoutSettings';
import { resolveBackLabel } from './externalReturn';
import { focusedStorefront, focusRedirectTarget, focusRouteKind, type FocusedStorefront } from './focusedStorefront';
import { getRequestMarket } from './market.server';
import { loadGatedStore } from './storeGate.server';
import type { StoreGateFields } from './storeGate';

interface FocusStore extends StoreGateFields {
  checkout?: unknown;
  cookie_page_slug?: string | null;
  language_config?: { primary_locale?: string } | null;
}

/**
 * The focused storefront of the store being served (its raw `checkout`
 * block, judged for the request host), or null. For server pages that only
 * need to know the mode; the layout applies the same rule.
 */
export async function requestFocusedStorefront(checkout: unknown): Promise<FocusedStorefront | null> {
  const settings = normalizeCheckoutSettings(checkout);
  // Stores without the flag never reach the request headers.
  if (!focusedStorefront(settings)) return null;
  return focusedStorefront(settings, (await headers()).get('host'));
}

/**
 * The "back to site" link of a focused storefront for server-rendered
 * surfaces without the client providers (the store 404), or null. The label
 * is the merchant's `back_label` for the locale, else "Back to <host>".
 * Never throws: an unreadable store simply has no link.
 */
export async function focusedBackToSite(
  storeSlug: string,
  urlLocale: string | null,
): Promise<{ href: string; label: string } | null> {
  try {
    const store = (await storefront.getStore(storeSlug, await getRequestMarket())) as FocusStore | null;
    const settings = normalizeCheckoutSettings(store?.checkout);
    const focus = focusedStorefront(settings, (await headers()).get('host'));
    if (!focus) return null;
    const locale = urlLocale || store?.language_config?.primary_locale || 'en';
    const t = await getTranslations({ locale, namespace: 'checkout' });
    return {
      href: focus.siteUrl,
      label: resolveBackLabel(settings, locale) || t('returnToSite', { site: focus.siteHost }),
    };
  } catch {
    return null;
  }
}

/**
 * Focused storefront: sends a browsing page (home, collections, the product
 * listing, a content page) to the store's external site with a 307. Called
 * first thing by exactly those pages; returns normally for every other store.
 *
 * Why here and not in `proxy.ts`: the proxy only knows the host route (slug,
 * market), not the store payload, so it would need the flag added to both
 * host lookups, would act on a 60 s host cache, and could not tell a legal or
 * cookie page from any other `/{pageSlug}` (that needs the payload and the
 * legal list). Here the decision reads the same cached store payload the
 * layout reads (no extra API call for home / collections / listing), only
 * routes that opt in can ever redirect, and the publication gate and the
 * owner's preview are known. The page is not inside a Suspense boundary, so
 * `redirect()` answers a real HTTP 307 (temporary, never cached as permanent).
 *
 * Not redirected by construction: every route that does not call this
 * (product pages, cart, checkout, order confirmation, account, auth,
 * /legal/*, robots.txt, sitemap.xml, /api, /builder-preview, static files).
 * Not redirected by decision (`focusRedirectTarget`): a store that is not
 * LIVE (its gate page shows), the owner's preview, a legal or cookie page,
 * and an external site that is the host being served (loop guard).
 *
 * @param storePath locale-free store path of the route (`/`, `/collections`,
 *   `/products`, `/{pageSlug}`).
 */
export async function redirectFocusedBrowsing(storeSlug: string, storePath: string): Promise<void> {
  let target: string | null = null;
  try {
    const market = await getRequestMarket();
    const gated = await loadGatedStore<FocusStore>(storeSlug, market);
    const settings = normalizeCheckoutSettings(gated.store.checkout);
    const requestHost = (await headers()).get('host');
    // Cheap exit for every store without the flag (no further reads).
    if (!focusedStorefront(settings, requestHost)) return;

    // A content page stays when it is the cookie page or serves a legal slug.
    // The legal list is the cached read the layout makes; when it cannot be
    // read the page is kept (a legal page is never redirected by accident).
    let keepSlugs: Array<string | null | undefined> = [gated.store.cookie_page_slug];
    if (focusRouteKind(storePath) === 'content-page') {
      try {
        // `page_slug` does not depend on the locale; any served one will do.
        const locale = gated.store.language_config?.primary_locale || 'en';
        const legal = await storefront.getLegalPages(storeSlug, locale, market);
        keepSlugs = [...keepSlugs, ...legal.map((row) => row.page_slug)];
      } catch {
        return;
      }
    }

    target = focusRedirectTarget({
      settings,
      path: storePath,
      requestHost,
      gate: gated.gate,
      ownerPreview: gated.preview,
      keepSlugs,
    });
  } catch {
    // Store unreadable: the page itself answers (404 / 5xx) as before.
    return;
  }
  // Outside the try block: `redirect()` works by throwing.
  if (target) redirect(target);
}
