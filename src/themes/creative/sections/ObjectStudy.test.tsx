import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProductContext, SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
// The VAT note reads the store providers; its own behaviour is tested elsewhere.
vi.mock('@/components/product/PriceTaxSuffix', () => ({
  PriceTaxSuffix: ({ className }: { className?: string }) => <span className={className}>vat-note</span>,
}));

import { classTokens, hrefs, imgAlts, physicalClasses } from '../../minimal/sections/_shared/testHelpers';
import { G } from '../css/base.css';
import { OBJECT_STUDY_CSS } from '../css/objectStudy.css';
import { entry } from '../schemas/object-study.schema';
import { objectStudySection, productSlugFromUrl } from './ObjectStudy';
import { resolveMediaUrl } from '@/lib/api';

const ObjectStudy = objectStudySection.Component;

function html(props: Partial<SectionRenderProps> = {}) {
  const markup = renderToStaticMarkup(
    <ObjectStudy locale="en" primaryLocale="en" storeSlug="demo" settings={{}} content={{}} {...props} />,
  );
  // Without the hoisted <style> blocks and the flag script.
  return markup.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
}

const count = (markup: string, re: RegExp) => (markup.match(re) || []).length;
const textOf = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const SETTINGS = { ...entry.defaultSettings, product_url: '/products/stone-pendant' };
const NOTES = [
  { title: 'The stone', text: 'A single stone at the centre.', x: 51, y: 52 },
  { title: 'The metalwork', text: 'Fine repeated motifs.', x: 26, y: 42 },
  { title: 'The drops', text: 'A row of small drops.', x: 24, y: 77 },
];
const CONTENT = {
  plate_label: 'Object 01',
  category_label: 'Jewelry',
  body: 'A pendant to be looked at slowly.',
  cta_text: 'View the pendant',
  notes: NOTES,
};
const PRELOADED = {
  products: {
    'stone-pendant': {
      slug: 'stone-pendant',
      title: 'Stone Pendant',
      url: '/products/stone-pendant',
      image: '/uploads/pendant.webp',
      price: 52,
      currency: 'EUR',
      available: true,
    },
  },
};

describe('object-study', () => {
  it('schema: keys, order, defaults and page types of the spec', () => {
    expect(entry.schema.id).toBe('object-study');
    expect(entry.schema.schema.map((f) => f.key)).toEqual([
      'plate_label', 'category_label', 'heading', 'body', 'cta_text', 'alt', 'notes',
      'product_url', 'image', 'aspect', 'fit', 'bg_color', 'ground_color', 'text_color', 'line_color', 'show_price',
    ]);
    const notes = entry.schema.schema.find((f) => f.key === 'notes')!;
    expect(notes.maxItems).toBe(4);
    expect(notes.fields!.map((f) => [f.key, f.type])).toEqual([
      ['title', 'text'], ['text', 'textarea'], ['x', 'number'], ['y', 'number'],
    ]);
    expect(entry.schema.translatable).toEqual(['plate_label', 'category_label', 'heading', 'body', 'cta_text', 'alt', 'notes']);
    expect(entry.defaultSettings).toEqual({ aspect: 'portrait', fit: 'contain', show_price: true });
    expect(entry.defaultContent).toEqual({});
    expect(entry.schema.pageTypes).toEqual(['HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE']);
    expect(objectStudySection.needsBuilderPreview).toBe(true);
  });

  it('without motion: complete text, title, photograph and price from the live product, no motion attribute', () => {
    const out = html({ settings: SETTINGS, content: CONTENT, preloaded: PRELOADED });
    expect(out).toContain('data-cx-section="object-study"');
    expect(out).not.toMatch(/data-cx-(reveal|intro|hover|behavior|magnetic|item|i|d)=/);
    const text = textOf(out);
    for (const piece of ['Object 01', 'Jewelry', 'Stone Pendant', 'A pendant to be looked at slowly.', 'View the pendant', '€52.00', 'vat-note']) {
      expect(text).toContain(piece);
    }
    for (const n of NOTES) expect(text).toContain(`${n.title} ${n.text}`);
    expect(out).toMatch(/<h2 class="cx-os-h">Stone Pendant<\/h2>/);
    expect(imgAlts(out)).toEqual(['Stone Pendant']);
    expect(out).toContain('pendant.webp');
    expect(hrefs(out)).toEqual(['/products/stone-pendant']);
    expect(text).not.toContain('product.outOfStock');
    expect(out).toContain('data-cx-aspect="portrait"');
    expect(out).toContain('data-cx-fit="contain"');
  });

  it('notes: physical points, side by x, a leader per note, numbers on the points', () => {
    const out = html({ settings: SETTINGS, content: CONTENT, preloaded: PRELOADED });
    expect(count(out, /<li class="cx-os-note"/g)).toBe(3);
    expect([...out.matchAll(/data-cx-side="(left|right)" style="--cx-os-ny:([\d.]+)%"/g)].map((x) => [x[1], x[2]])).toEqual([
      ['right', '52'], ['left', '42'], ['left', '77'],
    ]);
    expect(out).toContain('<span class="cx-os-dot" aria-hidden="true" style="left:26%;top:42%"><span class="cx-os-dot-n">2</span></span>');
    // Straight leaders: one stroke on the plate to the nearer edge, one in the gutter.
    expect(count(out, /<line class="cx-os-l"/g)).toBe(6);
    expect(out).toMatch(/<line class="cx-os-l" x1="26%" y1="42%" x2="0%" y2="42%" pathLength="1"/);
    expect(out).toMatch(/<line class="cx-os-l" x1="51%" y1="52%" x2="100%" y2="52%" pathLength="1"/);
    expect(out).toMatch(/<svg x="100%" overflow="visible"><line class="cx-os-l" x1="0" y1="52%" x2="24" y2="52%"/);
    expect(out).toMatch(/<svg x="0" overflow="visible"><line class="cx-os-l" x1="0" y1="42%" x2="-24" y2="42%"/);
    expect(out).toMatch(/<div class="cx-os-lines" aria-hidden="true"><svg focusable="false">/);
    // Nothing is scaled: the drawing has no viewBox.
    expect(out).not.toContain('viewBox');
  });

  it('two close notes of one side: the lower one moves down and its leader is an elbow; at most 4 notes', () => {
    const out = html({
      settings: SETTINGS,
      content: {
        notes: [
          { title: 'A', x: 20, y: 40 },
          { title: 'B', x: 30, y: 48 },
          { title: 'C', x: 80, y: 20 },
          { title: 'D', x: 80, y: 60 },
          { title: 'E', x: 80, y: 90 },
          { text: '' },
        ],
      },
      preloaded: PRELOADED,
    });
    expect(count(out, /<li class="cx-os-note"/g)).toBe(4);
    expect(out).toMatch(/data-cx-side="left" style="--cx-os-ny:55%"/);
    expect(out).toMatch(/x1="-12" y1="48%" x2="-12" y2="55%"/);
    expect(textOf(out)).not.toContain('E');
  });

  it('with motion: the recipes of the spec on the named elements', () => {
    const out = html({ settings: SETTINGS, content: CONTENT, preloaded: PRELOADED, motion: 'scroll' });
    expect(out).toMatch(/<div class="cx-os-head" data-cx-reveal="fade" data-cx-d="2">/);
    expect(out).toMatch(/<div class="cx-os-rule" data-cx-reveal="line">/);
    expect(out).toMatch(/<div class="cx-mask" data-cx-reveal="mask" data-cx-dir="up"/);
    expect(out).toMatch(/<div class="cx-os-lines" aria-hidden="true" data-cx-reveal="fade">/);
    expect(count(out, /class="cx-os-dot" aria-hidden="true" style="[^"]*" data-cx-reveal="fade" data-cx-d="10"/g)).toBe(3);
    expect(out).toMatch(/data-cx-side="left" style="--cx-os-ny:42%" data-cx-reveal="rise" data-cx-i="1" data-cx-d="12"/);
    expect(out).toMatch(/<h2 class="cx-os-h"><span class="cx-ht" data-cx-reveal="words">/);
    expect(out).toMatch(/<p class="cx-os-body" data-cx-reveal="rise" data-cx-i="1">/);
    expect(out).toMatch(/<div class="cx-os-row" data-cx-reveal="rise" data-cx-i="2">/);
    // The button leads to buying: press only, never magnetic.
    expect(out).toMatch(/<a class="cx-btn cx-os-btn" data-cx-tone="accent" href="\/products\/stone-pendant" data-cx-hover="press">/);
    expect(out).not.toContain('data-cx-magnetic');
    expect(textOf(out)).toContain('Stone Pendant');

    const intro = html({ settings: SETTINGS, content: CONTENT, preloaded: PRELOADED, motion: 'intro' });
    expect(intro).toMatch(/<div class="cx-os-rule" data-cx-intro="rule">/);
    expect(intro).toMatch(/<div class="cx-mask" data-cx-intro="scale"/);
    expect(intro).not.toContain('data-cx-reveal');
  });

  it('the price is only the live one; manual texts work without live data', () => {
    const manual = html({
      settings: { ...SETTINGS, image: '/uploads/own.jpg' },
      content: { ...CONTENT, heading: 'Own title', alt: 'Own alt' },
    });
    expect(textOf(manual)).toContain('Own title');
    expect(imgAlts(manual)).toEqual(['Own alt']);
    expect(manual).toContain('own.jpg');
    expect(manual).not.toMatch(/cx-os-price|€|vat-note/);
    expect(hrefs(manual)).toEqual(['/products/stone-pendant']);

    const hidden = html({ settings: { ...SETTINGS, show_price: false }, content: CONTENT, preloaded: PRELOADED });
    expect(hidden).not.toMatch(/cx-os-price|€/);

    const sale = html({
      settings: SETTINGS,
      content: CONTENT,
      preloaded: { products: { 'stone-pendant': { ...PRELOADED.products['stone-pendant'], compareAt: 60, available: false } } },
    });
    expect(textOf(sale)).toContain('€52.00 €60.00 vat-note product.outOfStock');
  });

  it('on a product template an empty link means the product of the page', () => {
    const product: ProductContext = {
      id: 'p1',
      base_price: 40,
      translations: [
        { locale: 'en', title: 'Page product', slug: 'page-product' },
        { locale: 'ar', title: 'منتج الصفحة', slug: 'page-product' },
      ],
      images: [
        { url: '/uploads/second.jpg', sort_order: 1 },
        { url: '/uploads/first.jpg', sort_order: 0 },
      ],
    };
    const out = html({ settings: { ...entry.defaultSettings }, content: { cta_text: 'View' }, product, currency: 'SEK' });
    expect(textOf(out)).toContain('Page product');
    expect(out).toContain('first.jpg');
    expect(textOf(out)).toContain('SEK');
    // Already on that page: no link to itself.
    expect(hrefs(out)).toEqual([]);
    expect(textOf(html({ settings: {}, content: {}, product, locale: 'ar' }))).toContain('منتج الصفحة');
  });

  it('empty: nothing on the store, the empty state in the builder', () => {
    expect(html()).toBe('');
    expect(html({ settings: SETTINGS, content: CONTENT })).toBe('');
    const preview = html({ builderPreview: true });
    expect(preview).toContain('data-cx-empty="object-study"');
    expect(preview).toContain('creative.empty.objectStudy');
  });

  it('product links: only /products/<slug>, with an optional locale prefix or query', () => {
    expect(productSlugFromUrl('/products/stone-pendant')).toBe('stone-pendant');
    expect(productSlugFromUrl('/ar/products/stone-pendant?ref=home')).toBe('stone-pendant');
    expect(productSlugFromUrl('/collections/jewelry')).toBeNull();
    expect(productSlugFromUrl('https://example.com/products/x')).toBeNull();
    expect(productSlugFromUrl(undefined)).toBeNull();
  });

  it('Arabic: same points and sides, nothing mirrored, logical classes only', () => {
    const props = { settings: SETTINGS, content: CONTENT, preloaded: PRELOADED };
    const en = html(props);
    const ar = html({ ...props, locale: 'ar', content: { ...CONTENT, plate_label: 'القطعة 01', heading: 'قلادة الحجر الأزرق' } });
    expect(physicalClasses(ar)).toEqual([]);
    expect(ar).not.toMatch(/scaleX\(-1\)|scale-x/);
    const geometry = (m: string) => [...m.matchAll(/<line[^>]*>|data-cx-side="[^"]*"|style="left:[^"]*"/g)].map((x) => x[0]);
    expect(geometry(ar)).toEqual(geometry(en));
    // Arabic labels and headings: no letter spacing, own line height; never split into characters.
    expect(ar).toMatch(/<p class="cx-os-label" data-cx-script="arabic">القطعة 01<\/p>/);
    expect(ar).toMatch(/<h2 class="cx-os-h" data-cx-script="arabic">قلادة الحجر الأزرق<\/h2>/);
    const foreign = classTokens(ar).filter((c) => !c.startsWith('cx-'));
    expect(foreign).toEqual([]);
    expect(OBJECT_STUDY_CSS).not.toMatch(/scaleX\(-1\)/);
  });

  it('the hidden start of the lines exists only behind the gate, keyed on the reveal state', () => {
    const hidden = OBJECT_STUDY_CSS.split('}').filter((rule) => /stroke-dashoffset:1/.test(rule) && !rule.includes('from{'));
    expect(hidden).toHaveLength(1);
    expect(hidden[0]).toContain(`${G} .cx-os-lines[data-cx-state="pending"] .cx-os-l`);
    for (const rule of OBJECT_STUDY_CSS.split('}').filter((r) => /stroke-dasharray:1|animation:cx-os-draw/.test(r))) {
      expect(rule.startsWith(G) || rule.includes(`{${G}`)).toBe(true);
    }
  });

  it('resolves root-relative upload paths (own image and live product image) through the media origin', () => {
    const own = html({ settings: { ...SETTINGS, image: '/uploads/x.webp' }, content: CONTENT, preloaded: PRELOADED });
    expect(own).not.toContain('url=%2Fuploads');
    expect(own).toContain(encodeURIComponent(resolveMediaUrl('/uploads/x.webp')));
    const live = html({ settings: SETTINGS, content: CONTENT, preloaded: PRELOADED });
    expect(live).not.toContain('url=%2Fuploads');
    expect(live).toContain(encodeURIComponent(resolveMediaUrl('/uploads/pendant.webp')));
  });
});
