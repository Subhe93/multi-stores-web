// Microsoft Clarity (heatmaps + session recordings) helpers.
//
// Rules (plans/clarity/PLAN.md, section 9 is binding):
// - Clarity is ALWAYS consent-gated, also when the store turned
//   `consent_required` off: no script and no requests before "accept".
// - After "accept" Clarity gets `consentv2` with analytics granted and ads
//   denied (the stores do not use Microsoft Ads).
// - On withdrawal Clarity gets `consentv2` denied plus `consent(false)`
//   (erases _clck/_clsk), and the page reloads, because Clarity would
//   otherwise keep collecting in cookieless mode.
// - Never on account / auth pages or on the order confirmation (its URL can
//   carry payment ids such as `payment_intent_client_secret`).
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

/**
 * Consent withdrawn after it was granted in this document: tell every vendor
 * "denied" and reload when any vendor script ran, so nothing keeps
 * collecting (an executed Meta pixel keeps auto-tracking client navigations
 * and clicks after its component unmounts). `vendors` is false for stores
 * that load GA4 / Meta / TikTok without consent: the visitor's choice then
 * only governs Clarity.
 */
export function revokeTrackingConsent({ vendors }: { vendors: boolean }): void {
  let ran = false;
  if (vendors) {
    if (typeof window.gtag === 'function') {
      ran = true;
      window.gtag('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      });
    }
    if (typeof window.fbq === 'function') {
      ran = true;
      window.fbq('consent', 'revoke');
    }
    if (window.ttq) {
      ran = true;
      if (typeof window.ttq.revokeConsent === 'function') window.ttq.revokeConsent();
    }
  }
  if (typeof window.clarity === 'function') {
    ran = true;
    window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });
    window.clarity('consent', false);
  }
  if (ran) reloadPage();
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
