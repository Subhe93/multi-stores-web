import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSelectedLayoutSegment: () => null,
}));
// The island is covered by engine/core.test.tsx.
vi.mock('../engine/core', () => ({ register: () => () => {} }));

import type { SectionDefinition } from '../../types';
import { G, G_RTL } from '../css/base.css';
import { HERO_DAWN_CSS } from '../css/heroDawn.css';
import { PB_GROUPS, PB_PREFIX, PB_TONES, PROMISE_BAND_CSS } from '../css/promiseBand.css';
import { BEHAVIORS } from '../engine/registry';
import { lightColorsAttr, readLightColors } from './dawnLight';
import { HD_GROUPS, HD_PREFIX, HD_TONES } from './dawnTones';
import { DAWN_SIZE_SCRIPT, DAWN_WAIT_SCRIPT, heroDawnSection } from './HeroDawn';
import { promiseBandSection, readPromises } from './PromiseBand';
import { parseHex, toneRef, toneVars } from './tones';

function render(def: SectionDefinition, settings: Record<string, unknown>, content: Record<string, unknown>, locale = 'en') {
  const C = def.Component;
  return renderToStaticMarkup(
    <C settings={{ ...def.defaultSettings, ...settings }} content={content} locale={locale} primaryLocale="en" storeSlug="demo" motion="intro" />,
  );
}
const strip = (html: string) => html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');

function dom(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

/** Every rule that animates sits behind the motion gate (hover feedback excepted). */
function ungatedMotion(css: string): string[] {
  const out: string[] = [];
  for (const rule of css.split('}')) {
    if (!/animation:|animation-name:/.test(rule)) continue;
    if (rule.trim().startsWith('@keyframes') || rule.includes(':hover')) continue;
    if (!rule.includes(G) && !rule.includes(G_RTL)) out.push(rule);
  }
  return out;
}

const ARCH = '/uploads/arch.webp';
const CARD = 'https://cdn.example.com/card.webp';
const HERO_CONTENT = {
  eyebrow: 'A new day',
  heading_1: 'First line.',
  heading_2: 'Second line.',
  text: 'Lead text.',
  cta_text: 'Shop',
  cta_secondary_text: 'Story',
  cue_text: 'Scroll',
  arch_alt: 'A person in front of mountains',
};

describe('hero-dawn', () => {
  const html = render(heroDawnSection, { arch_image: ARCH, card_image: CARD, cta_url: '/products', cta_secondary_url: '/about' }, HERO_CONTENT);
  const el = dom(strip(html));

  it('renders one h1 with both lines, the copy and the links of the locale', () => {
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('h1')?.textContent).toBe('First line. Second line.');
    expect(el.querySelector('.cx-hd-line2')?.textContent).toBe('Second line.');
    expect(el.querySelector('.cx-hd-lead')?.textContent).toBe('Lead text.');
    expect(el.querySelector('.cx-hd-btn')?.getAttribute('href')).toBe('/products');
    expect(el.querySelector('.cx-hd-link')?.getAttribute('href')).toBe('/about');
    const ar = dom(strip(render(heroDawnSection, { arch_image: ARCH, cta_url: '/products' }, { ...HERO_CONTENT, heading_1: 'كل عملية شراء.' }, 'ar')));
    expect(ar.querySelector('.cx-hd-btn')?.getAttribute('href')).toBe('/ar/products');
    expect(ar.querySelector('.cx-hd-ht')?.getAttribute('data-cx-script')).toBe('arabic');
  });

  it('loads the arch photo through the media origin, the card as given; the sun is decorative', () => {
    const imgs = Array.from(el.querySelectorAll('img'));
    expect(imgs.some((i) => (i.getAttribute('src') || '').includes(encodeURIComponent('/uploads/arch.webp')))).toBe(true);
    expect(imgs.some((i) => (i.getAttribute('src') || '').includes(encodeURIComponent(CARD)))).toBe(true);
    expect(el.querySelector('.cx-hd-img img')?.getAttribute('alt')).toBe('A person in front of mountains');
    expect(el.querySelector('.cx-hd-sunpar')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('without uploads draws the built-in sun: rays (masked, turning) and a true circle disc of radius 141', () => {
    expect(el.querySelector('.cx-hd-rays svg path')).not.toBeNull();
    expect(el.querySelector('.cx-hd-disc circle')?.getAttribute('r')).toBe('141');
    expect(el.querySelector('.cx-hd-front')).toBeNull();
  });

  it('the single emblem replaces rays and disc; any layer replaces the single emblem', () => {
    const single = dom(strip(render(heroDawnSection, { arch_image: ARCH, emblem: '/uploads/logo.svg' }, HERO_CONTENT)));
    expect(single.querySelector('.cx-hd-rays')).toBeNull();
    expect(single.querySelector('.cx-hd-disc img')?.getAttribute('src')).toContain('logo.svg');
    const layers = dom(
      strip(
        render(
          heroDawnSection,
          { arch_image: ARCH, emblem: '/uploads/logo.svg', emblem_rays: '/uploads/rays.svg', emblem_front: '/uploads/front.svg' },
          HERO_CONTENT,
        ),
      ),
    );
    expect(layers.querySelector('.cx-hd-rays img')?.getAttribute('src')).toContain('rays.svg');
    expect(layers.querySelector('.cx-hd-disc circle')).not.toBeNull();
    expect(layers.querySelector('.cx-hd-front img')?.getAttribute('src')).toContain('front.svg');
    expect(layers.innerHTML).not.toContain('logo.svg');
  });

  it('card, cue and light follow their switches; the behaviour is named on the root', () => {
    const off = dom(strip(render(heroDawnSection, { arch_image: ARCH, card_image: CARD, card: false, cue: false, light: false, height: 'compact' }, HERO_CONTENT)));
    const root = off.querySelector('[data-cx-section="hero-dawn"]');
    expect(off.querySelector('.cx-hd-cardpar')).toBeNull();
    expect(off.querySelector('.cx-hd-cue')).toBeNull();
    expect(root?.getAttribute('data-cx-light')).toBeNull();
    expect(root?.getAttribute('data-cx-height')).toBe('compact');
    const on = el.querySelector('[data-cx-section="hero-dawn"]');
    expect(on?.getAttribute('data-cx-light')).toBe('on');
    expect(on?.getAttribute('data-cx-behavior')).toBe('dawn');
    expect(BEHAVIORS.dawn).toBeTruthy();
    expect(el.querySelector('.cx-hd-cue')?.textContent).toBe('Scroll');
  });

  it('carries the size script first and the wait script after the arch photo', () => {
    expect(html.indexOf(DAWN_SIZE_SCRIPT.slice(0, 40))).toBeGreaterThan(-1);
    expect(html.indexOf('cx-hd-img')).toBeLessThan(html.indexOf(DAWN_WAIT_SCRIPT.slice(0, 40)));
    expect(DAWN_WAIT_SCRIPT).toContain("hasAttribute('data-cx-motion')");
    expect(DAWN_WAIT_SCRIPT).toContain('2500');
    expect(DAWN_SIZE_SCRIPT).toContain('--cx-hd-top');
  });

  it('keeps every animation behind the motion gate and reads the header overlay height', () => {
    expect(ungatedMotion(HERO_DAWN_CSS)).toEqual([]);
    expect(HERO_DAWN_CSS).toContain('var(--store-header-h,0px)');
    expect(HERO_DAWN_CSS).toContain('@media (max-width:899px)');
  });

  it('built-in colours need no inline variables; an owner colour moves its whole group', () => {
    expect(toneVars(HD_PREFIX, HD_TONES, HD_GROUPS, {})).toEqual({});
    expect(toneVars(HD_PREFIX, HD_TONES, HD_GROUPS, { gold_color: '#C9A56A' })).toEqual({});
    const vars = toneVars(HD_PREFIX, HD_TONES, HD_GROUPS, { gold_color: '#D9B57A' });
    expect(vars['--cx-hd-c-gold']).toBe('217 181 122');
    expect(vars['--cx-hd-c-beam']).toBe('255 230 166');
    expect(vars['--cx-hd-c-red']).toBeUndefined();
    expect(toneRef(HD_PREFIX, HD_TONES, 'scrim', 0.5)).toBe('rgb(var(--cx-hd-c-scrim,8 7 7) / 0.5)');
    expect(parseHex('#abc')).toEqual([170, 187, 204]);
    expect(parseHex('red')).toBeNull();
  });

  it('the light colours stay built-in until a sky, warm, gold or accent colour is set', () => {
    expect(lightColorsAttr({})).toBeUndefined();
    expect(lightColorsAttr({ cream_color: '#FFFFFF' })).toBeUndefined();
    const attr = lightColorsAttr({ accent_color: '#C60018' });
    const colors = readLightColors(attr ?? null);
    expect(colors[4][0]).toBeCloseTo(0.6 + 16 / 255, 3);
    expect(colors[0]).toEqual([0.04, 0.037, 0.037]);
    expect(readLightColors('junk')[3]).toEqual([0.96, 0.74, 0.46]);
  });

  it('nothing set: nothing on the live store, an empty state in the builder', () => {
    expect(render(heroDawnSection, {}, {})).toBe('');
    expect(
      renderToStaticMarkup(<heroDawnSection.Component settings={{}} content={{}} locale="en" primaryLocale="en" storeSlug="demo" builderPreview />),
    ).toContain('data-cx-empty="hero-dawn"');
  });
});

describe('promise-band', () => {
  const items = [
    { title: 'Education', text: 'Part of every purchase.', icon: 'book' },
    { title: 'Culture', text: 'Rooted in heritage.', icon: 'mountain' },
    { title: 'Own', text: 'With an uploaded icon.', icon: 'custom', icon_image: '/uploads/i.svg' },
    { title: 'Fourth', text: 'Never shown.', icon: 'gem' },
  ];
  const el = dom(strip(render(promiseBandSection, {}, { heading: 'Our promise', items })));

  it('reads at most three promises; unknown icons fall back, own icons go through the media origin', () => {
    const read = readPromises([...items, { title: '', text: '' }]);
    expect(read).toHaveLength(3);
    expect(read[2].icon).toBe('');
    expect(read[2].image).toContain('/uploads/i.svg');
    expect(readPromises([{ title: 'x', icon: 'nope' }])[0].icon).toBe('book');
    expect(readPromises([{ title: 'x', icon: 'custom' }])[0].icon).toBe('');
  });

  it('renders the heading, the horizon, numbered items with drawable icons and the behaviour', () => {
    expect(el.querySelector('h2')?.textContent).toBe('Our promise');
    expect(el.querySelectorAll('.cx-pm-item')).toHaveLength(3);
    expect(Array.from(el.querySelectorAll('.cx-pm-num')).map((n) => n.textContent)).toEqual(['01', '02', '03']);
    expect(el.querySelectorAll('.cx-pm-icon')).toHaveLength(2);
    for (const p of Array.from(el.querySelectorAll('.cx-pm-icon path'))) expect(p.getAttribute('pathLength')).toBe('1');
    expect(el.querySelector('[data-cx-pm-img] img')?.getAttribute('alt')).toBe('');
    expect(el.querySelectorAll('h3')).toHaveLength(3);
    expect(el.querySelector('.cx-pm-hsun')?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(el.querySelector('[data-cx-section="promise-band"]')?.getAttribute('data-cx-behavior')).toBe('promise');
    expect(BEHAVIORS.promise).toBeTruthy();
  });

  it('numbers can be switched off; the grid follows the number of items', () => {
    const two = dom(strip(render(promiseBandSection, { numbers: false }, { heading: 'H', items: items.slice(0, 2) })));
    expect(two.querySelector('.cx-pm-num')).toBeNull();
    expect(two.querySelector('[data-cx-section]')?.getAttribute('style')).toContain('--cx-pm-n:2');
  });

  it('content is visible without JavaScript: the stylesheet hides nothing and animates only on hover', () => {
    expect(ungatedMotion(PROMISE_BAND_CSS)).toEqual([]);
    expect(PROMISE_BAND_CSS).not.toMatch(/opacity:0[;}][^}]*cx-pm-(eb|text|num|title)/);
    expect(toneVars(PB_PREFIX, PB_TONES, PB_GROUPS, { bg_color: '#FFFFFF' })['--cx-pm-c-line']).toBe('228 222 212');
  });

  it('nothing set: nothing on the live store, an empty state in the builder', () => {
    expect(render(promiseBandSection, {}, {})).toBe('');
    expect(
      renderToStaticMarkup(<promiseBandSection.Component settings={{}} content={{}} locale="en" primaryLocale="en" storeSlug="demo" builderPreview />),
    ).toContain('data-cx-empty="promise-band"');
  });
});
