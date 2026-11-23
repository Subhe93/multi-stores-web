// Owner-typed links that hit a permanent store redirect point straight at
// its target (M166 D1). Example: a footer link `/shipping-policy` with the
// store redirect row `/shipping-policy -> /legal/shipping (301)` renders as
// `/legal/shipping`, so neither visitors nor crawlers pay the hop.
//
// Pure module (no `next/*`): the server wiring lives in
// productLinkCanonical.server.ts (third pass of the link rewriter).
//
// Rules:
//  - only links of this store: relative `/...` paths, or absolute http(s)
//    URLs on one of the store's own hosts (the host is kept);
//  - only permanent hits (301/308) with a safe same-site target (`/...`);
//    temporary redirects (302/307) may change back and stay as typed;
//  - the lookup is the proxy's: exact key, then the `/page/N|/feed|/amp`
//    fallback; on a locale-path market (M156) the target's bare locale
//    folder is remapped and `/de-at/old` falls back to the `/de/old` row;
//  - the query of the link is merged as the proxy does (target first, then
//    the link's parameters); the link's fragment is kept unless the target
//    has its own;
//  - one hop only: a rewritten target is never looked up again, so a chain
//    or a loop in the table cannot make the rewrite loop;
//  - anything else (external links, mailto:, anchors, odd strings) is
//    returned unchanged (same string identity).

import { legacyRedirectAlias, rebaseAliasTarget, remapLegacyLocaleTarget, usesLocalePaths, type PathMarket } from './localePaths';
import { buildRedirectLocation, isSafeRedirectTarget, matchRedirectMap, normalizeRedirectPath, type RedirectHit } from './redirects';
import type { NavMenu, SectionInstance } from '@/themes/types';

export interface RedirectLinkContext {
  /** The store's redirect table (map mode). */
  map: ReadonlyMap<string, RedirectHit>;
  /** Locale-path market of the page (relative links), or null. */
  pathMarket: PathMarket | null;
  /**
   * Hosts of this store (lowercase, no `www.`), each with its locale-path
   * market (null when that host's market has none). Absolute links on any
   * other host are left alone.
   */
  hosts: ReadonlyMap<string, PathMarket | null>;
}

const PERMANENT = new Set([301, 308]);

const cleanHost = (h: string) => h.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');

function splitPath(s: string): { path: string; search: string; hash: string } {
  const hashAt = s.indexOf('#');
  const beforeHash = hashAt >= 0 ? s.slice(0, hashAt) : s;
  const hash = hashAt >= 0 ? s.slice(hashAt) : '';
  const q = beforeHash.indexOf('?');
  return q >= 0
    ? { path: beforeHash.slice(0, q), search: beforeHash.slice(q), hash }
    : { path: beforeHash, search: '', hash };
}

/** The proxy's lookup for one path (see `matchLocalePathRedirect` in proxy.ts). */
function lookup(ctx: RedirectLinkContext, path: string, market: PathMarket | null): RedirectHit | null {
  const m = market && usesLocalePaths(market) ? market : null;
  let hit = matchRedirectMap(ctx.map, path);
  if (hit && m) {
    hit = { ...hit, to: remapLegacyLocaleTarget(hit.to, m) };
  } else if (!hit && m) {
    const alias = legacyRedirectAlias(path, m);
    if (!alias) return null;
    const aliasHit = matchRedirectMap(ctx.map, alias.alias);
    if (!aliasHit) return null;
    hit = { ...aliasHit, to: rebaseAliasTarget(aliasHit.to, alias.entry, m) };
  }
  if (!hit) return null;
  // A target that is the link itself would loop: ignore it.
  const from = normalizeRedirectPath(path);
  if (from !== null && from === normalizeRedirectPath(hit.to)) return null;
  return hit;
}

/**
 * One link through the store's permanent redirects (see the module
 * comment). Returns the input string unchanged when nothing applies.
 */
export function canonicalizeRedirectLink(url: string, ctx: RedirectLinkContext): string {
  if (typeof url !== 'string' || ctx.map.size === 0) return url;
  const trimmed = url.trim();
  if (!trimmed || /\s/.test(trimmed)) return url;

  let origin = '';
  let rest = trimmed;
  let market = ctx.pathMarket;
  if (/^https?:\/\//i.test(trimmed)) {
    const raw = /^https?:\/\/[^/?#]*/i.exec(trimmed)?.[0];
    if (!raw) return url;
    let host: string;
    try {
      host = cleanHost(new URL(trimmed).hostname);
    } catch {
      return url;
    }
    if (!ctx.hosts.has(host)) return url;
    market = ctx.hosts.get(host) ?? null;
    origin = raw;
    rest = trimmed.slice(raw.length) || '/';
  } else if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return url;
  }

  const { path, search, hash } = splitPath(rest);
  const hit = lookup(ctx, path, market);
  if (!hit || !PERMANENT.has(hit.status) || !isSafeRedirectTarget(hit.to)) return url;
  let target = buildRedirectLocation(hit.to, search);
  if (hash && !target.includes('#')) target += hash;
  return `${origin}${target}`;
}

/** Every `href="..."` / `href='...'` value of owner HTML. */
export function canonicalizeRedirectHtml(html: string, ctx: RedirectLinkContext): string {
  if (typeof html !== 'string' || ctx.map.size === 0 || !/href/i.test(html)) return html;
  return html.replace(/(\shref\s*=\s*)(["'])([^"']*)\2/gi, (whole, attr: string, quote: string, value: string) => {
    const next = canonicalizeRedirectLink(value, ctx);
    return next === value ? whole : `${attr}${quote}${next}${quote}`;
  });
}

/** A string value of section content: HTML with hrefs, or one whole link. */
function canonicalizeString(value: string, ctx: RedirectLinkContext): string {
  if (/\shref\s*=/i.test(value)) return canonicalizeRedirectHtml(value, ctx);
  const t = value.trim();
  if (!(t.startsWith('/') || /^https?:\/\//i.test(t))) return value;
  return canonicalizeRedirectLink(value, ctx);
}

/** Copy-on-write deep walk: unchanged branches keep their identity. */
function walk(value: unknown, ctx: RedirectLinkContext): unknown {
  if (typeof value === 'string') return canonicalizeString(value, ctx);
  if (Array.isArray(value)) {
    let out: unknown[] | null = null;
    value.forEach((item, i) => {
      const next = walk(item, ctx);
      if (next !== item) {
        out ??= value.slice();
        out[i] = next;
      }
    });
    return out ?? value;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    let out: Record<string, unknown> | null = null;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      // Section identity and media fields are never links to rewrite.
      if (key === 'id' || key === 'section_key' || key === 'type') continue;
      const next = walk(item, ctx);
      if (next !== item) {
        out ??= { ...(value as Record<string, unknown>) };
        out[key] = next;
      }
    }
    return out ?? value;
  }
  return value;
}

/** Links of every section's settings and content rows (all themes). */
export function canonicalizeRedirectSections(sections: SectionInstance[], ctx: RedirectLinkContext): SectionInstance[] {
  if (ctx.map.size === 0) return sections;
  return walk(sections, ctx) as SectionInstance[];
}

/** `items[].url` of every menu. */
export function canonicalizeRedirectMenus(menus: NavMenu[], ctx: RedirectLinkContext): NavMenu[] {
  if (ctx.map.size === 0) return menus;
  let changed = false;
  const out = menus.map((menu) => {
    let itemsChanged = false;
    const items = (menu.items ?? []).map((item) => {
      const url = typeof item.url === 'string' ? canonicalizeRedirectLink(item.url, ctx) : item.url;
      if (url === item.url) return item;
      itemsChanged = true;
      return { ...item, url };
    });
    if (!itemsChanged) return menu;
    changed = true;
    return { ...menu, items };
  });
  return changed ? out : menus;
}
