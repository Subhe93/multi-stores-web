import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { heroSplitSection } from './HeroSplit';
import { classTokens, hrefs, imgAlts, imgTags, physicalClasses } from './_shared/testHelpers';

const HeroSplit = heroSplitSection.Component;

function html(
  props: Partial<SectionRenderProps> & { settings: Record<string, unknown>; content?: Record<string, unknown> },
) {
  return renderToStaticMarkup(
    <HeroSplit locale="en" primaryLocale="en" storeSlug="demo" content={{}} {...props} />,
  );
}

const CONTENT = {
  eyebrow: 'New season',
  heading: 'Made to last',
  subheading: 'One or two lines about the range.',
  cta_text: 'Shop now',
  cta_secondary_text: 'Our story',
};

// Settings as stored today (no `variant`, no `cta_tone`). The snapshots were
// recorded before HeroSplit.tsx was edited and must stay byte-identical.
const FRAMED_CASES: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
  ['palette defaults', { ...heroSplitSection.defaultSettings }, { ...heroSplitSection.defaultContent }],
  [
    'image at the start',
    { image: '/uploads/pages/hero.jpg', image_side: 'start', height: 'md', cta_url: '/products', cta_secondary_url: '/about' },
    CONTENT,
  ],
  [
    'image at the end with colour and border overrides',
    {
      image: 'https://cdn.example.com/hero.jpg',
      image_side: 'end',
      height: 'lg',
      heading_level: 'h2',
      eyebrow_color: '#333333',
      heading_color: '#111111',
      subheading_color: '#555555',
      cta_bg_color: '#ff0000',
      cta_text_color: '#ffffff',
      cta_border_color: '#000000',
      cta_border_width: 2,
      cta_border_radius: 4,
      cta_secondary_border_color: '#00ff00',
      cta_secondary_border_width: 1,
      cta_secondary_border_radius: 0,
      cta_url: '/products',
    },
    CONTENT,
  ],
  ['empty', {}, {}],
];

describe('hero-split framed output (unchanged)', () => {
  for (const [name, settings, content] of FRAMED_CASES) {
    it(name, () => {
      expect(html({ settings, content })).toMatchSnapshot();
    });
  }
});

// ── New keys left at their defaults change nothing ───────────────────────

describe('hero-split framed output with the new keys at their defaults', () => {
  for (const [name, settings, content] of FRAMED_CASES) {
    it(`${name}: variant framed and cta_tone primary equal unset`, () => {
      const base = html({ settings, content });
      expect(html({ settings: { ...settings, variant: 'framed' }, content })).toBe(base);
      expect(html({ settings: { ...settings, cta_tone: 'primary' }, content })).toBe(base);
      expect(html({ settings: { ...settings, variant: 'framed', cta_tone: 'primary' }, content })).toBe(base);
    });
  }

  it('keeps defaultSettings and adds only alt to the translatable keys', () => {
    expect(heroSplitSection.defaultSettings).toEqual({ image_side: 'start', height: 'md' });
    expect(heroSplitSection.schema.translatable).toEqual([
      'eyebrow', 'heading', 'subheading', 'cta_text', 'cta_url', 'cta_secondary_text', 'cta_secondary_url', 'alt',
    ]);
  });

  it('framed: an accent button and an explicit alt text', () => {
    const out = html({
      settings: { image: '/uploads/pages/hero.jpg', cta_tone: 'accent' },
      content: { ...CONTENT, alt: 'A model in a linen coat' },
    });
    expect(out).toContain('background-color:var(--theme-colors-accent)');
    expect(out).toContain('color:var(--theme-colors-accentContrast, #fff)');
    expect(imgAlts(out)).toEqual(['A model in a linen coat']);
  });
});

// ── Edge-to-edge variant ────────────────────────────────────────────────

const BLEED = { variant: 'bleed', image: '/uploads/pages/hero.jpg', cta_url: '/products', cta_secondary_url: '/' };

describe('hero-split bleed variant', () => {
  it('escapes to the viewport and carries no radius or shadow on the image', () => {
    const out = html({ settings: BLEED, content: CONTENT });
    expect(out).toContain('data-bleed-split="bleed"');
    expect(out).toContain('width:100vw');
    expect(out).toContain('margin-inline:calc(50% - 50vw)');
    expect(out).not.toContain('var(--theme-radius-lg)');
    expect(out).not.toContain('var(--theme-shadow-lg)');
    const [img] = imgTags(out);
    expect(img).not.toContain('border-radius');
    expect(img).not.toContain('box-shadow');
    expect(img.toLowerCase()).toContain('fetchpriority="high"');
    expect(img).toContain('(min-width: 768px) 50vw, 100vw');
    // Surface tone by default.
    expect(out).toContain('background-color:var(--theme-colors-surface)');
  });

  it('places the image at the end with an order class and keeps it first in the DOM', () => {
    const start = html({ settings: BLEED, content: CONTENT });
    const end = html({ settings: { ...BLEED, image_side: 'end' }, content: CONTENT });
    expect(classTokens(start)).not.toContain('md:order-2');
    expect(classTokens(end)).toContain('md:order-2');
    expect(classTokens(end)).toContain('md:order-1');
    expect(end.indexOf('<img')).toBeLessThan(end.indexOf('Made to last'));
    // The text lines up with the page container on the side away from the image.
    expect(start).toMatch(/padding-inline-start:var\(--bs-in\);padding-inline-end:max\(/);
    expect(end).toMatch(/padding-inline-start:max\([^"]*padding-inline-end:var\(--bs-in\)/);
  });

  it('wide image: mirrored 58 / 42 tracks and a matching sizes hint', () => {
    const start = html({ settings: { ...BLEED, image_width: 'wide' }, content: CONTENT });
    const end = html({ settings: { ...BLEED, image_width: 'wide', image_side: 'end' }, content: CONTENT });
    expect(classTokens(start)).toContain('md:grid-cols-[58fr_42fr]');
    expect(classTokens(end)).toContain('md:grid-cols-[42fr_58fr]');
    expect(imgTags(start)[0]).toContain('(min-width: 768px) 58vw, 100vw');
    expect(classTokens(html({ settings: BLEED, content: CONTENT }))).toContain('md:grid-cols-2');
  });

  it('mobile order: image first by default, text first on request', () => {
    expect(classTokens(html({ settings: BLEED, content: CONTENT }))).not.toContain('max-md:order-2');
    expect(classTokens(html({ settings: { ...BLEED, mobile_order: 'text-first' }, content: CONTENT }))).toContain('max-md:order-2');
  });

  it('soft edge by default, none with a hard edge; the fade mirrors in right-to-left', () => {
    const soft = html({ settings: BLEED, content: CONTENT });
    expect(soft).toContain('linear-gradient(to right, var(--theme-colors-surface), transparent)');
    expect(classTokens(soft)).toEqual(expect.arrayContaining(['end-0', '-scale-x-100', 'rtl:scale-x-100']));
    const softEnd = html({ settings: { ...BLEED, image_side: 'end' }, content: CONTENT });
    expect(classTokens(softEnd)).toEqual(expect.arrayContaining(['start-0', 'rtl:-scale-x-100']));
    expect(html({ settings: { ...BLEED, edge: 'hard' }, content: CONTENT })).not.toContain('linear-gradient');
    // Without a tone the image fades into the page background.
    expect(html({ settings: { ...BLEED, tone: 'none' }, content: CONTENT })).toContain(
      'linear-gradient(to right, var(--theme-colors-background), transparent)',
    );
  });

  it('alt text from the content, else the heading', () => {
    expect(imgAlts(html({ settings: BLEED, content: { ...CONTENT, alt: 'Two models outdoors' } }))).toEqual(['Two models outdoors']);
    expect(imgAlts(html({ settings: BLEED, content: CONTENT }))).toEqual(['Made to last']);
    expect(imgAlts(html({ settings: BLEED, content: { cta_text: 'Shop' } }))).toEqual(['']);
  });

  it('localizes internal links on a secondary locale and leaves the primary bare', () => {
    expect(hrefs(html({ settings: BLEED, content: CONTENT, locale: 'sv', primaryLocale: 'en' }))).toEqual(['/sv/products', '/sv']);
    expect(hrefs(html({ settings: BLEED, content: CONTENT }))).toEqual(['/products', '/']);
    expect(
      hrefs(
        html({
          settings: { ...BLEED, cta_url: 'https://example.org/x', cta_secondary_url: '' },
          content: CONTENT,
          locale: 'sv',
          primaryLocale: 'en',
        }),
      ),
    ).toEqual(['https://example.org/x', '#']);
  });

  it('h1 by default; heading_level is honoured', () => {
    expect(html({ settings: BLEED, content: CONTENT })).toMatch(/<h1[^>]*>Made to last<\/h1>/);
    expect(html({ settings: { ...BLEED, heading_level: 'h2' }, content: CONTENT })).toMatch(/<h2[^>]*>Made to last<\/h2>/);
  });

  it('tone and button colours: accent button, inverted on a band of the same colour', () => {
    const accent = html({ settings: { ...BLEED, cta_tone: 'accent' }, content: CONTENT });
    expect(accent).toContain('background-color:var(--theme-colors-accent);color:var(--theme-colors-accentContrast, #fff)');
    const onPrimary = html({ settings: { ...BLEED, tone: 'primary' }, content: CONTENT });
    // Primary button on a primary band: colours swapped so it stays visible.
    expect(onPrimary).toContain('background-color:var(--theme-colors-primaryContrast, #fff);color:var(--theme-colors-primary)');
    const custom = html({ settings: { ...BLEED, bg_color: '#f7f4ef', cta_border_radius: 4 }, content: CONTENT });
    expect(custom).toContain('background-color:#f7f4ef');
    expect(custom).toContain('linear-gradient(to right, #f7f4ef, transparent)');
    expect(custom).toContain('border-radius:4px');
  });

  it('arrow on the primary button only when switched on, mirrored in right-to-left', () => {
    expect(html({ settings: BLEED, content: CONTENT })).not.toContain('<svg');
    const out = html({ settings: { ...BLEED, cta_arrow: true }, content: CONTENT });
    expect(out.match(/<svg/g)).toHaveLength(1);
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(classTokens(out)).toContain('rtl:-scale-x-100');
  });

  it('without an image: one contained text column, no escape to the viewport', () => {
    const out = html({ settings: { variant: 'bleed' }, content: CONTENT });
    expect(out).toContain('data-bleed-split="contained"');
    expect(out).not.toContain('100vw');
    expect(out).not.toContain('<img');
    expect(out).toContain('Made to last');
  });

  it('nothing at all: the same placeholder as the framed variant', () => {
    expect(html({ settings: { variant: 'bleed' }, content: {} })).toBe(html({ settings: {}, content: {} }));
  });

  it('uses no physical direction classes', () => {
    for (const side of ['start', 'end']) {
      const out = html({
        settings: { ...BLEED, image_side: side, image_width: 'wide', cta_arrow: true, mobile_order: 'text-first' },
        content: CONTENT,
        locale: 'ar',
        primaryLocale: 'en',
      });
      expect(physicalClasses(out)).toEqual([]);
    }
  });
});
