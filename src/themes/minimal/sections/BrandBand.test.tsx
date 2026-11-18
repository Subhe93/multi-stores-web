import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionDefinition, SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { brandBandSection } from './BrandBand';
import { minimalTheme } from '../theme';
import { classicTheme } from '../../classic/theme';
import { boldTheme } from '../../bold/theme';
import { classTokens, hrefs, imgAlts, imgTags, physicalClasses } from './_shared/testHelpers';

const BrandBand = brandBandSection.Component;

function html(
  props: Partial<SectionRenderProps> & { settings?: Record<string, unknown>; content?: Record<string, unknown> } = {},
) {
  return renderToStaticMarkup(
    <BrandBand locale="en" primaryLocale="en" storeSlug="demo" settings={{}} content={{}} {...props} />,
  );
}

const SETTINGS = {
  image: '/uploads/pages/mountain.jpg',
  image_focus: 'bottom',
  overlay_opacity: 55,
  height: 'lg',
  logo: '/uploads/pages/sun.svg',
  logo_height: 96,
  heading_style: 'ruled',
  text_color: '#F5F0E6',
  cta_url: '/about',
};
const CONTENT = {
  alt: 'Mountains at sunrise',
  heading: 'NEWROJ',
  tagline: 'Culture | Education | A Better Future',
  cta_text: 'Our story',
};

const RULE = /<span aria-hidden="true" class="hidden h-px min-w-8 flex-1 sm:block"[^>]*><\/span>/g;

describe('brand-band', () => {
  it('renders every part: photo, overlay, logo, ruled heading, tagline and button', () => {
    const out = html({ settings: SETTINGS, content: CONTENT });
    const imgs = imgTags(out);
    expect(imgs).toHaveLength(2);
    // Background photo: lazy, full width, focus from the setting, real alt.
    expect(imgs[0]).toContain('alt="Mountains at sunrise"');
    expect(imgs[0]).toContain('loading="lazy"');
    expect(imgs[0]).toContain('sizes="100vw"');
    expect(imgs[0]).toContain('object-position:center bottom');
    expect(imgs[0]).toContain('mountain.jpg');
    // Overlay 55 % black.
    expect(out).toContain('<div class="absolute inset-0" style="background-color:rgba(0,0,0,0.55)"></div>');
    // Height: one step lower on mobile.
    expect(classTokens(out)).toEqual(expect.arrayContaining(['min-h-[400px]', 'md:min-h-[560px]']));
    // Heading between two rules, tagline as a paragraph, both in the text colour.
    expect(out.match(RULE)).toHaveLength(2);
    expect(out).toMatch(/<h2 data-text-look="heading" style="[^"]*color:#F5F0E6[^"]*" id="[^"]+" class="[^"]*">NEWROJ<\/h2>/);
    expect(out).toMatch(/<p class="max-w-prose" style="[^"]*color:#F5F0E6">Culture \| Education \| A Better Future<\/p>/);
    // Button.
    expect(hrefs(out)).toEqual(['/about']);
    expect(out).toContain('>Our story</a>');
    expect(out).toContain('focus-visible:outline');
    expect(out).toContain('border-radius:var(--theme-radius-button, var(--theme-radius-full))');
  });

  it('is a full-bleed section on a dark ground, labelled by its heading', () => {
    const out = html({ settings: SETTINGS, content: CONTENT });
    const section = out.match(/<section[^>]*>/)![0];
    const id = out.match(/<h2[^>]* id="([^"]+)"/)![1];
    expect(section).toContain(`aria-labelledby="${id}"`);
    expect(section).toContain('width:100vw');
    expect(section).toContain('margin-inline:calc(50% - 50vw)');
    expect(section).toContain('background-color:#101014');
    expect(section).not.toMatch(/margin-(left|right)/);
  });

  it('logo: decorative, height from the setting with automatic width; an SVG is not optimized', () => {
    const svg = imgTags(html({ settings: SETTINGS, content: CONTENT }))[1];
    expect(svg).toContain('alt=""');
    expect(svg).toContain('height:96px;width:auto');
    expect(svg).toContain('src="http://localhost:3001/uploads/pages/sun.svg"');
    expect(svg).not.toContain('/_next/image');

    const png = imgTags(html({ settings: { ...SETTINGS, logo: '/uploads/pages/sun.png' }, content: CONTENT }))[1];
    expect(png).toContain('/_next/image');
    expect(png).toContain('height:96px;width:auto');
  });

  it('logo height: 72 by default, clamped to 32–160', () => {
    const logoOf = (logo_height: unknown) =>
      imgTags(html({ settings: { logo: '/uploads/l.png', logo_height }, content: {} }))[0];
    expect(logoOf(undefined)).toContain('height:72px');
    expect(logoOf('big')).toContain('height:72px');
    expect(logoOf(10)).toContain('height:32px');
    expect(logoOf(500)).toContain('height:160px');
    expect(logoOf(120)).toContain('height:120px');
  });

  it('overlay: 40 % by default, clamped to 0–80', () => {
    const overlayOf = (overlay_opacity: unknown) =>
      html({ settings: { image: '/uploads/m.jpg', overlay_opacity }, content: {} }).match(/rgba\(0,0,0,([0-9.]+)\)/)![1];
    expect(overlayOf(undefined)).toBe('0.4');
    expect(overlayOf('dark')).toBe('0.4');
    expect(overlayOf(0)).toBe('0');
    expect(overlayOf(-20)).toBe('0');
    expect(overlayOf(80)).toBe('0.8');
    expect(overlayOf(100)).toBe('0.8');
    expect(overlayOf(25)).toBe('0.25');
  });

  it('image: empty alt means decorative; focus defaults to the centre', () => {
    const out = html({ settings: { image: '/uploads/m.jpg' }, content: {} });
    expect(imgAlts(out)).toEqual(['']);
    expect(imgTags(out)[0]).toContain('object-position:center');
    expect(imgTags(html({ settings: { image: '/uploads/m.jpg', image_focus: 'top' } }))[0]).toContain('object-position:center top');
  });

  it('heights: sm, md (default and unknown) and lg', () => {
    const classesOf = (height: unknown) => classTokens(html({ settings: { height }, content: { heading: 'X' } }));
    expect(classesOf('sm')).toEqual(expect.arrayContaining(['min-h-[220px]', 'md:min-h-[280px]']));
    expect(classesOf('md')).toEqual(expect.arrayContaining(['min-h-[280px]', 'md:min-h-[400px]']));
    expect(classesOf(undefined)).toEqual(expect.arrayContaining(['min-h-[280px]', 'md:min-h-[400px]']));
    expect(classesOf('huge')).toEqual(expect.arrayContaining(['min-h-[280px]', 'md:min-h-[400px]']));
    expect(classesOf('lg')).toEqual(expect.arrayContaining(['min-h-[400px]', 'md:min-h-[560px]']));
  });

  it('heading style: ruled (default) draws two hidden rules in the text colour, plain draws none', () => {
    const ruled = html({ content: { heading: 'NEWROJ' } });
    expect(ruled.match(RULE)).toHaveLength(2);
    for (const rule of ruled.match(RULE)!) expect(rule).toContain('background-color:#FFFFFF');
    expect(html({ settings: { heading_style: 'ruled' }, content: { heading: 'NEWROJ' } })).toBe(ruled);
    const plain = html({ settings: { heading_style: 'plain' }, content: { heading: 'NEWROJ' } });
    expect(plain.match(RULE)).toBeNull();
    expect(plain).toContain('NEWROJ</h2>');
    // Custom text colour reaches the rules.
    const tinted = html({ settings: { text_color: '#112233' }, content: { heading: 'NEWROJ' } });
    for (const rule of tinted.match(RULE)!) expect(rule).toContain('background-color:#112233');
  });

  it('heading level: h2 by default, the chosen tag otherwise', () => {
    expect(html({ content: { heading: 'NEWROJ' } })).toMatch(/<h2 [^>]*>NEWROJ<\/h2>/);
    expect(html({ settings: { heading_level: 'h3' }, content: { heading: 'NEWROJ' } })).toMatch(/<h3 [^>]*>NEWROJ<\/h3>/);
    expect(html({ settings: { heading_level: 'p' }, content: { heading: 'NEWROJ' } })).toMatch(/<p data-text-look="heading" [^>]*>NEWROJ<\/p>/);
    expect(html({ settings: { heading_level: 'h9' }, content: { heading: 'NEWROJ' } })).toMatch(/<h2 [^>]*>NEWROJ<\/h2>/);
  });

  it('text colour defaults to white', () => {
    const out = html({ content: { heading: 'NEWROJ', tagline: 'A line', cta_text: 'More' } });
    expect(out).toMatch(/<h2 [^>]*color:#FFFFFF[^>]*>/);
    expect(out).toMatch(/<p class="max-w-prose" style="[^"]*color:#FFFFFF">/);
    expect(out).toMatch(/<a [^>]*color:#FFFFFF;border:1\.5px solid #FFFFFF/);
  });

  it('empty heading: no heading element, no rules and no aria-labelledby', () => {
    const out = html({ settings: SETTINGS, content: { ...CONTENT, heading: '  ' } });
    expect(out).not.toMatch(/<h[1-6]/);
    expect(out.match(RULE)).toBeNull();
    expect(out).not.toContain('aria-labelledby');
    expect(out).toContain('Culture | Education | A Better Future');
  });

  it('empty tagline: no paragraph', () => {
    const out = html({ settings: SETTINGS, content: { ...CONTENT, tagline: '' } });
    expect(out).not.toContain('<p');
    expect(out).toContain('NEWROJ</h2>');
  });

  it('button: only with a text; an empty URL gives "#"', () => {
    expect(html({ settings: SETTINGS, content: { ...CONTENT, cta_text: '' } })).not.toContain('<a');
    expect(hrefs(html({ settings: {}, content: { cta_text: 'More' } }))).toEqual(['#']);
  });

  it('secondary locale: the button link gets the locale prefix; external links stay as typed', () => {
    const ar = html({ settings: SETTINGS, content: CONTENT, locale: 'ar' });
    expect(hrefs(ar)).toEqual(['/ar/about']);
    const ext = html({ settings: { ...SETTINGS, cta_url: 'https://example.com/x' }, content: CONTENT, locale: 'ar' });
    expect(hrefs(ext)).toEqual(['https://example.com/x']);
  });

  it('uses no physical direction classes or styles', () => {
    for (const locale of ['en', 'ar']) {
      const out = html({ settings: { ...SETTINGS, heading_accent: 'brush' }, content: CONTENT, locale });
      expect(physicalClasses(out)).toEqual([]);
      expect(out).not.toMatch(/(margin|padding)-(left|right)|text-align:(left|right)/);
    }
  });

  it('heading accent: centred, inside the heading', () => {
    const out = html({ settings: { heading_accent: 'brush', heading_accent_color: '#B60018' }, content: { heading: 'NEWROJ' } });
    expect(out).toMatch(
      /NEWROJ<span aria-hidden="true" class="heading-accent" data-variant="brush" data-align="center" style="color:#B60018;font-size:inherit"><svg.*?<\/svg><\/span><\/h2>/,
    );
  });

  it('nothing set: nothing on the live store, an empty band outline in the builder', () => {
    expect(html()).toBe('');
    expect(html({ settings: { overlay_opacity: 60, height: 'lg', text_color: '#fff', cta_url: '/x', heading_style: 'plain' } })).toBe('');
    expect(html({ builderPreview: false })).toBe('');
    const preview = html({ builderPreview: true, settings: { height: 'sm' } });
    expect(preview).toContain('data-brand-band-placeholder=""');
    expect(preview).toContain('min-h-[220px]');
    expect(preview).not.toContain('<img');
    expect(physicalClasses(preview)).toEqual([]);
    // With content the builder shows the real band.
    expect(html({ builderPreview: true, content: { heading: 'NEWROJ' } })).toBe(html({ content: { heading: 'NEWROJ' } }));
  });

  it('palette defaults render a band with the sample heading and tagline', () => {
    const out = html({ settings: { ...brandBandSection.defaultSettings }, content: { ...brandBandSection.defaultContent } });
    expect(out).toContain('Your brand</h2>');
    expect(out).toContain('A short line about what you stand for');
    expect(out).toContain('rgba(0,0,0,0.4)');
    expect(out.match(RULE)).toHaveLength(2);
    expect(out).not.toContain('<img');
  });
});

describe('brand-band definition', () => {
  const def = brandBandSection;

  it('is registered in the three themes', () => {
    expect((minimalTheme.sections as Record<string, SectionDefinition>)['brand-band']).toBe(def);
    expect((classicTheme.sections as Record<string, SectionDefinition>)['brand-band']).toBe(def);
    expect((boldTheme.sections as Record<string, SectionDefinition>)['brand-band']).toBe(def);
  });

  it('schema identity, page types and translatable keys', () => {
    expect(def.schema.id).toBe('brand-band');
    expect(def.schema.category).toBe('showcase');
    expect(def.schema.icon).toBe('image');
    expect(def.schema.pageTypes).toEqual(['HOME', 'STATIC', 'LANDING', 'FOOTER']);
    expect(def.schema.chrome).toBeUndefined();
    expect(def.schema.translatable).toEqual(['alt', 'heading', 'tagline', 'cta_text']);
    expect(def.needsBuilderPreview).toBe(true);
  });

  it('fields: order, types, limits and options', () => {
    const fields = def.schema.schema.map((f) => ({
      key: f.key,
      type: f.type,
      ...(f.defaultValue !== undefined ? { defaultValue: f.defaultValue } : {}),
      ...(f.min !== undefined ? { min: f.min } : {}),
      ...(f.max !== undefined ? { max: f.max } : {}),
      ...(f.maxLength !== undefined ? { maxLength: f.maxLength } : {}),
      ...(f.options ? { options: f.options.map((o) => o.value) } : {}),
    }));
    expect(fields).toEqual([
      { key: 'image', type: 'image' },
      { key: 'alt', type: 'text', maxLength: 160 },
      { key: 'image_focus', type: 'select', defaultValue: 'center', options: ['center', 'top', 'bottom'] },
      { key: 'overlay_opacity', type: 'number', defaultValue: 40, min: 0, max: 80 },
      { key: 'height', type: 'select', defaultValue: 'md', options: ['sm', 'md', 'lg'] },
      { key: 'logo', type: 'image' },
      { key: 'logo_height', type: 'number', defaultValue: 72, min: 32, max: 160 },
      { key: 'heading', type: 'text', maxLength: 80 },
      { key: 'heading_accent', type: 'select', defaultValue: 'none', options: ['none', 'line', 'brush'] },
      { key: 'heading_accent_color', type: 'color' },
      { key: 'heading_style', type: 'select', defaultValue: 'ruled', options: ['ruled', 'plain'] },
      { key: 'tagline', type: 'text', maxLength: 160 },
      { key: 'text_color', type: 'color' },
      { key: 'cta_text', type: 'text', maxLength: 40 },
      { key: 'cta_url', type: 'url' },
    ]);
  });

  it('defaults', () => {
    expect(def.defaultSettings).toEqual({
      image_focus: 'center',
      overlay_opacity: 40,
      height: 'md',
      logo_height: 72,
      heading_style: 'ruled',
    });
    expect(def.defaultContent).toEqual({ heading: 'Your brand', tagline: 'A short line about what you stand for' });
  });
});
