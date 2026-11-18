import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
// The VAT note reads the store providers; here it is a plain marker.
vi.mock('@/components/product/PriceTaxSuffix', () => ({
  PriceTaxSuffix: ({ className }: { className?: string }) => <span className={className}>VAT</span>,
}));

import { hrefs, imgAlts, physicalClasses } from '../../minimal/sections/_shared/testHelpers';
import { G } from '../css/base.css';
import { LOOK_SPREAD_CSS } from '../css/lookSpread.css';
import { entry } from '../schemas/look-spread.schema';
import { lookSpreadSection, productSlugFromUrl } from './LookSpread';

const LookSpread = lookSpreadSection.Component;

function html(props: Partial<SectionRenderProps> = {}) {
  const markup = renderToStaticMarkup(
    <LookSpread locale="en" primaryLocale="en" storeSlug="demo" settings={{}} content={{}} {...props} />,
  );
  return markup.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
}

const SETTINGS = { ...entry.defaultSettings, image_a: '/uploads/a.webp', image_b: '/uploads/b.webp', link_url: '/collections/x' };
const CONTENT = {
  eyebrow: 'The look',
  heading: 'Worn for the day.',
  note: 'Outfits and what completes them.',
  link_label: 'Shop all',
  alt_a: 'Alt A',
  alt_b: 'Alt B',
  items: [
    { url: '/products/dress', photo: 'a', x: 52, y: 46 },
    { url: '/products/suit', photo: 'b', x: '50', y: '44', title: 'Manual suit' },
    { url: '/products/earrings', photo: 'none', note: 'Complete the look' },
    { url: '/products/unknown' },
  ],
};
const PRELOADED = {
  products: {
    dress: { slug: 'dress', title: 'Live dress', url: '/products/dress', image: '/uploads/dress.webp', price: 149, currency: 'SEK' },
    suit: { slug: 'suit', title: 'Live suit', url: '/products/suit', price: 120, currency: 'SEK', available: false },
    earrings: { slug: 'earrings', title: 'Live earrings', url: '/products/earrings', image: '/uploads/ear.webp', price: 35, currency: 'SEK' },
  },
};
const count = (markup: string, re: RegExp) => (markup.match(re) || []).length;
const MOTION_ATTR = /data-cx-(reveal|intro|behavior|hover|item|magnetic|drift|i|d)\b/;

describe('look-spread', () => {
  it('without motion: complete content, no reveal or behaviour attribute, no island', () => {
    const out = html({ settings: SETTINGS, content: CONTENT, preloaded: PRELOADED });
    expect(out).toContain('data-cx-section="look-spread"');
    expect(out).not.toMatch(MOTION_ATTR);
    for (const text of ['The look', 'Worn for the day.', 'Outfits and what completes them.', 'Live dress', 'Manual suit', 'Live earrings', 'Complete the look', 'Shop all']) {
      expect(out).toContain(text);
    }
    expect(imgAlts(out).slice(0, 2)).toEqual(['Alt A', 'Alt B']);
    expect(out).toMatch(/<h2 class="cx-ls-heading">Worn for the day\.<\/h2>/);
  });

  it('markers are anchors to their rows; rows without a marker show a diamond; unknown rows are skipped', () => {
    const out = html({ settings: SETTINGS, content: CONTENT, preloaded: PRELOADED });
    // The fourth item has neither a manual title nor live data.
    expect(count(out, /<li /g)).toBe(3);
    const markers = [...out.matchAll(/<a class="cx-ls-m" href="#([^"]+)" aria-label="([^"]+)" data-ls-n="(\d)" style="([^"]+)"/g)];
    expect(markers.map((m) => m[2])).toEqual(['1. Live dress', '2. Manual suit']);
    expect(markers.map((m) => m[4])).toEqual(['left:52%;top:46%', 'left:50%;top:44%']);
    for (const m of markers) expect(out).toContain(`<li id="${m[1]}" class="cx-ls-row" data-ls-n="${m[3]}"`);
    expect(count(out, /class="cx-ls-num"/g)).toBe(2);
    expect(count(out, /class="cx-ls-dot"/g)).toBe(1);
    // The whole row is one link to the product; then the collection link.
    expect(hrefs(out).filter((h) => !h.startsWith('#'))).toEqual(['/products/dress', '/products/suit', '/products/earrings', '/collections/x']);
  });

  it('prices come from live data only; sold out keeps the price and adds the card string', () => {
    const live = html({ settings: SETTINGS, content: CONTENT, preloaded: PRELOADED });
    expect(count(live, /class="cx-ls-price"/g)).toBe(3);
    expect(live).toContain('SEK');
    expect(live).toContain('149.00');
    expect(count(live, /product\.soldOut/g)).toBe(1);
    expect(count(live, /class="cx-ls-vat"/g)).toBe(3);

    const manual = html({ settings: SETTINGS, content: CONTENT });
    // Only the row with a manual title remains, without any price.
    expect(count(manual, /<li /g)).toBe(1);
    expect(manual).toContain('Manual suit');
    expect(manual).not.toMatch(/cx-ls-price|cx-ls-vat|SEK|product\.soldOut/);
  });

  it('renders at most six rows; a marker needs its photograph and both coordinates', () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ title: `Piece ${i + 1}`, photo: 'a', x: 10 * i, y: 50 }));
    const out = html({ settings: SETTINGS, content: { items } });
    expect(count(out, /<li /g)).toBe(6);
    expect(count(out, /class="cx-ls-m"/g)).toBe(6);
    expect(out).not.toContain('Piece 7');

    const loose = html({
      settings: { ...SETTINGS, image_b: '' },
      content: { items: [{ title: 'On B', photo: 'b', x: 5, y: 5 }, { title: 'No y', photo: 'a', x: 5 }, { title: 'Off', photo: 'a', x: 140, y: 5 }] },
    });
    expect(count(loose, /class="cx-ls-m"/g)).toBe(0);
    expect(count(loose, /class="cx-ls-dot"/g)).toBe(3);
    expect(loose).not.toContain('data-cx-b');
  });

  it('with motion "scroll": the recipes of the spec on the named elements', () => {
    const out = html({ settings: SETTINGS, content: CONTENT, preloaded: PRELOADED, motion: 'scroll' });
    expect(out).toMatch(/<p class="cx-ls-label" data-cx-reveal="rise">/);
    expect(out).toMatch(/<h2 class="cx-ls-heading"><span class="cx-ht" data-cx-reveal="words">/);
    expect(out).toMatch(/<p class="cx-ls-note" data-cx-reveal="rise" data-cx-i="2">/);
    expect(out).toMatch(/class="cx-mask" data-cx-reveal="mask" data-cx-dir="end"/);
    expect(out).toMatch(/class="cx-mask" data-cx-reveal="mask" data-cx-dir="up" style="[^"]*--cx-delay:\.2s/);
    expect(out).toMatch(/<div class="cx-ls-b" data-cx-behavior="scrub" data-cx-drift="" data-cx-y="-6">/);
    // Markers fade one by one after the masks.
    expect(out).toMatch(/data-ls-n="1" style="[^"]*" data-cx-reveal="fade" data-cx-d="9"/);
    expect(out).toMatch(/data-ls-n="2" style="[^"]*" data-cx-reveal="fade" data-cx-d="10"/);
    expect(out).toMatch(/<ol class="cx-ls-list" data-cx-reveal="stagger">/);
    expect(count(out, /class="cx-ls-row" data-ls-n="\d" data-cx-item=""/g)).toBe(3);
    expect(count(out, /class="cx-ls-hair" aria-hidden="true" data-cx-reveal="line"/g)).toBe(3);
    expect(count(out, /class="cx-ls-thumb" data-cx-hover="media"/g)).toBe(3);
    expect(out).toMatch(/class="cx-ls-more-l" data-cx-hover="underline"/);
    // No loop, no pulse, no magnetic pull on a buying link.
    expect(out).not.toMatch(/data-cx-loop|data-cx-magnetic/);
  });

  it('with motion "intro": intro kinds, no scroll reveal', () => {
    const out = html({ settings: SETTINGS, content: CONTENT, preloaded: PRELOADED, motion: 'intro' });
    expect(out).toMatch(/<p class="cx-ls-label" data-cx-intro="rise">/);
    expect(out).toContain('data-cx-intro="words"');
    expect(out).toContain('data-cx-intro="scale"');
    expect(out).not.toContain('data-cx-reveal');
  });

  it('empty: nothing on the store, the empty state in the builder preview', () => {
    expect(html()).toBe('');
    expect(html({ settings: { ...entry.defaultSettings }, content: { note: 'only a note', link_label: 'x' } })).toBe('');
    const preview = html({ builderPreview: true });
    expect(preview).toContain('data-cx-empty="look-spread"');
    expect(preview).toContain('creative.empty.lookSpread');
  });

  it('Arabic: same markup, physical marker positions, nothing mirrored, logical classes only', () => {
    const en = html({ settings: SETTINGS, content: CONTENT, preloaded: PRELOADED });
    const ar = html({ settings: SETTINGS, content: CONTENT, preloaded: PRELOADED, locale: 'ar' });
    expect(physicalClasses(ar)).toEqual([]);
    expect(ar).not.toMatch(/scaleX\(-1\)|scale-x/);
    const positions = (m: string) => [...m.matchAll(/style="(left:[^"]+)"/g)].map((x) => x[1]);
    expect(positions(ar)).toEqual(positions(en));
    // Secondary locale: internal links carry the locale.
    expect(hrefs(ar).some((h) => h.includes('ar'))).toBe(true);
    // Photographs are not flipped by the stylesheet; only the arrow glyph is.
    expect(LOOK_SPREAD_CSS).not.toMatch(/\.cx-ls-(img|frame|a|b|bframe|m|mi)\{[^}]*scale:-1/);
    const source = readFileSync('src/themes/creative/sections/LookSpread.tsx', 'utf8');
    expect(source).not.toMatch(/\b(?:left-|right-|ml-|mr-|pl-|pr-|text-left|text-right)/);
  });

  it('own CSS: hiding and hover live behind the gate; hover pairs exist for six rows', () => {
    const rules = LOOK_SPREAD_CSS.split('}');
    const hidden = rules.filter((r) => /background-color:transparent/.test(r));
    expect(hidden).toHaveLength(1);
    expect(hidden[0]).toContain(`${G} .cx-ls-bframe:has([data-cx-reveal="mask"][data-cx-state="pending"])`);
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(LOOK_SPREAD_CSS).toContain(`${G} .cx-ls:has(.cx-ls-row[data-ls-n="${n}"]:is(:hover,:focus-within)) .cx-ls-m[data-ls-n="${n}"] .cx-ls-mi`);
    }
    for (const r of rules.filter((x) => /scale:1\.18|translate:-?4px 0/.test(x) && !/cx-ls-arrow/.test(x))) expect(r).toContain('html[data-cx-motion] .store-root');
  });

  it('colours are per-instance variables; the list can sit at the start', () => {
    const out = html({
      settings: { ...SETTINGS, list_side: 'start', bg_color: '#FFFFFF', marker_color: '#B60018', marker_text_color: '#FFF', text_color: '#111' },
      content: CONTENT,
    });
    expect(out).toContain('--cx-ls-bg:#FFFFFF');
    expect(out).toContain('--cx-ls-mark:#B60018');
    expect(out).toContain('--cx-ls-mark-text:#FFF');
    expect(out).toContain('--cx-ls-text:#111');
    expect(out).toContain('data-cx-list="start"');
    expect(out).toContain('data-cx-b=""');
  });

  it('product slug from a url', () => {
    expect(productSlugFromUrl('/products/blue-stone')).toBe('blue-stone');
    expect(productSlugFromUrl('/sv/products/blue-stone?x=1')).toBe('blue-stone');
    expect(productSlugFromUrl('/collections/blue')).toBeNull();
    expect(productSlugFromUrl('https://x.test/products/a')).toBeNull();
    expect(productSlugFromUrl(4)).toBeNull();
  });

  it('schema: keys, order and defaults of the spec', () => {
    const { schema } = entry;
    expect(schema.id).toBe('look-spread');
    expect(schema.icon).toBe('scan-eye');
    expect(schema.category).toBe('commerce');
    expect(schema.pageTypes).toEqual(['HOME', 'STATIC', 'LANDING']);
    expect(schema.translatable).toEqual(['eyebrow', 'heading', 'note', 'link_label', 'alt_a', 'alt_b', 'items']);
    expect(schema.schema.map((f) => f.key)).toEqual([
      'eyebrow', 'heading', 'note', 'link_label', 'alt_a', 'alt_b', 'items',
      'image_a', 'image_b', 'link_url', 'list_side', 'bg_color', 'text_color', 'marker_color', 'marker_text_color',
    ]);
    const items = schema.schema.find((f) => f.key === 'items')!;
    expect(items.maxItems).toBe(6);
    expect(items.fields!.map((f) => `${f.key}:${f.type}`)).toEqual([
      'url:url', 'title:text', 'note:text', 'image:image', 'photo:select', 'x:number', 'y:number',
    ]);
    expect(items.fields!.find((f) => f.key === 'x')!.showIf).toEqual({ key: 'photo', in: ['a', 'b'] });
    expect(entry.defaultSettings).toEqual({ list_side: 'end' });
    expect(entry.defaultContent).toEqual({});
    for (const f of [...schema.schema, ...items.fields!]) expect(f.label.en && f.label.ar).toBeTruthy();
  });
});
