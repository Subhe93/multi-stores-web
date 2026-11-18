import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { categoryTilesSection } from './CategoryTiles';
import { classTokens, hrefs, imgAlts, imgTags, physicalClasses } from './_shared/testHelpers';

const CategoryTiles = categoryTilesSection.Component;

const DEFAULTS = { ...categoryTilesSection.defaultSettings };

function html(
  props: Partial<SectionRenderProps> & { settings?: Record<string, unknown>; content?: Record<string, unknown> },
) {
  return renderToStaticMarkup(
    <CategoryTiles locale="en" primaryLocale="en" storeSlug="demo" settings={DEFAULTS} content={{}} builderPreview={false} {...props} />,
  );
}

const ITEMS = [
  { image: '/uploads/pages/one.jpg', title: 'Clothing', subtitle: 'Everyday pieces', url: '/collections/clothing', alt: 'A folded shirt' },
  { image: '/uploads/pages/two.jpg', title: 'Jewellery', subtitle: 'Small things', url: 'https://example.org/jewellery' },
  { title: 'Gifts', subtitle: 'For everyone', url: '/collections/gifts' },
  { image: '/uploads/pages/four.jpg', title: 'No link' },
];
const CONTENT = { heading: 'Shop by category', subheading: 'Pick a range', items: ITEMS };

describe('category-tiles', () => {
  it('renders the heading, every title and its link', () => {
    const out = html({ content: CONTENT });
    expect(out).toMatch(/<h2[^>]*>Shop by category<\/h2>/);
    expect(out).toContain('Pick a range');
    for (const it of ITEMS) expect(out).toContain(it.title);
    expect(out.match(/<h3\b/g)).toHaveLength(4);
    // Tile titles keep the interface font.
    expect(out).toMatch(/<h3 data-text-look="body"/);
    expect(hrefs(out)).toEqual(['/collections/clothing', 'https://example.org/jewellery', '/collections/gifts']);
    // An item without a url is not a link.
    expect(out.match(/<a\b/g)).toHaveLength(3);
  });

  it('prefixes internal links on a secondary locale and leaves external ones alone', () => {
    const out = html({ content: CONTENT, locale: 'ar', primaryLocale: 'en' });
    expect(hrefs(out)).toEqual(['/ar/collections/clothing', 'https://example.org/jewellery', '/ar/collections/gifts']);
  });

  it('alt text is empty unless the owner wrote one', () => {
    expect(imgAlts(html({ content: CONTENT }))).toEqual(['A folded shirt', '', '']);
  });

  it('renders at most twelve tiles', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ title: `Tile ${i + 1}`, url: `/c/${i + 1}` }));
    const out = html({ content: { items: many } });
    expect(out.match(/<h3\b/g)).toHaveLength(12);
    expect(out).toContain('Tile 12');
    expect(out).not.toContain('Tile 13');
    const repeater = categoryTilesSection.schema.schema.find((f) => f.key === 'items');
    expect(repeater?.maxItems).toBe(12);
    expect(repeater?.fields?.map((f) => f.key)).toEqual(['image', 'title', 'subtitle', 'url', 'alt']);
  });

  it('counts an item only when it has a title or an image', () => {
    const out = html({ content: { items: [{ subtitle: 'orphan', url: '/x' }, null, 'bad', { title: 'Real' }] } });
    expect(out.match(/<h3\b/g)).toHaveLength(1);
    expect(out).not.toContain('orphan');
  });

  it('column counts as CSS variables, clamped to the allowed range', () => {
    const out = html({ content: CONTENT });
    expect(out).toContain('--cols-d:4;--cols-t:3;--cols-m:2');
    expect(classTokens(out)).toEqual(
      expect.arrayContaining([
        'grid-cols-[repeat(var(--cols-m),minmax(0,1fr))]',
        'md:grid-cols-[repeat(var(--cols-t),minmax(0,1fr))]',
        'lg:grid-cols-[repeat(var(--cols-d),minmax(0,1fr))]',
      ]),
    );
    const custom = html({ settings: { ...DEFAULTS, columns: 9, columns_tablet: 1, columns_mobile: 1 }, content: CONTENT });
    expect(custom).toContain('--cols-d:6;--cols-t:2;--cols-m:1');
    expect(imgTags(out)[0]).toContain('(max-width: 767px) 50vw, (max-width: 1023px) 34vw, 25vw');
    // Unset settings read as the stated defaults.
    expect(html({ settings: {}, content: CONTENT })).toContain('--cols-d:4;--cols-t:3;--cols-m:2');
  });

  it('caption style: surface card, arrow and rounded corners follow their switches', () => {
    const on = html({ content: CONTENT });
    expect(on).toContain('border-radius:var(--theme-radius-md);background-color:var(--theme-colors-surface)');
    // One arrow per linked tile, decorative and mirrored in right-to-left.
    expect(on.match(/<svg/g)).toHaveLength(3);
    expect(on).toMatch(/<span aria-hidden="true"[^>]*>\s*<svg/);
    expect(classTokens(on)).toContain('rtl:-scale-x-100');
    expect(on).toContain('background-color:var(--theme-colors-primary);color:var(--theme-colors-primaryContrast, #fff)');

    // Booleans left unset are off.
    const off = html({ settings: { card_style: 'caption' }, content: CONTENT });
    expect(off).not.toContain('<svg');
    expect(off).toContain('border-radius:0');
    expect(off).not.toContain('border-radius:0;background-color');
  });

  it('overlay style: text over the image with a dark scrim', () => {
    const out = html({ settings: { ...DEFAULTS, card_style: 'overlay', aspect: 'portrait' }, content: CONTENT });
    expect(out.match(/linear-gradient\(180deg, rgba\(0,0,0,0\) 40%, rgba\(0,0,0,0\.6\) 100%\)/g)).toHaveLength(3);
    expect(classTokens(out)).toContain('aspect-[4/5]');
    expect(out).toContain('color:#fff');
    // The item without an image keeps readable theme colours.
    expect(out).toMatch(/color:var\(--theme-colors-text\)[^>]*>Gifts/);
  });

  it('colour overrides', () => {
    const out = html({
      settings: { ...DEFAULTS, title_color: '#101010', subtitle_color: '#202020', arrow_bg_color: '#445566', arrow_color: '#000000', heading_color: '#303030' },
      content: CONTENT,
    });
    for (const c of ['#101010', '#202020', '#303030']) expect(out).toContain(`color:${c}`);
    expect(out).toContain('background-color:#445566;color:#000000');
  });

  it('heading: centred by default, optional rules, start alignment', () => {
    const centred = html({ content: CONTENT });
    expect(classTokens(centred)).toContain('text-center');
    expect(centred).not.toContain('max-w-24');
    const ruled = html({ settings: { ...DEFAULTS, heading_rule: true }, content: CONTENT });
    expect(ruled.match(/<span aria-hidden="true" class="h-px flex-1 max-w-24"/g)).toHaveLength(2);
    const start = html({ settings: { ...DEFAULTS, heading_align: 'start', heading_rule: true }, content: CONTENT });
    expect(classTokens(start)).toContain('text-start');
    // Rules only beside a centred heading.
    expect(start).not.toContain('max-w-24');
    expect(html({ settings: { ...DEFAULTS, heading_level: 'h3' }, content: CONTENT })).toMatch(/<h3[^>]*>Shop by category<\/h3>/);
  });

  it('mobile scroll: one snap row below 768px with a matching sizes hint', () => {
    const out = html({ settings: { ...DEFAULTS, mobile_scroll: true }, content: CONTENT });
    expect(classTokens(out)).toEqual(
      expect.arrayContaining(['max-md:flex', 'max-md:overflow-x-auto', 'max-md:snap-x', 'max-md:basis-[62%]', 'max-md:snap-start']),
    );
    expect(imgTags(out)[0]).toContain('(max-width: 767px) 62vw');
    expect(classTokens(html({ content: CONTENT }))).not.toContain('max-md:flex');
    // The row cancels the page gutter at both mobile widths (16px, 24px from 640px).
    expect(classTokens(out)).toEqual(
      expect.arrayContaining(['[--g:1rem]', 'sm:[--g:1.5rem]', 'max-md:mx-[calc(var(--g)*-1)]', 'max-md:px-[var(--g)]']),
    );
    expect(classTokens(out)).not.toContain('max-md:-mx-4');
  });

  it('a linked tile with no title, subtitle or alt text still has a name', () => {
    const out = html({ content: { items: [{ image: '/uploads/pages/one.jpg', url: '/collections/a' }] } });
    expect(out).toMatch(/<a\b[^>]*aria-label="sections\.viewDetails"/);
    // A title, a subtitle or an alt text names the link: no generic label.
    for (const extra of [{ title: 'Clothing' }, { subtitle: 'Everyday pieces' }, { alt: 'A folded shirt' }]) {
      const named = html({ content: { items: [{ image: '/uploads/pages/one.jpg', url: '/collections/a', ...extra }] } });
      expect(named, JSON.stringify(extra)).not.toContain('aria-label');
    }
    // No link, no label.
    expect(html({ content: { items: [{ image: '/uploads/pages/one.jpg' }] } })).not.toContain('aria-label');
  });

  it('the image zooms on hover only when the tile is a link', () => {
    const zoom = 'motion-safe:group-hover:scale-[1.03]';
    const imgs = imgTags(html({ content: CONTENT }));
    // ITEMS: two linked tiles with an image, then one image without a link.
    expect(imgs.map((img) => img.includes(zoom))).toEqual([true, true, false]);
    const overlay = imgTags(html({ settings: { ...DEFAULTS, card_style: 'overlay' }, content: CONTENT }));
    expect(overlay.map((img) => img.includes(zoom))).toEqual([true, true, false]);
  });

  it('every link has a visible focus ring', () => {
    const out = html({ content: CONTENT });
    const anchors = [...out.matchAll(/<a\b[^>]*class="([^"]*)"/g)].map((m) => m[1]);
    expect(anchors).toHaveLength(3);
    for (const cls of anchors) expect(cls).toContain('focus-visible:outline-2');
  });

  it('empty: nothing on the live store, a placeholder in the builder', () => {
    expect(html({ content: {} })).toBe('');
    expect(html({ content: { heading: 'Only a heading', items: [] } })).toBe('');
    const preview = html({ content: {}, builderPreview: true });
    expect(preview).toContain('sections.empty.categoryTiles');
    expect(preview).toContain('1px dashed var(--theme-colors-border)');
  });

  it('one item is one tile in the first track', () => {
    const out = html({ content: { items: [ITEMS[0]] } });
    expect(out.match(/data-stagger-item/g)).toHaveLength(1);
    expect(out).toContain('--cols-d:4');
  });

  it('uses no physical direction classes', () => {
    for (const card_style of ['caption', 'overlay']) {
      const out = html({
        settings: { ...DEFAULTS, card_style, mobile_scroll: true, heading_rule: true },
        content: CONTENT,
        locale: 'ar',
        primaryLocale: 'en',
      });
      expect(physicalClasses(out)).toEqual([]);
    }
    expect(physicalClasses(html({ content: {}, builderPreview: true }))).toEqual([]);
  });
});

// ── Manual line breaks in the heading ───────────────────────────────────

describe('category-tiles manual line breaks', () => {
  const TWO = 'Shop\nby category';
  const ONE = 'Shop by category';
  // The heading tag as it rendered before line breaks were supported.
  const H2_OPEN =
    '<h2 data-text-look="heading" style="font-family:var(--theme-font-heading);font-size:var(--theme-scale-h2);font-weight:var(--theme-weight-heading);line-height:var(--theme-line-heading);letter-spacing:var(--theme-tracking-heading);color:var(--theme-colors-text)">';
  const SETTINGS: Array<[string, Record<string, unknown>]> = [
    ['centred', DEFAULTS],
    ['start aligned', { ...DEFAULTS, heading_align: 'start' }],
    ['with rules', { ...DEFAULTS, heading_rule: true }],
  ];

  for (const [name, settings] of SETTINGS) {
    it(`${name}: keeps the typed breaks as one text node with white-space: pre-line`, () => {
      const out = html({ settings, content: { ...CONTENT, heading: TWO } });
      expect(out).toContain(
        `${H2_OPEN.replace('color:var(--theme-colors-text)"', 'color:var(--theme-colors-text);white-space:pre-line"')}${TWO}</h2>`,
      );
      expect(out).not.toContain('<br');
      expect(out.match(/white-space:pre-line/g)).toHaveLength(1);
      // The only difference from the same text on one line.
      const one = html({ settings, content: { ...CONTENT, heading: ONE } });
      expect(out.replace(';white-space:pre-line', '').replace(TWO, ONE)).toBe(one);
    });

    it(`${name}: a single-line heading renders exactly the markup it always did`, () => {
      const out = html({ settings, content: CONTENT });
      expect(out).not.toContain('white-space');
      expect(out).toContain(`${H2_OPEN}${ONE}</h2>`);
    });
  }

  it('line ends are normalized and markup typed in the heading is escaped', () => {
    const out = html({ content: { ...CONTENT, heading: ' One <b>x</b> \r\n\r\n two\n3\n4\n5 ' } });
    expect(out).toContain('>One &lt;b&gt;x&lt;/b&gt;\ntwo\n3\n4 5</h2>');
    expect(out).not.toContain('<b>');
    expect(out).not.toContain('<br');
    expect(out).not.toContain('\r');
  });

  it('only the section heading: a break in a subheading or a tile title is not kept', () => {
    const out = html({
      content: { heading: ONE, subheading: 'Pick\na range', items: [{ title: 'Clo\nthing', url: '/c' }] },
    });
    expect(out).not.toContain('pre-line');
    expect(out).not.toContain('<br');
  });

  it('schema: the heading is a textarea, its limit unchanged', () => {
    const field = categoryTilesSection.schema.schema.find((f) => f.key === 'heading');
    expect(field).toMatchObject({ type: 'textarea', maxLength: 120 });
  });
});
