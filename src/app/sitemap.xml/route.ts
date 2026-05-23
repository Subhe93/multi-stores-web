import { locales, defaultLocale } from '@/i18n/config';
import { legal, LEGAL_SLUGS } from '@/lib/api';

/**
 * Platform-level sitemap (served at the marketing-domain root). Lists the
 * landing page + the four legal pages, with hreflang alternates for every
 * supported locale. The default locale has NO prefix; secondary locales use
 * `/{locale}/...` (the form the proxy expects and Google prefers).
 *
 * The subdomain `/sitemap.xml` is rewritten to the store-scoped route.
 */

function xe(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function platformPath(origin: string, locale: string, path: string): string {
  const safePath = path === '/' ? '' : path;
  return locale === defaultLocale ? `${origin}${safePath}` : `${origin}/${locale}${safePath}`;
}

export async function GET() {
  const origin = (process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003').replace(/\/$/, '');

  // Pull the legal pages so the sitemap includes whatever the admin has shipped.
  let legalPaths: { slug: string; lastmod: Date }[] = [];
  try {
    const list = await legal.list(defaultLocale);
    legalPaths = LEGAL_SLUGS
      .filter((slug) => list.some((p) => p.slug === slug))
      .map((slug) => {
        const found = list.find((p) => p.slug === slug)!;
        return { slug, lastmod: new Date(found.updated_at) };
      });
  } catch {
    legalPaths = [];
  }

  function urlEntry(path: string, lastmod: Date): string {
    const canonical = platformPath(origin, defaultLocale, path);
    const alternates = locales
      .map(
        (loc) =>
          `    <xhtml:link rel="alternate" hreflang="${xe(loc)}" href="${xe(platformPath(origin, loc, path))}" />`,
      )
      .join('\n');
    return [
      '  <url>',
      `    <loc>${xe(canonical)}</loc>`,
      `    <lastmod>${lastmod.toISOString()}</lastmod>`,
      alternates,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${xe(canonical)}" />`,
      '  </url>',
    ].join('\n');
  }

  const entries: string[] = [];
  // Landing page
  entries.push(urlEntry('/', new Date()));
  // Legal pages
  for (const p of legalPaths) {
    entries.push(urlEntry(`/legal/${p.slug}`, p.lastmod));
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    entries.join('\n'),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}
