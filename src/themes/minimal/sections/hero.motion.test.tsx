import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionInstance, SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSelectedLayoutSegment: () => null,
}));

import { SectionRenderer } from '../../SectionRenderer';
import { minimalTheme } from '../theme';
import { classicHeroBannerSection } from '../../classic/sections/HeroBanner';
import { G, G_RTL } from '../../creative/css/base.css';
import { HERO_CSS } from '../../creative/css/hero.css';
import { AuroraHero } from './AuroraHero.client';
import { heroBannerSection } from './HeroBanner';
import { HeroSlider } from './HeroSlider.client';
import { heroSplitSection } from './HeroSplit';
import { HeroVideo } from './HeroVideo.client';
import { parallaxBannerSection } from './ParallaxBanner';
import { EMBLEM_FIELDS } from './_shared/emblemFields';
import { HeroEmblem } from './_shared/HeroEmblem';
import { physicalClasses } from './_shared/testHelpers';

// Store motion style on the hero sections (contract S1): nothing changes
// without the `motion` prop; with it the text, the image and the buttons
// carry the recipe attributes, and the text content stays what it was.

type Motion = SectionRenderProps['motion'];
type Props = { settings: Record<string, unknown>; content: Record<string, unknown> };

const CONTENT = {
  eyebrow: 'New season',
  heading: 'Made to last',
  subheading: 'One or two lines about the range.',
  cta_text: 'Shop now',
  cta_secondary_text: 'Our story',
};
const IMAGE = '/uploads/pages/hero.jpg';

const base = { locale: 'en', primaryLocale: 'en', storeSlug: 'demo' } as const;

function renderer(Component: (p: SectionRenderProps) => ReactElement | null, props: Props) {
  return (motion?: Motion) => renderToStaticMarkup(<Component {...base} {...props} motion={motion} />);
}

const HEROES: Array<[string, (motion?: Motion) => string, { media: 'mask' | 'settle' | 'none'; buttons: number }]> = [
  [
    'hero-split framed',
    renderer(heroSplitSection.Component as never, { settings: { image: IMAGE, heading_accent: 'line' }, content: CONTENT }),
    { media: 'mask', buttons: 2 },
  ],
  [
    'hero-split edge to edge',
    renderer(heroSplitSection.Component as never, { settings: { variant: 'bleed', image: IMAGE }, content: CONTENT }),
    { media: 'mask', buttons: 2 },
  ],
  [
    'hero-banner centred',
    renderer(heroBannerSection.Component as never, { settings: { layout: 'centered', image: IMAGE }, content: CONTENT }),
    { media: 'mask', buttons: 2 },
  ],
  [
    'hero-banner side by side',
    renderer(heroBannerSection.Component as never, {
      settings: { layout: 'side-by-side', alignment: 'right', image: IMAGE },
      content: CONTENT,
    }),
    { media: 'mask', buttons: 2 },
  ],
  [
    'hero-banner image background',
    renderer(heroBannerSection.Component as never, { settings: { layout: 'image-background', image: IMAGE }, content: CONTENT }),
    { media: 'settle', buttons: 2 },
  ],
  [
    'hero-banner (classic theme)',
    renderer(classicHeroBannerSection.Component as never, { settings: { image: IMAGE }, content: CONTENT }),
    { media: 'mask', buttons: 1 },
  ],
  [
    'hero-video',
    renderer(HeroVideo as never, { settings: { poster_image: IMAGE }, content: CONTENT }),
    { media: 'none', buttons: 1 },
  ],
  [
    'parallax-banner',
    renderer(parallaxBannerSection.Component as never, { settings: { image: IMAGE }, content: CONTENT }),
    { media: 'none', buttons: 1 },
  ],
  ['aurora-hero', renderer(AuroraHero as never, { settings: {}, content: CONTENT }), { media: 'none', buttons: 2 }],
];

const text = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  for (const style of Array.from(el.querySelectorAll('style'))) style.remove();
  return el.textContent;
};
const count = (html: string, re: RegExp) => html.match(re)?.length ?? 0;

describe.each(HEROES)('%s', (_name, render, expected) => {
  it('without the motion prop the markup carries no engine attribute and no hook class', () => {
    const html = render();
    expect(html).not.toContain('data-cx-');
    expect(html).not.toMatch(/cx-(hero|mask|w|ht)/);
    expect(html).toBe(render(undefined));
  });

  it('scroll: the text rises, the heading splits into masked words, the buttons respond', () => {
    const html = render('scroll');
    expect(html).not.toContain('data-cx-intro');
    expect(html).toContain('data-cx-reveal="words"');
    expect(count(html, /class="cx-wi"/g)).toBe(3);
    // Eyebrow (classic has none), subheading and each button.
    const eyebrow = _name.includes('classic') ? 0 : 1;
    expect(count(html, /data-cx-reveal="rise"/g)).toBe(eyebrow + 1 + expected.buttons);
    expect(html).toContain('data-cx-i="2"');
    expect(html).toContain('data-cx-i="3"');
    expect(count(html, /data-cx-hover="press"/g)).toBe(expected.buttons);
    expect(count(html, /data-cx-magnetic=""/g)).toBe(expected.buttons);
    expect(count(html, /data-cx-reveal="mask"/g)).toBe(expected.media === 'mask' ? 1 : 0);
  });

  it('intro: the same elements play on load and the image is never clipped', () => {
    const html = render('intro');
    expect(html).not.toContain('data-cx-reveal');
    expect(html).toContain('data-cx-intro="words"');
    expect(html).toContain('data-cx-intro="rise"');
    expect(count(html, /data-cx-intro="scale"/g)).toBe(expected.media === 'none' ? 0 : 1);
  });

  it('the text content does not change', () => {
    const plain = text(render());
    expect(text(render('scroll'))).toBe(plain);
    expect(text(render('intro'))).toBe(plain);
  });

  it('adds no physical-direction class', () => {
    expect(physicalClasses(render('scroll'))).toEqual(physicalClasses(render()));
  });
});

describe('hero images', () => {
  const split = (settings: Record<string, unknown>, motion: Motion) =>
    renderToStaticMarkup(
      <heroSplitSection.Component {...base} settings={{ image: IMAGE, ...settings }} content={CONTENT} motion={motion} />,
    );

  it('opens towards the text side when the hero is further down the page', () => {
    expect(split({ image_side: 'start' }, 'scroll')).toContain('data-cx-dir="start"');
    expect(split({ image_side: 'end' }, 'scroll')).toContain('data-cx-dir="end"');
    expect(split({ variant: 'bleed', image_side: 'end' }, 'scroll')).toContain('data-cx-dir="end"');
  });

  it('hero-banner side by side: the image is in the first column for both alignments', () => {
    for (const alignment of ['left', 'right']) {
      const html = renderToStaticMarkup(
        <heroBannerSection.Component
          {...base}
          settings={{ layout: 'side-by-side', image: IMAGE, alignment }}
          content={CONTENT}
          motion="scroll"
        />,
      );
      expect(html, alignment).toContain('data-cx-dir="start"');
    }
  });

  it('the framed image keeps its radius and shadow on the mask', () => {
    const mask = split({}, 'intro').match(/<div class="cx-mask cx-hero-media"[^>]*>/)?.[0] || '';
    expect(mask).toContain('border-radius:var(--theme-radius-lg)');
    expect(mask).toContain('box-shadow:var(--theme-shadow-lg)');
  });

  it('a background image travels with the scroll and is only wrapped as the first section', () => {
    const banner = (motion?: Motion) =>
      renderToStaticMarkup(
        <heroBannerSection.Component
          {...base}
          settings={{ layout: 'image-background', image: IMAGE }}
          content={CONTENT}
          motion={motion}
        />,
      );
    expect(banner('scroll')).toContain('data-cx-behavior="scrub" data-cx-y="-6"');
    expect(banner('scroll')).not.toContain('cx-mask');
    expect(banner('intro')).toContain('data-cx-behavior="scrub" data-cx-y="-6"');
    expect(count(banner('intro'), /<img\b/g)).toBe(count(banner(), /<img\b/g));
  });

  it('parallax-banner: the fixed background becomes a scroll-linked layer', () => {
    const banner = (motion?: Motion) =>
      renderToStaticMarkup(
        <parallaxBannerSection.Component {...base} settings={{ image: IMAGE }} content={CONTENT} motion={motion} />,
      );
    expect(banner()).toMatch(/<section class="ms-parallax-bg relative /);
    const on = banner('scroll');
    expect(on).toMatch(/<section class="relative /);
    const layer = on.match(/<div aria-hidden="true" class="ms-parallax-bg absolute inset-0"[^>]*>/)?.[0] || '';
    expect(layer).toContain('data-cx-behavior="scrub"');
    expect(layer).toContain('data-cx-y="-6"');
    expect(layer).toContain('background-attachment:scroll');
  });

  it('hero-video: the video and the poster never animate', () => {
    const html = renderToStaticMarkup(
      <HeroVideo {...base} settings={{ video_url: '/uploads/v.mp4', poster_image: IMAGE }} content={CONTENT} motion="intro" />,
    );
    expect(html).not.toContain('cx-mask');
    expect(html).not.toContain('data-cx-behavior');
    expect(html.match(/<video\b[^>]*>/)?.[0]).not.toContain('data-cx-');
  });
});

describe('hero-slider', () => {
  const slides = [
    { image: IMAGE, eyebrow: 'One', heading: 'First slide', subheading: 'Body one', cta_text: 'Go' },
    { image: IMAGE, eyebrow: 'Two', heading: 'Second slide', subheading: 'Body two', cta_text: 'Go' },
  ];
  const render = (motion?: Motion) =>
    renderToStaticMarkup(<HeroSlider {...base} settings={{}} content={{ slides }} motion={motion} />);

  it('without the motion prop nothing is marked', () => {
    expect(render()).not.toContain('data-cx-');
    expect(render()).not.toMatch(/cx-(hero|mask|w|ht)/);
  });

  it('only the first slide gets the entrance', () => {
    for (const motion of ['intro', 'scroll'] as const) {
      const html = render(motion);
      const attr = motion === 'intro' ? 'data-cx-intro' : 'data-cx-reveal';
      expect(count(html, new RegExp(`${attr}="words"`, 'g'))).toBe(1);
      expect(count(html, new RegExp(`${attr}="rise"`, 'g'))).toBe(3);
      expect(count(html, /class="cx-wi"/g)).toBe(2);
      expect(count(html, /data-cx-magnetic/g)).toBe(1);
      expect(text(html)).toBe(text(render()));
    }
    expect(count(render('intro'), /data-cx-intro="scale"/g)).toBe(1);
    expect(render('scroll')).not.toContain('cx-mask');
  });

  it('only the first slide image is high priority; later slides are lazy (no competing preload)', () => {
    const imgs = render().match(/<img\b[^>]*>/g) || [];
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toMatch(/fetchPriority="high"/i);
    expect(imgs[0]).not.toContain('loading="lazy"');
    expect(imgs[1]).toContain('loading="lazy"');
    expect(imgs[1]).toMatch(/fetchPriority="low"/i);
    expect(imgs[1]).not.toContain('loading="eager"');
  });
});

describe('hero emblem', () => {
  const KEYS = ['emblem_image', 'emblem_motion', 'emblem_size', 'emblem_position'];
  const EMBLEM = '/uploads/brand/mark.svg';

  it.each([
    ['hero-split', heroSplitSection],
    ['hero-banner', heroBannerSection],
    ['hero-banner (classic theme)', classicHeroBannerSection],
  ])('%s: the four fields close the schema and are not default settings', (_name, def) => {
    const keys = def.schema.schema.map((f) => f.key);
    expect(keys.slice(-4)).toEqual(KEYS);
    expect(keys.filter((k) => k.startsWith('emblem_'))).toEqual(KEYS);
    for (const key of KEYS) expect(def.defaultSettings ?? {}).not.toHaveProperty(key);
    expect(def.schema.translatable).not.toEqual(expect.arrayContaining(KEYS));
  });

  it('fields: types, options and defaults', () => {
    expect(EMBLEM_FIELDS.map((f) => [f.key, f.type, f.defaultValue, f.options?.map((o) => o.value)])).toEqual([
      ['emblem_image', 'image', undefined, undefined],
      ['emblem_motion', 'select', 'rise', ['none', 'rise', 'turn']],
      ['emblem_size', 'select', 'md', ['sm', 'md']],
      ['emblem_position', 'select', 'start', ['start', 'end']],
    ]);
    for (const field of EMBLEM_FIELDS) {
      expect(field.label.en).toBeTruthy();
      expect(field.label.ar).toBeTruthy();
      for (const option of field.options ?? []) expect(option.label.ar).toBeTruthy();
    }
  });

  it('renders nothing while no image is set', () => {
    expect(renderToStaticMarkup(<HeroEmblem settings={{}} motion="intro" />)).toBe('');
    expect(renderToStaticMarkup(<HeroEmblem settings={{ emblem_image: '  ', emblem_motion: 'turn' }} />)).toBe('');
    for (const [, render] of HEROES) expect(render('intro')).not.toContain('data-hero-emblem');
  });

  it('without the store switch it is a still, decorative image in a fixed box', () => {
    const html = renderToStaticMarkup(<HeroEmblem settings={{ emblem_image: EMBLEM }} />);
    expect(html).not.toContain('data-cx-');
    expect(html).toMatch(/^<div aria-hidden="true" class="block shrink-0 size-16 md:size-\[88px\] me-auto"/);
    expect(html).toMatch(/<img\b[^>]*alt=""/);
    expect(html).toContain('object-contain');
    // An SVG is served as uploaded.
    expect(html).not.toContain('/_next/image');
    expect(html).not.toMatch(/scale-x|rtl:/);
  });

  it('size and side follow the settings; centred text keeps it centred', () => {
    const cls = (settings: Record<string, unknown>, centered = false) =>
      renderToStaticMarkup(<HeroEmblem settings={{ emblem_image: EMBLEM, ...settings }} centered={centered} />).match(
        /class="([^"]*)"/,
      )?.[1];
    expect(cls({ emblem_size: 'sm' })).toBe('block shrink-0 size-11 md:size-14 me-auto');
    expect(cls({ emblem_position: 'end' })).toBe('block shrink-0 size-16 md:size-[88px] ms-auto');
    expect(cls({ emblem_position: 'end' }, true)).toBe('block shrink-0 size-16 md:size-[88px] mx-auto');
    expect(cls({ emblem_size: 'xl', emblem_position: 'left' })).toBe('block shrink-0 size-16 md:size-[88px] me-auto');
  });

  it('rise: enters with the text, then drifts; turn: fades in, then turns; none: still', () => {
    const emblem = (settings: Record<string, unknown>, motion: Motion) =>
      renderToStaticMarkup(<HeroEmblem settings={{ emblem_image: EMBLEM, ...settings }} motion={motion} />);
    const rise = emblem({}, 'intro');
    expect(rise).toMatch(/^<div[^>]*data-hero-emblem="rise" data-cx-intro="rise"/);
    expect(rise).toContain('data-cx-behavior="scrub" data-cx-drift="" data-cx-y="-12"');
    expect(rise).not.toContain('data-cx-rotate');
    const turn = emblem({ emblem_motion: 'turn' }, 'scroll');
    expect(turn).toMatch(/^<div[^>]*data-cx-reveal="fade"/);
    expect(turn).toContain('data-cx-y="-4" data-cx-rotate="8"');
    expect(emblem({ emblem_motion: 'none' }, 'intro')).not.toContain('data-cx-');
    // The entrance and the drift never share an element.
    expect(count(rise, /<div\b/g)).toBe(2);
  });

  it('sits above the eyebrow in each hero that offers it', () => {
    const cases: Array<[string, string]> = [
      ['split', renderToStaticMarkup(<heroSplitSection.Component {...base} settings={{ image: IMAGE, emblem_image: EMBLEM }} content={CONTENT} motion="intro" />)],
      ['bleed', renderToStaticMarkup(<heroSplitSection.Component {...base} settings={{ variant: 'bleed', image: IMAGE, emblem_image: EMBLEM }} content={CONTENT} />)],
      ['banner', renderToStaticMarkup(<heroBannerSection.Component {...base} settings={{ layout: 'centered', alignment: 'center', emblem_image: EMBLEM }} content={CONTENT} />)],
      ['classic', renderToStaticMarkup(<classicHeroBannerSection.Component {...base} settings={{ emblem_image: EMBLEM }} content={CONTENT} />)],
    ];
    for (const [name, html] of cases) {
      expect(count(html, /data-hero-emblem/g), name).toBe(1);
      expect(html.indexOf('data-hero-emblem'), name).toBeLessThan(html.indexOf(name === 'classic' ? 'Made to last' : 'New season'));
    }
    expect(cases[2][1]).toContain('mx-auto');
    expect(cases[3][1]).toContain('mx-auto');
  });
});

describe('through the section renderer', () => {
  const section = (id: string, settings: Record<string, unknown>): SectionInstance => ({
    id,
    section_key: 'hero-split',
    settings: { image: IMAGE, ...settings },
    sort_order: Number(id.slice(1)),
    translations: [{ locale: 'en', content: CONTENT }],
  });
  const PAGE = [section('s1', {}), section('s2', {}), section('s3', { _style: { motion: 'none' } })];
  const render = (motion?: boolean) =>
    renderToStaticMarkup(
      <SectionRenderer theme={minimalTheme} sections={PAGE} locale="en" primaryLocale="en" storeSlug="demo" motion={motion} />,
    );
  const part = (html: string, id: string) => {
    const from = html.indexOf(`data-section-id="${id}"`);
    const next = html.indexOf('data-section-id="', from + 20);
    return html.slice(from, next === -1 ? undefined : next);
  };

  it('first hero plays on load, a later one on scroll, and the override switches one off', () => {
    const on = render(true);
    expect(part(on, 's1')).toContain('data-cx-intro="words"');
    expect(part(on, 's1')).not.toContain('data-cx-reveal');
    expect(part(on, 's2')).toContain('data-cx-reveal="words"');
    expect(part(on, 's2')).toContain('data-cx-reveal="mask"');
    expect(part(on, 's3')).not.toMatch(/data-cx-(intro|reveal|hover|magnetic)|cx-hero/);
  });

  it('without the store switch the heroes render no engine markup', () => {
    expect(render()).not.toMatch(/data-cx-|cx-hero|cx-mask/);
    expect(render()).toBe(render(false));
  });
});

describe('hero stylesheet slot', () => {
  it('every rule sits behind the motion gate', () => {
    // Keyframes and media wrappers aside, each selector starts with the gate.
    const rules = HERO_CSS.replace(/@keyframes [\w-]+\{(?:[^{}]*\{[^{}]*\})*\}/g, '')
      .replace(/@media[^{]*\{/g, '')
      .split('}')
      .map((r) => r.trim())
      .filter(Boolean);
    expect(rules.length).toBeGreaterThan(5);
    for (const rule of rules) expect(rule.startsWith(G) || rule.startsWith(G_RTL), rule).toBe(true);
  });

  it('uses no physical property and no reduced-motion query of its own', () => {
    expect(HERO_CSS).not.toMatch(/(margin|padding|border)-(left|right)|[^-](left|right):/);
    expect(HERO_CSS).not.toContain('prefers-reduced-motion');
  });
});
