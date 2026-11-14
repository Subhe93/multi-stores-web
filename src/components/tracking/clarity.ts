// Microsoft Clarity (heatmaps + session recordings) helpers.
//
// Rules (plans/clarity/PLAN.md, section 9 is binding):
// - Clarity is ALWAYS consent-gated (analytics category), also when the
//   store turned `consent_required` off: no script and no requests before
//   the visitor allows analytics.
// - After that Clarity gets `consentv2` with analytics granted and ads
//   denied (the stores do not use Microsoft Ads).
// - On withdrawal of the analytics category Clarity gets `consentv2`
//   denied plus the deprecated `consent(false)` (erases _clck/_clsk), and
//   the page reloads, because Clarity would otherwise keep collecting in
//   cookieless mode (consent v2 §7.1).
// - Never on account / auth pages or on the order confirmation (its URL can
//   carry payment ids such as `payment_intent_client_secret`).
import type { TrackerVendor } from '@/lib/consent';
import { clearVendorCookies, type CookieGroup } from './consentCookies';
import { reloadPage } from './pageReload';

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[] };

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

/** Store-layout child segments where Clarity never loads. */
const EXCLUDED_SEGMENTS = new Set(['account', 'auth']);

/**
 * Whether Clarity may load under these store-layout child segments
 * (`useSelectedLayoutSegments()` called from the store layout; route groups
 * keep their brackets).
 */
export function clarityAllowedFor(segments: readonly string[]): boolean {
  const [first] = segments;
  if (first && EXCLUDED_SEGMENTS.has(first)) return false;
  // Order confirmations (card and Kustom) live under the checkout group.
  if (first === '(checkout)' && segments.includes('confirmation')) return false;
  return true;
}

/** Clarity project ids are lower-case alphanumerics (validated by the API). */
export function safeClarityId(id: string | null | undefined): string {
  return (id ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The official loader's command queue. Defining it ourselves makes the
 * consent calls independent of when the loader script runs; the loader
 * keeps an existing `window.clarity`.
 */
function clarity(): ClarityFn {
  if (typeof window.clarity !== 'function') {
    const stub: ClarityFn = function (...args: unknown[]) {
      (stub.q = stub.q || []).push(args);
    };
    window.clarity = stub;
  }
  return window.clarity as ClarityFn;
}

/** Inline loader (official snippet) for a sanitised project id. */
export function clarityLoader(projectId: string): string {
  return `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${projectId}");`;
}

/** Consent granted: analytics storage only (no Microsoft Ads). */
export function grantClarityConsent(): void {
  clarity()('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
}

export interface RevokeOptions {
  /** Analytics was granted and is now withdrawn. */
  analytics: boolean;
  /** Marketing was granted and is now withdrawn. */
  marketing: boolean;
  /** Vendors that are consent-gated in this store (ungated ones are left alone, D10). */
  gated: readonly TrackerVendor[];
}

/**
 * A category granted earlier in this document was withdrawn (consent v2
 * §7.1): tell the vendors of that category "denied", clear their first-party
 * cookies, and reload when any of them ran (an executed pixel keeps
 * auto-tracking client navigations and clicks after its component
 * unmounts). Granting more never reloads. Returns whether a reload was
 * requested.
 */
export function revokeConsentCategories({ analytics, marketing, gated }: RevokeOptions): boolean {
  let ran = false;
  const cleared: CookieGroup[] = [];
  const ga4Gated = gated.includes('ga4');
  if (analytics) {
    if (ga4Gated) {
      // GA4 stops entirely (ad signals included), so its ad cookies go too.
      cleared.push('ga4', 'google_ads');
      if (typeof window.gtag === 'function') {
        ran = true;
        window.gtag('consent', 'update', {
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          analytics_storage: 'denied',
        });
      }
    }
    if (gated.includes('clarity')) {
      cleared.push('clarity');
      if (typeof window.clarity === 'function') {
        ran = true;
        window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });
        // Deprecated v1 call (erases _clck/_clsk); kept until Microsoft removes it.
        window.clarity('consent', false);
      }
    }
  }
  if (marketing) {
    // GA4 keeps running under analytics: only its ad signals go, with the
    // Google ad cookies (`_gcl_*`) written while ad_storage was granted. No
    // reload: with ad_storage denied GA4 writes no new ad cookies.
    if (ga4Gated && !analytics) {
      cleared.push('google_ads');
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      }
    }
    if (gated.includes('meta')) {
      cleared.push('meta');
      if (typeof window.fbq === 'function') {
        ran = true;
        window.fbq('consent', 'revoke');
      }
    }
    if (gated.includes('tiktok')) {
      cleared.push('tiktok');
      if (window.ttq) {
        ran = true;
        if (typeof window.ttq.revokeConsent === 'function') window.ttq.revokeConsent();
      }
    }
  }
  clearVendorCookies(cleared);
  if (ran) reloadPage();
  return ran;
}

/**
 * Whether a URL path is one of the routes Clarity never records (account,
 * auth, order confirmations). Path based (store prefix, locale prefix or a
 * custom domain in front), for links and redirects before they navigate; a
 * false positive only costs a full page load.
 */
export function isClarityExcludedPath(path: string): boolean {
  const clean = path.split(/[?#]/, 1)[0] ?? '';
  const parts = clean.split('/').filter(Boolean);
  if (parts.some((p) => EXCLUDED_SEGMENTS.has(p))) return true;
  const i = parts.indexOf('checkout');
  return i >= 0 && parts.slice(i + 1).includes('confirmation');
}

/** True while a Clarity tag has run in this document (it outlives its component). */
export function clarityRanInDocument(): boolean {
  return typeof window !== 'undefined' && typeof window.clarity === 'function';
}

/**
 * Client navigation that never carries a running Clarity onto an excluded
 * route: with Clarity in the document, a target such as the order
 * confirmation is opened as a full page load (a fresh document without the
 * tag, since <ClarityScript> is not mounted there); otherwise `clientNav`.
 */
export function navigateRespectingClarity(href: string, clientNav: (href: string) => void, replace = false): void {
  if (clarityRanInDocument() && isClarityExcludedPath(href)) {
    if (replace) window.location.replace(href);
    else window.location.assign(href);
    return;
  }
  clientNav(href);
}
