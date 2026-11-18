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
import { HERO_OUTLINE_CSS } from '../css/heroOutline.css';
import { HERO_SUNRISE_CSS } from '../css/heroSunrise.css';
import { STAGE_SCENES_CSS } from '../css/stageScenes.css';
import { heroOutlineSection } from './HeroOutline';
import { heroSunriseSection } from './HeroSunrise';
import { PLAY_WHEN_SEEN_SCRIPT } from './heroShared';
import { readScenes, stageScenesSection } from './StageScenes';

function markup(def: SectionDefinition, settings: Record<string, unknown>, content: Record<string, unknown>) {
  const C = def.Component;
  const html = renderToStaticMarkup(
    <C settings={{ ...def.defaultSettings, ...settings }} content={content} locale="en" primaryLocale="en" storeSlug="demo" />,
  );
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
}

function dom(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

/** Every rule that animates or hides sits behind the motion gate. */
function ungatedMotion(css: string): string[] {
  const out: string[] = [];
  for (const rule of css.split('}')) {
    if (!/animation:|animation-name:|clip-path:inset\(-/.test(rule)) continue;
    if (rule.trim().startsWith('@keyframes')) continue;
    if (!rule.includes(G) && !rule.includes(G_RTL)) out.push(rule);
  }
  return out;
}

const IMG = '/uploads/a.png';

describe('hero-outline', () => {
  const html = markup(
    heroOutlineSection,
    { image: IMG, halo: 'dots', accent_size: 'xl' },
    { heading: 'Tailored by\n*tradition.*', eyebrow: 'Edit', accent_text: 'Atelier', cta_text: 'Shop' },
  );
  const el = dom(html);

  it('renders one h1 with the full heading text and the photo through the media origin', () => {
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('h1')?.textContent).toBe('Tailored by\ntradition.');
    expect(el.querySelector('img')?.getAttribute('src')).toContain(encodeURIComponent('/uploads/a.png'));
  });

  it('draws the word as decorative SVG letters at a small or medium size only', () => {
    const svg = el.querySelector('.cx-ho-svg');
    expect(svg?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(Array.from(el.querySelectorAll('.cx-ho-l')).map((l) => l.textContent).join('')).toBe('ATELIER');
    expect(el.querySelector('[data-cx-section="hero-outline"]')?.getAttribute('data-cx-wsize')).toBe('md');
  });

  it('keeps every animation behind the motion gate', () => {
    expect(ungatedMotion(HERO_OUTLINE_CSS)).toEqual([]);
  });

  it('an Arabic word is one faint run', () => {
    const ar = dom(markup(heroOutlineSection, { image: IMG }, { heading: 'عنوان', accent_text: 'نوروز' }));
    expect(ar.querySelectorAll('.cx-ho-l')).toHaveLength(1);
    expect(ar.querySelector('.cx-ho-svg')?.getAttribute('data-cx-look')).toBe('faint');
  });
});

describe('hero-sunrise', () => {
  it('renders the artwork layers decoratively and the copy as an h1', () => {
    const el = dom(
      markup(
        heroSunriseSection,
        { sun_core: IMG, foreground: '/uploads/b.svg', foreground_mode: 'emblem', plate: 'disc' },
        { heading: 'Every purchase', subheading: 'Text' },
      ),
    );
    expect(el.querySelector('h1')?.textContent).toBe('Every purchase');
    expect(el.querySelector('.cx-hs-sun')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.cx-hs-plate')).not.toBeNull();
    for (const img of Array.from(el.querySelectorAll('.cx-hs-sun img'))) expect(img.getAttribute('alt')).toBe('');
  });

  it('the seam needs a photo: without one the artwork is centred', () => {
    const el = dom(markup(heroSunriseSection, { sun_core: IMG, sun_position: 'seam' }, { heading: 'H' }));
    expect(el.querySelector('[data-cx-section]')?.getAttribute('data-cx-pos')).toBe('center');
  });

  it('keeps every animation behind the motion gate', () => {
    expect(ungatedMotion(HERO_SUNRISE_CSS)).toEqual([]);
  });
});

describe('stage-scenes', () => {
  const scenes = [
    { heading: 'One', chips: 'a، b, c, d' },
    { heading: 'Two', side: 'end', view: '2' },
    { eyebrow: '', heading: '', text: '' },
  ];

  it('reads two scenes, alternates sides and splits chips on Latin and Arabic commas', () => {
    const read = readScenes(scenes);
    expect(read).toHaveLength(2);
    expect(read[0].side).toBe('end');
    expect(read[0].chips).toEqual(['a', 'b', 'c']);
  });

  it('the static page carries an in-flow image per scene; the actor exists only with an artwork and two scenes', () => {
    const live = dom(markup(stageScenesSection, { artwork: IMG }, { scenes }));
    expect(live.querySelectorAll('.cx-ss-slot img')).toHaveLength(2);
    expect(live.querySelector('[data-cx-behavior="actor"] .cx-ss-actor')).not.toBeNull();
    const single = dom(markup(stageScenesSection, { artwork: IMG }, { scenes: scenes.slice(0, 1) }));
    expect(single.querySelector('.cx-ss-actor')).toBeNull();
    expect(single.querySelector('[data-cx-behavior]')).toBeNull();
  });

  it('the actor layer is hidden outside the live desktop stage', () => {
    expect(STAGE_SCENES_CSS).toContain('.cx-ss-track{display:none}');
    expect(ungatedMotion(STAGE_SCENES_CSS)).toEqual([]);
  });
});

describe('play when seen', () => {
  it('only marks a section that starts below the first screen, behind the gate', () => {
    expect(PLAY_WHEN_SEEN_SCRIPT).toContain("hasAttribute('data-cx-motion')");
    expect(PLAY_WHEN_SEEN_SCRIPT).toContain('IntersectionObserver');
  });
});
