import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
// The VAT note reads store providers; here it is a fixed marker.
vi.mock('@/components/product/PriceTaxSuffix', () => ({
  PriceTaxSuffix: ({ className }: { className?: string }) => <span className={className}>VAT-NOTE</span>,
}));

import { classTokens, hrefs, imgTags, physicalClasses } from '../../minimal/sections/_shared/testHelpers';
import { G } from '../css/base.css';
import { COVER_HERO_CSS } from '../css/coverHero.css';
import { COVER_HERO_TRANSLATABLE, entry } from '../schemas/cover-hero.schema';
import { contrastOn, coverEdgeCss, coverFocus, coverHeroSection, coverMedia, coverProductSlug } from './CoverHero';

const CoverHero = coverHeroSection.Component;

const SVG = 'data:image/svg+xml;base64,PHN2Zy8+';
const SETTINGS = {
  ...entry.defaultSettings,
  image: 'https://cdn.example.com/large.webp',
  image_focus_x: 'right',
  detail_image: 'https://cdn.example.com/small.webp',
  detail_url: '/products/cuff',
  seal_image: SVG,
  edge_image: SVG,
  cta_url: '/products',
  cta_secondary_url: '/about',
};
const CONTENT = {
  masthead_start: 'Start label',
  masthead_end: 'Issue 01',
  eyebrow: 'A new day',
  heading: 'First line.\nSecond line.',
  subheading: 'A short paragraph.',
  cta_text: 'Shop',
  cta_secondary_text: 'Read',
  detail_label: 'On the cover',
  alt: 'Two people',
  detail_alt: 'A bracelet',
};
const PRELOAD = { products: { cuff: { slug: 'cuff', title: 'Engraved Cuff', price: 49, currency: 'EUR', available: true } } };

function html(props: Partial<SectionRenderProps> = {}) {
  const markup = renderToStaticMarkup(
    <CoverHero locale="en" primaryLocale="en" storeSlug="demo" settings={SETTINGS} content={CONTENT} {...props} />,
  );
  // Without the hoisted <style> blocks and the flag script.
  return markup.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
}
const tag = (markup: string, cls: string) => (markup.match(new RegExp(`<[a-z0-9]+ class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`)) || [''])[0];

describe('cover-hero', () => {
  it('without motion: complete text, no recipe attribute, no island', () => {
    const out = html({ preloaded: PRELOAD });
    expect(out).toContain('data-cx-section="cover-hero"');
    expect(out).not.toMatch(/data-cx-(reveal|intro|behavior|hover|magnetic|item|i|d|dir|y|drift|rotate)=/);
    expect(out).not.toContain('cx-hero-');
    for (const text of ['Start label', 'Issue 01', 'A new day', 'A short paragraph.', 'Shop', 'Read', 'On the cover', 'Engraved Cuff']) {
      expect(out).toContain(text);
    }
    // The heading keeps its line break as text and is the h1.
    expect(out).toMatch(/<h1 class="cx-ch-h">First line\.\nSecond line\.<\/h1>/);
    expect(hrefs(out)).toEqual(['/products', '/about', '/products/cuff', '/products/cuff']);
    const [large, seal, small] = imgTags(out);
    expect(large).toContain('alt="Two people"');
    expect(large).toContain('object-position:right top');
    expect(seal).toContain('alt=""');
    expect(small).toContain('alt="A bracelet"');
  });

  it('intro: the large photograph only settles (never clipped), the rest follows the sequence', () => {
    const out = html({ motion: 'intro', preloaded: PRELOAD });
    const mask = tag(out, 'cx-hero-media');
    expect(mask).toContain('data-cx-intro="scale"');
    expect(mask).not.toContain('data-cx-reveal');
    expect(imgTags(out)[0]).not.toContain('loading="lazy"');
    expect(tag(out, 'cx-ch-hair')).toContain('data-cx-intro="rule"');
    expect(tag(out, 'cx-ch-ms')).toMatch(/data-cx-intro="fade" data-cx-d="2"/);
    expect(tag(out, 'cx-ch-eb')).toContain('data-cx-intro="rise"');
    expect(out).toMatch(/<h1[^>]*><span class="cx-ht" data-cx-intro="words">/);
    expect(tag(out, 'cx-ch-rule')).toMatch(/data-cx-intro="rule" data-cx-d="6"/);
    expect(tag(out, 'cx-ch-sub')).toMatch(/data-cx-intro="rise" data-cx-i="2"/);
    const buttons = out.match(/<a class="cx-ch-btn[^>]*>/g) || [];
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toMatch(/data-cx-i="3"/);
    expect(buttons[1]).toMatch(/data-cx-i="4"/);
    for (const button of buttons) {
      expect(button).toContain('data-cx-hover="press"');
      expect(button).toContain('data-cx-magnetic=""');
    }
    expect(tag(out, 'cx-ch-seal')).toMatch(/data-cx-intro="fade" data-cx-d="6"/);
    expect(tag(out, 'cx-ch-seal-in')).toMatch(/data-cx-behavior="scrub" data-cx-drift="" data-cx-y="-4" data-cx-rotate="8"/);
    expect(tag(out, 'cx-ch-edge')).toMatch(/data-cx-intro="fade" data-cx-d="4"/);
    expect(tag(out, 'cx-ch-fill')).toMatch(/data-cx-behavior="scrub" data-cx-y="-6"/);
    expect(tag(out, 'cx-ch-capw')).toMatch(/data-cx-intro="fade" data-cx-d="8"/);
    expect(tag(out, 'cx-ch-cap')).toContain('data-cx-hover="underline"');
  });

  it('scroll: the large photograph opens towards the text, the small one upwards after it', () => {
    const out = html({ motion: 'scroll' });
    const masks = out.match(/<div class="cx-mask[ "][^>]*>/g) || [];
    expect(masks).toHaveLength(2);
    expect(masks[0]).toMatch(/data-cx-reveal="mask" data-cx-dir="end"/);
    expect(masks[1]).toMatch(/data-cx-reveal="mask" data-cx-dir="up"/);
    expect(masks[1]).toContain('--cx-delay:.5s');
    expect(tag(out, 'cx-ch-hair')).toContain('data-cx-reveal="line"');
    expect(tag(out, 'cx-ch-eb')).toContain('data-cx-reveal="rise"');
    expect(out).toContain('data-cx-reveal="words"');
  });

  it('nothing on the store without a heading, the empty state in the builder', () => {
    expect(html({ content: {} })).toBe('');
    expect(html({ content: { heading: ' \n ' } })).toBe('');
    const out = html({ content: {}, builderPreview: true });
    expect(out).toContain('data-cx-empty="cover-hero"');
    expect(out).toContain('creative.empty.coverHero');
  });

  it('right-to-left: logical classes only, artwork not mirrored', () => {
    const out = html({ locale: 'ar', content: { ...CONTENT, heading: 'كل عملية شراء.\nفرصة للتعلّم.', eyebrow: 'يوم جديد' } });
    expect(physicalClasses(out)).toEqual([]);
    expect(out).not.toMatch(/scaleX|scale:-1|rotateY/);
    expect(tag(out, 'cx-ch-h')).toContain('data-cx-script="arabic"');
    expect(tag(out, 'cx-ch-eb')).toContain('data-cx-script="arabic"');
    // Arabic is split into words at most, never into characters.
    const words = html({ locale: 'ar', motion: 'intro', content: { ...CONTENT, heading: 'كل عملية شراء.' } });
    expect(words.match(/class="cx-wi"/g)).toHaveLength(3);
    const source = readFileSync(path.join(__dirname, 'CoverHero.tsx'), 'utf8');
    expect(physicalClasses(source.replace(/className=/g, 'class='))).toEqual([]);
    expect(COVER_HERO_CSS).not.toMatch(/(?:margin|padding|border)-(?:left|right)|[^-](?:left|right):/);
  });

  it('fallbacks: no small photograph, no seal, masthead on phones', () => {
    const full = html();
    expect(full).toContain('data-cx-detail=""');
    expect(full).toContain('data-cx-seal="md"');
    expect(tag(full, 'cx-ch-mast')).toContain('data-cx-mast="start"');
    expect(full).not.toContain('cx-ch-mc');

    const bare = html({ settings: { ...SETTINGS, detail_image: '', seal_image: '', edge_image: '', seal_size: 'sm' } });
    expect(bare).not.toContain('data-cx-detail');
    expect(bare).not.toContain('cx-ch-detail');
    expect(bare).not.toContain('data-cx-seal');
    expect(bare).not.toContain('cx-ch-edge');
    expect(imgTags(bare)).toHaveLength(1);

    const center = html({ content: { ...CONTENT, masthead_center: 'Centre' } });
    expect(tag(center, 'cx-ch-mast')).toContain('data-cx-mast="center"');
    expect(html({ settings: { ...SETTINGS, seal_size: 'sm' } })).toContain('data-cx-seal="sm"');
    expect(html({ settings: { ...SETTINGS, mobile_order: 'text-first' } })).toContain('data-cx-order="text"');
    expect(html({ settings: { ...SETTINGS, heading_level: 'h2' } })).toMatch(/<h2 class="cx-ch-h">/);
  });

  it('caption: the price comes from the preload only', () => {
    // No live data and no manual title: no caption at all.
    const none = html();
    expect(none).not.toContain('cx-ch-cap');
    // Manual title without live data: the title, never a price.
    const manual = html({ content: { ...CONTENT, detail_title: 'The cuff' } });
    expect(manual).toContain('The cuff');
    expect(manual).not.toContain('cx-ch-price');
    // Live data: live title and price with the VAT note; the manual title wins.
    const live = html({ preloaded: PRELOAD });
    expect(live).toContain('Engraved Cuff');
    expect(live).toContain('€49.00');
    expect(live).toContain('VAT-NOTE');
    expect(html({ preloaded: PRELOAD, content: { ...CONTENT, detail_title: 'The cuff' } })).not.toContain('Engraved Cuff');
    // Sold out: the price stays and the product card string joins it.
    const sold = html({ preloaded: { products: { cuff: { ...PRELOAD.products.cuff, available: false } } } });
    expect(sold).toContain('€49.00');
    expect(sold).toContain('product.outOfStock');
    // A link that is no product reads no preload.
    expect(html({ settings: { ...SETTINGS, detail_url: '/collections/cuff' }, preloaded: PRELOAD })).not.toContain('cx-ch-cap');
  });

  it('helpers: product slug, edge url, media, focus, contrast', () => {
    expect(coverProductSlug('/products/cuff')).toBe('cuff');
    expect(coverProductSlug('/sv/products/cuff?ref=1')).toBe('cuff');
    expect(coverProductSlug('/products')).toBeNull();
    expect(coverProductSlug('https://x.test/products/cuff')).toBeNull();
    expect(coverEdgeCss(SVG)).toBe(`url("${SVG}")`);
    expect(coverEdgeCss('https://cdn.example.com/a b.svg')).toBe('');
    expect(coverEdgeCss('https://cdn.example.com/edge.svg')).toBe('url("https://cdn.example.com/edge.svg")');
    for (const bad of ['javascript:alert(1)', 'http://x.test/a.svg', '//x.test/a.svg', 'https://x.test/a.svg")', 'data:text/html;base64,AAAA', 'https://x.test/a\\b']) {
      expect(coverEdgeCss(bad)).toBe('');
    }
    expect(coverMedia('data:text/html;base64,AAAA')).toBe('');
    expect(coverMedia(SVG)).toBe(SVG);
    expect(coverFocus('left', 'bottom')).toBe('left bottom');
    expect(coverFocus('junk', undefined)).toBe('center top');
    expect(contrastOn('#B60018')).toBe('#ffffff');
    expect(contrastOn('#F7F4EF')).toBe('#111111');
    expect(contrastOn('red')).toBeNull();
  });

  it('own CSS hides nothing outside the gate', () => {
    for (const rule of COVER_HERO_CSS.split('}').filter((r) => /data-cx-(i|state|reveal|intro)/.test(r))) {
      expect(rule).toContain(G);
    }
    expect(COVER_HERO_CSS).not.toMatch(/opacity:0|visibility:hidden|clip-path/);
    expect(classTokens(html()).every((c) => c.startsWith('cx-'))).toBe(true);
  });

  it('schema: keys, order and defaults of the spec', () => {
    expect(entry.schema.id).toBe('cover-hero');
    expect(entry.schema.pageTypes).toEqual(['HOME', 'STATIC', 'LANDING']);
    expect(entry.schema.icon).toBe('layout-template');
    expect(entry.schema.schema.map((f) => f.key)).toEqual([
      ...COVER_HERO_TRANSLATABLE,
      'image',
      'image_focus_x',
      'image_focus_y',
      'detail_image',
      'detail_url',
      'seal_image',
      'seal_size',
      'edge_image',
      'cta_url',
      'cta_secondary_url',
      'cta_tone',
      'heading_level',
      'mobile_order',
      'bg_color',
      'text_color',
      'accent_color',
    ]);
    expect(entry.schema.translatable).toEqual([...COVER_HERO_TRANSLATABLE]);
    expect(entry.defaultContent).toEqual({});
    expect(entry.defaultSettings).toEqual({
      image_focus_x: 'center',
      image_focus_y: 'top',
      seal_size: 'md',
      cta_tone: 'accent',
      heading_level: 'h1',
      mobile_order: 'image-first',
    });
    // Every select default is one of its options and equals the default setting.
    for (const field of entry.schema.schema.filter((f) => f.type === 'select')) {
      expect(field.options?.map((o) => o.value)).toContain(field.defaultValue);
      expect(entry.defaultSettings[field.key]).toBe(field.defaultValue);
    }
    for (const field of entry.schema.schema) {
      expect(field.label.en && field.label.ar).toBeTruthy();
    }
  });
});
