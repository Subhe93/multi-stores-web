/**
 * "API down" versus "store does not exist".
 *
 * While the API is unreachable (stopped for maintenance, crashed, timing out)
 * nginx answers 502/504 with an HTML body, or the connection fails outright.
 * None of that means a store is gone, so the storefront must never turn it
 * into a 404: search engines would start dropping the store's pages. Instead
 * the proxy answers a small maintenance page with HTTP 503 + Retry-After,
 * which crawlers treat as temporary.
 */

/** Statuses that mean the API (or the proxy in front of it) is unavailable. */
const UNAVAILABLE_STATUSES = new Set([502, 503, 504]);

/** Seconds a client / crawler is asked to wait (Retry-After). */
export const MAINTENANCE_RETRY_AFTER_SECONDS = 300;

export function isApiUnavailableStatus(status: number): boolean {
  return UNAVAILABLE_STATUSES.has(status);
}

/**
 * Whether a failed `api()` call is a definitive "not found" answer from the
 * API (a 4xx such as 404 STORE_NOT_FOUND). Anything else (network error,
 * non-JSON 502 page, 5xx, 408 / 429) is NOT proof that the store is missing.
 */
export function isDefinitiveNotFound(err: unknown): boolean {
  const status =
    typeof err === 'object' && err !== null ? (err as { status?: unknown }).status : undefined;
  if (typeof status !== 'number') return false;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/** Thrown by the store layout when the store could not be loaded because the
 *  API is unavailable (rendered by the error boundary as a 5xx, never 404). */
export class StoreUnavailableError extends Error {
  constructor() {
    super('Store temporarily unavailable (API unreachable)');
    this.name = 'StoreUnavailableError';
  }
}

const MESSAGES = {
  en: { title: "We'll be right back", body: 'The store is undergoing a short maintenance. Please try again in a few minutes.' },
  sv: { title: 'Vi är strax tillbaka', body: 'Butiken genomgår ett kort underhåll. Försök igen om några minuter.' },
  de: { title: 'Wir sind gleich zurück', body: 'Der Shop wird kurz gewartet. Bitte versuchen Sie es in ein paar Minuten erneut.' },
  fr: { title: 'Nous revenons très vite', body: 'La boutique est en courte maintenance. Veuillez réessayer dans quelques minutes.' },
  tr: { title: 'Birazdan döneceğiz', body: 'Mağaza kısa bir bakımda. Lütfen birkaç dakika sonra tekrar deneyin.' },
  ar: { title: 'سنعود قريباً', body: 'المتجر في صيانة قصيرة. يرجى المحاولة مرة أخرى بعد بضع دقائق.' },
} as const;
type MaintenanceLang = keyof typeof MESSAGES;

/** First Accept-Language entry the page has a translation for, else English. */
export function maintenanceLang(acceptLanguage: string | null | undefined): MaintenanceLang {
  for (const part of (acceptLanguage ?? '').split(',')) {
    const code = part.trim().split(';')[0]!.split('-')[0]!.toLowerCase();
    if (code in MESSAGES) return code as MaintenanceLang;
  }
  return 'en';
}

/** Self-contained HTML of the maintenance page (no assets, no API data). */
export function maintenanceHtml(lang: MaintenanceLang = 'en'): string {
  const m = MESSAGES[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${m.title}</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f8fafc;color:#0f172a;padding:16px;box-sizing:border-box}
main{max-width:28rem;text-align:center}
h1{font-size:1.5rem;font-weight:600;margin:0 0 .75rem}
p{margin:0;color:#475569;line-height:1.5}
@media (prefers-color-scheme:dark){body{background:#0f172a;color:#f1f5f9}p{color:#cbd5e1}}
</style>
</head>
<body><main><h1>${m.title}</h1><p>${m.body}</p></main></body>
</html>
`;
}

/** Headers of the maintenance response: temporary, never cached or indexed. */
export function maintenanceHeaders(): Record<string, string> {
  return {
    'content-type': 'text/html; charset=utf-8',
    'retry-after': String(MAINTENANCE_RETRY_AFTER_SECONDS),
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex',
  };
}
