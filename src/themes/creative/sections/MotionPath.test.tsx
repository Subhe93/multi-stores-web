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

import { FIXTURES } from '../demo/fixtures/b3';
import { motionPathSection } from './MotionPath';

const Component = motionPathSection.Component;

const STOPS = [
  { label: 'Step 01', title: 'First', text: 'One', image: '/uploads/a.jpg', image_alt: 'A photo' },
  { label: 'Step 02', title: 'Second', text: 'Two', cta_text: 'Read more', cta_url: '/about' },
  { label: 'Step 03', title: 'Third', text: 'Three' },
];

function html(
  settings: Record<string, unknown> = {},
  content: Record<string, unknown> = { heading: 'From here to *there*', stops: STOPS },
  extra: { locale?: string; builderPreview?: boolean } = {},
): string {
  return renderToStaticMarkup(
    <Component
      settings={{ ...motionPathSection.defaultSettings, ...settings }}
      content={content}
      locale={extra.locale || 'en'}
      primaryLocale="en"
      storeSlug="demo"
      {...({ builderPreview: extra.builderPreview } as object)}
    />,
  );
}

/** The markup as a detached document (no script runs, no effect). */
function dom(markup: string): Document {
  return new DOMParser().parseFromString(`<main>${markup}</main>`, 'text/html');
}

describe('motion-path section', () => {
  it('renders the complete content with no client effect', () => {
    const doc = dom(
      html({}, { eyebrow: 'The journey', heading: 'From here to *there*', subheading: 'Three steps', stops: STOPS }),
    );
    const section = doc.querySelector('[data-cx-section="motion-path"]')!;
    expect(section).not.toBeNull();
    expect(section.querySelector('h2')!.textContent).toBe('From here to there');
    expect(section.querySelector('em.cx-em')!.textContent).toBe('there');
    expect(section.querySelector('.cx-eyebrow')!.textContent).toBe('The journey');
    expect(section.querySelector('.cx-mp-sub')!.textContent).toBe('Three steps');
    const stops = section.querySelectorAll('ol.cx-mp-stops > li.cx-mp-stop');
    expect(stops).toHaveLength(3);
    expect(Array.from(section.querySelectorAll('h3')).map((h) => h.textContent)).toEqual(['First', 'Second', 'Third']);
    expect(section.querySelector('.cx-mp-link')!.getAttribute('href')).toBe('/about');
    expect(section.querySelector('.cx-mp-media img')!.getAttribute('alt')).toBe('A photo');
    // The heading labels the section.
    expect(section.getAttribute('aria-labelledby')).toBe(section.querySelector('h2')!.id);
  });

  it('the static state is the finished one: line and trail drawn, nothing hidden or marked live', () => {
    const doc = dom(html());
    expect(doc.querySelectorAll('.cx-mp-layer svg')).toHaveLength(2);
    expect(doc.querySelector('.cx-mp-trail')!.getAttribute('style')).toBeNull();
    expect(doc.querySelector('.cx-mp-art')!.getAttribute('style')).toBeNull();
    expect(doc.querySelector('[data-cx-live],[data-cx-passed],[data-cx-state]')).toBeNull();
    // Decorative parts are hidden from assistive technology and not focusable.
    expect(doc.querySelector('.cx-mp-rail')!.getAttribute('aria-hidden')).toBe('true');
    for (const dot of doc.querySelectorAll('.cx-mp-dot')) {
      expect(dot.getAttribute('aria-hidden')).toBe('true');
      expect(dot.hasAttribute('tabindex')).toBe(false);
    }
    for (const path of doc.querySelectorAll('.cx-mp-p')) {
      expect(path.getAttribute('vector-effect')).toBe('non-scaling-stroke');
    }
  });

  it('nothing set: nothing on the live store, the empty state in the builder', () => {
    expect(html({}, {})).toBe('');
    expect(html({}, { stops: [{}, { label: '  ' }] })).toBe('');
    const builder = html({}, {}, { builderPreview: true });
    expect(builder).toContain('data-cx-empty="motion-path"');
    expect(builder).toContain('creative.empty.motionPath');
  });

  it('a heading without stops renders the heading only', () => {
    const doc = dom(html({}, { heading: 'How it works' }));
    expect(doc.querySelector('h2')!.textContent).toBe('How it works');
    expect(doc.querySelector('.cx-mp-body')).toBeNull();
  });

  it('one stop has no line to travel and starts no behaviour', () => {
    const doc = dom(html({}, { heading: 'One', stops: STOPS.slice(0, 1) }));
    expect(doc.querySelectorAll('.cx-mp-stop')).toHaveLength(1);
    expect(doc.querySelector('.cx-mp-rail')).toBeNull();
    expect(doc.querySelector('[data-cx-behavior]')).toBeNull();
  });

  it('keeps at most seven stops', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ title: `Stop ${i + 1}` }));
    const doc = dom(html({}, { heading: 'Many', stops: many }));
    expect(doc.querySelectorAll('.cx-mp-stop')).toHaveLength(7);
    expect(doc.querySelector('.cx-mp-svg')!.getAttribute('viewBox')).toBe('0 0 100 600');
  });

  it('cards alternate sides, or use one side (always beside a sticky heading)', () => {
    const sides = (settings: Record<string, unknown>) =>
      Array.from(dom(html(settings)).querySelectorAll('.cx-mp-stop')).map((li) => li.getAttribute('data-cx-side'));
    expect(sides({})).toEqual(['start', 'end', 'start']);
    expect(sides({ cards_side: 'one-side' })).toEqual(['end', 'end', 'end']);
    expect(sides({ heading_position: 'sticky' })).toEqual(['end', 'end', 'end']);
    expect(dom(html({ heading_position: 'sticky' })).querySelector('.cx-mp-in')!.getAttribute('data-cx-layout')).toBe(
      'side',
    );
  });

  it('artwork size is sm or md only; anything else reads as md', () => {
    const size = (value: unknown) =>
      dom(html({ artwork: '/uploads/sun.svg', artwork_size: value }))
        .querySelector('.cx-mp-body')!
        .getAttribute('style');
    expect(size('sm')).toContain('--cx-mp-art:40px');
    expect(size('md')).toContain('--cx-mp-art:64px');
    for (const junk of ['lg', 'xl', 'giant', 400, undefined]) expect(size(junk)).toContain('--cx-mp-art:64px');
  });

  it('the artwork is decorative; without one a plain bead travels', () => {
    const withArt = dom(html({ artwork: '/uploads/sun.svg' }));
    const img = withArt.querySelector('.cx-mp-art img')!;
    expect(img.getAttribute('alt')).toBe('');
    expect(withArt.querySelector('.cx-mp-bead')).toBeNull();
    expect(dom(html()).querySelector('.cx-mp-art .cx-mp-bead')).not.toBeNull();
  });

  it('colours reach the style only as hex values', () => {
    const style = dom(html({ path_color: '#112233', trail_color: 'red;background:url(x)', marker_color: '#abc' }))
      .querySelector('.cx-mp-body')!
      .getAttribute('style')!;
    expect(style).toContain('--cx-mp-path:#112233');
    expect(style).toContain('--cx-mp-marker:#abc');
    expect(style).not.toContain('--cx-mp-trail');
    expect(style).not.toContain('url(');
  });

  it('shape and style fall back to wave / line; a straight path draws the plain line only', () => {
    const body = (settings: Record<string, unknown>) => dom(html(settings)).querySelector('.cx-mp-body')!;
    expect(body({ path_style: 'neon' }).getAttribute('data-cx-style')).toBe('line');
    expect(body({ path_shape: 'spiral' }).querySelectorAll('.cx-mp-base .cx-mp-p-shape')).toHaveLength(1);
    const straight = body({ path_shape: 'straight' });
    expect(straight.hasAttribute('data-cx-shaped')).toBe(false);
    expect(straight.querySelectorAll('.cx-mp-p-shape')).toHaveLength(0);
    expect(straight.querySelectorAll('.cx-mp-base .cx-mp-p-line')).toHaveLength(1);
  });

  it('the scene goes on the section root', () => {
    const root = dom(html({ scene: 'dark', scene_bg: '#111111' })).querySelector('[data-cx-section="motion-path"]')!;
    expect(root.getAttribute('data-cx-scene')).toBe('dark');
    expect(root.getAttribute('style')).toContain('--cx-bg:#111111');
    expect(dom(html({ scene: 'none' })).querySelector('[data-cx-scene]')).toBeNull();
  });

  it('Arabic: logical classes only, no mirrored image, words never split into characters', () => {
    const fixture = FIXTURES.find((f) => f.section_key === 'motion-path')!;
    const markup = html({ ...fixture.settings, artwork_flip_rtl: false }, fixture.content.ar, { locale: 'ar' });
    const doc = dom(markup);
    const physical = /^(?:[a-z-]+:)*-?(?:ml|mr|pl|pr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r)(?:-|$)/;
    for (const el of doc.querySelectorAll('[class]')) {
      for (const cls of (el.getAttribute('class') || '').split(/\s+/)) expect(cls, cls).not.toMatch(physical);
    }
    // No inline mirror anywhere; the opt-in artwork mirror is a CSS rule on a marked wrapper.
    expect(markup.replace(/<style[^>]*>[^<]*<\/style>/g, '')).not.toMatch(/scaleX\(-1\)|scale\(-1/);
    expect(doc.querySelector('[data-cx-flip]')).toBeNull();
    for (const word of doc.querySelectorAll('.cx-wi')) expect(word.textContent!.length).toBeGreaterThan(1);
    // The Arabic accent phrase is marked so the stylesheet keeps it upright.
    expect(doc.querySelector('em.cx-em')!.getAttribute('data-cx-script')).toBe('arabic');
    expect(doc.querySelector('.cx-mp-label')!.getAttribute('data-cx-script')).toBe('arabic');
  });

  it('artwork_flip_rtl only marks the artwork wrapper', () => {
    const doc = dom(html({ artwork: '/uploads/van.svg', artwork_flip_rtl: true }));
    expect(doc.querySelectorAll('[data-cx-flip]')).toHaveLength(1);
    expect(doc.querySelector('.cx-mp-art-img')!.hasAttribute('data-cx-flip')).toBe(true);
    expect(doc.querySelector('.cx-mp-media [data-cx-flip]')).toBeNull();
  });

  it('demo fixtures are neutral', () => {
    const text = JSON.stringify(FIXTURES);
    expect(text).not.toMatch(/memory of kurds/i);
    expect(text).not.toMatch(/newroj|noroj/i);
    // Each scene and each backdrop is shown once on an existing section.
    const styles = FIXTURES.filter((f) => f.section_key !== 'motion-path').map(
      (f) => f.settings._style as Record<string, unknown>,
    );
    expect(styles.map((s) => s.scene).sort()).toEqual(['accent', 'dark', 'light']);
    expect(styles.map((s) => s.backdrop).sort()).toEqual(['dots', 'glow', 'particles']);
  });
});
