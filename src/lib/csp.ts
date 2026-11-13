// Content-Security-Policy builder for the storefront and the marketing site
// (security audit M6, plans/security-hardening/CSP-ROLLOUT.md).
// Pure (no imports) so next.config.ts and the vitest spec can load it.
//
// next.config.ts evaluates headers() at BUILD time: every env value read
// here (NEXT_PUBLIC_API_URL, CSP_EXTRA_ORIGINS, CSP_REPORT_URI, CSP_ENFORCE)
// needs `npm run build` + restart to take effect.
//
// Three policies:
// - storefront: stores on <slug>.<platform host> and custom domains. Owners
//   may add their own HTML/JS (EmbedCode inline mode, raw_html sections,
//   GA4 / Meta / TikTok pixels), so scripts, styles, images and frames stay
//   open to any https: source. The value is in object-src, base-uri,
//   frame-ancestors, form-action and a connect-src ALLOWLIST whose reports
//   show where store pages actually send data.
// - builder preview: the storefront policy, framable by the dashboard.
// - marketing: the platform's own pages (landing, legal, sign-in, register),
//   where tokens are handled; no owner content, so it is much tighter.

export type CspDirectives = Record<string, string[]>;

export interface CspContext {
  /** Origin(s) of the API (NEXT_PUBLIC_API_URL) — fetch, media, images. */
  apiOrigins: string[];
  /** CSP_EXTRA_ORIGINS: e.g. the old API host still used for media links. */
  extraOrigins: string[];
  /** Absolute report endpoint, or null when no API URL is configured. */
  reportUri: string | null;
  /** `next dev`: React needs eval and HMR needs websockets. */
  dev: boolean;
  /** CSP_ENFORCE=1 sends the enforcing header instead of Report-Only. */
  enforce: boolean;
}

export interface CspEnv {
  NEXT_PUBLIC_API_URL?: string;
  CSP_EXTRA_ORIGINS?: string;
  CSP_REPORT_URI?: string;
  CSP_ENFORCE?: string;
  NODE_ENV?: string;
}

/** Name of the Reporting API endpoint used by `report-to`. */
export const CSP_REPORT_GROUP = 'csp-endpoint';

const ORIGIN_RE = /^(https?|wss?):\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*(:\d{1,5})?$/;

/** A CSP source origin (`scheme://host[:port]`, optional `*.`), else null. */
export function cspOrigin(value: string | undefined | null): string | null {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return null;
  const m = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]+)/.exec(v);
  if (!m) return null;
  return ORIGIN_RE.test(m[1]) ? m[1] : null;
}

/** Comma-separated origin list, invalid entries dropped, deduplicated. */
export function cspOriginList(raw: string | undefined | null): string[] {
  const out: string[] = [];
  for (const part of (raw ?? '').split(',')) {
    const o = cspOrigin(part);
    if (o && !out.includes(o)) out.push(o);
  }
  return out;
}

/** True for "1", "true", "yes", "on" (case-insensitive). */
export function envFlag(raw: string | undefined | null): boolean {
  return /^(1|true|yes|on)$/i.test((raw ?? '').trim());
}

export function cspContextFrom(env: CspEnv): CspContext {
  const apiUrl = (env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
  const apiOrigin = cspOrigin(apiUrl);
  const explicit = (env.CSP_REPORT_URI ?? '').trim();
  return {
    apiOrigins: apiOrigin ? [apiOrigin] : [],
    extraOrigins: cspOriginList(env.CSP_EXTRA_ORIGINS),
    reportUri: explicit || (apiOrigin ? `${apiUrl}/csp-report` : null),
    dev: env.NODE_ENV !== 'production',
    enforce: envFlag(env.CSP_ENFORCE),
  };
}

/** Header name: Report-Only unless CSP_ENFORCE is on. */
export function cspHeaderName(ctx: Pick<CspContext, 'enforce'>): string {
  return ctx.enforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
}

/** Serialize directives in insertion order, sources deduplicated. */
export function serializeCsp(directives: CspDirectives): string {
  return Object.entries(directives)
    .map(([name, sources]) => {
      const uniq = sources.filter((s, i) => s && sources.indexOf(s) === i);
      return uniq.length ? `${name} ${uniq.join(' ')}` : name;
    })
    .join('; ');
}

function withReporting(ctx: CspContext, d: CspDirectives): CspDirectives {
  if (!ctx.reportUri) return d;
  return { ...d, 'report-uri': [ctx.reportUri], 'report-to': [CSP_REPORT_GROUP] };
}

function devScript(ctx: CspContext): string[] {
  return ctx.dev ? ["'unsafe-eval'"] : [];
}

function devConnect(ctx: CspContext): string[] {
  return ctx.dev ? ['ws:', 'wss:', 'http://localhost:*'] : [];
}

/** Stripe.js: script, API calls, 3DS / Elements iframes. */
const STRIPE = ['https://js.stripe.com', 'https://*.stripe.com', 'https://*.stripe.network'];
/** Kustom checkout (Klarna-based) snippet and its API. */
const KUSTOM = [
  'https://*.kustom.co',
  'https://*.klarna.com',
  'https://*.klarnacdn.net',
  'https://*.klarnaservices.com',
];
const TURNSTILE = ['https://challenges.cloudflare.com'];
/**
 * Built-in store tracking apps (GA4 / Meta pixel / TikTok pixel / Microsoft
 * Clarity). Clarity uploads to `*.clarity.ms` and syncs with `c.bing.com`;
 * its tag script (www.clarity.ms) is covered by `https:` in script-src.
 */
const ANALYTICS = [
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://*.googletagmanager.com',
  'https://*.g.doubleclick.net',
  'https://www.google.com',
  'https://*.facebook.com',
  'https://*.facebook.net',
  'https://*.tiktok.com',
  'https://*.tiktokw.us',
  'https://*.clarity.ms',
  'https://c.bing.com',
];
const VIDEO_FRAMES = [
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
];

/**
 * Storefront policy. `frameAncestors` defaults to same-origin (matches the
 * X-Frame-Options: SAMEORIGIN already sent); the builder preview passes the
 * dashboard origins.
 */
export function storefrontCspDirectives(
  ctx: CspContext,
  opts: { frameAncestors?: string[] } = {},
): CspDirectives {
  const own = ["'self'", ...ctx.apiOrigins, ...ctx.extraOrigins];
  return withReporting(ctx, {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:', 'blob:'],
    'style-src': ["'self'", "'unsafe-inline'", 'https:'],
    'img-src': [...own, 'data:', 'blob:', 'https:'],
    'font-src': [...own, 'data:', 'https:'],
    'media-src': [...own, 'data:', 'blob:', 'https:'],
    'connect-src': [...own, ...STRIPE, ...KUSTOM, ...TURNSTILE, ...ANALYTICS, ...devConnect(ctx)],
    'frame-src': ["'self'", 'https:'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'", 'https:'],
    'frame-ancestors': ["'self'", ...(opts.frameAncestors ?? [])],
  });
}

/** Marketing / platform auth pages: no owner content. */
export function marketingCspDirectives(ctx: CspContext): CspDirectives {
  const own = ["'self'", ...ctx.apiOrigins, ...ctx.extraOrigins];
  return withReporting(ctx, {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...TURNSTILE, ...devScript(ctx)],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': [...own, 'data:', 'blob:', 'https:'],
    'font-src': [...own, 'data:', 'https://fonts.gstatic.com'],
    'media-src': [...own, 'data:', 'blob:'],
    'connect-src': [...own, ...TURNSTILE, ...devConnect(ctx)],
    'frame-src': ["'self'", ...TURNSTILE, ...VIDEO_FRAMES],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'"],
  });
}

/** `Reporting-Endpoints` header value, or null without a report URI. */
export function reportingEndpointsValue(ctx: CspContext): string | null {
  return ctx.reportUri ? `${CSP_REPORT_GROUP}="${ctx.reportUri}"` : null;
}

/** The CSP header (+ Reporting-Endpoints) for one policy. */
export function cspHeaders(
  ctx: CspContext,
  directives: CspDirectives,
): { key: string; value: string }[] {
  const out = [{ key: cspHeaderName(ctx), value: serializeCsp(directives) }];
  const endpoints = reportingEndpointsValue(ctx);
  if (endpoints) out.push({ key: 'Reporting-Endpoints', value: endpoints });
  return out;
}

/** Regex (for next.config `has: [{ type: 'host' }]`) matching exactly these hosts. */
export function exactHostPattern(hosts: readonly string[]): string {
  const escaped = hosts.map((h) => h.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'));
  return `(?:${escaped.join('|')})`;
}
