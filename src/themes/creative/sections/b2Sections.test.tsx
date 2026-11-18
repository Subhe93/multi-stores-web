import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string, values?: Record<string, string>) => {
    if (k === 'storyProgress' && values) return `${values.current} / ${values.total}`;
    return ns ? `${ns}.${k}` : k;
  },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSelectedLayoutSegment: () => null,
}));
// The island is covered by engine/core.test.tsx.
vi.mock('../engine/core', () => ({ register: () => () => {} }));

import type { SectionDefinition, SectionRenderProps } from '../../types';
import { G, G_RTL } from '../css/base.css';
import { MARQUEE_BAND_CSS } from '../css/marqueeBand.css';
import { STICKY_STEPS_CSS } from '../css/stickySteps.css';
import { STORY_PINNED_CSS } from '../css/storyPinned.css';
import { FIXTURES } from '../demo/fixtures/b2';
import { marqueeBandSection } from './MarqueeBand';
import { stickyStepsSection } from './StickySteps';
import { storyPinnedSection } from './StoryPinned';

function markup(
  def: SectionDefinition,
  settings: Record<string, unknown>,
  content: Record<string, unknown>,
  extra: Partial<SectionRenderProps> = {},
) {
  const C = def.Component;
  const html = renderToStaticMarkup(
    <C settings={settings} content={content} locale="en" primaryLocale="en" storeSlug="demo" {...extra} />,
  );
  // Without the hoisted <style> blocks and the flag script.
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
}

function dom(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

const fixture = (key: string, index = 0) => FIXTURES.filter((f) => f.section_key === key)[index];

// Physical Tailwind utilities and physical CSS properties are not allowed.
const PHYSICAL_CLASS = /class="[^"]*\b(?:ml|mr|pl|pr|left|right|text-left|text-right|rounded-[lr]|border-[lr])-/;
const PHYSICAL_CSS = /(?:margin|padding|border)-(?:left|right)|(?:^|[;{\s])(?:left|right)\s*:/;
const MIRROR = /scaleX\(-1\)|scale:\s*-1|rotateY\(180/;

/** True when the declaration at `index` sits in a rule whose selector starts with the gate. */
function gated(css: string, index: number): boolean {
  return css.lastIndexOf(G, index) > css.lastIndexOf('}', index);
}

describe('fixtures of B2', () => {
  it('never carry the old tagline or a client name', () => {
    const text = JSON.stringify(FIXTURES).toLowerCase();
    expect(text).not.toContain('memory of kurds');
    expect(text).not.toContain('newroj');
  });
});

describe('story-pinned', () => {
  const fx = fixture('story-pinned');

  it('renders the complete story as static markup', () => {
    const html = markup(storyPinnedSection, fx.settings, fx.content.en);
    const root = dom(html);
    const section = root.querySelector('[data-cx-section="story-pinned"]') as HTMLElement;
    expect(section).toBeTruthy();
    expect(section.getAttribute('data-cx-scene')).toBe('light');
    const cards = root.querySelectorAll('ol.cx-track-row > li.cx-sp-card');
    expect(cards.length).toBe(5);
    for (const card of Array.from(cards)) {
      expect(card.querySelector('h3')?.textContent).toBeTruthy();
      expect(card.querySelector('img')?.getAttribute('src')).toContain('/creative-demo/shared/photo-');
    }
    // Heading: markers removed, the phrase is the accent.
    const h2 = root.querySelector('h2') as HTMLElement;
    expect(h2.textContent).toBe('Made by hand,\nmade to stay.');
    expect(h2.querySelector('em.cx-em')?.textContent).toBe('made to stay.');
    expect(section.getAttribute('aria-labelledby')).toBe(h2.id);
    // Behaviour hook, item count and card width for the CSS-only track height.
    const track = root.querySelector('.cx-track') as HTMLElement;
    expect(track.getAttribute('data-cx-behavior')).toBe('track');
    expect(track.style.getPropertyValue('--cx-n')).toBe('5');
    expect(track.style.getPropertyValue('--cx-card-w')).toBe('28rem');
    // Nothing depends on JavaScript yet.
    expect(html).not.toContain('data-cx-live');
    expect(html).not.toContain('data-cx-state');
    // Counter in Latin digits, skip link pointing at the end marker.
    expect(root.querySelector('.cx-sp-count')?.textContent).toBe('01 / 05');
    const skip = root.querySelector('a.cx-sp-skip') as HTMLAnchorElement;
    expect(root.querySelector(`[id="${skip.getAttribute('href')!.slice(1)}"]`)).toBeTruthy();
    expect(root.querySelector('.cx-sp-prog')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders nothing on the live store without cards and an empty state in the builder', () => {
    expect(markup(storyPinnedSection, {}, { heading: 'Our story' })).toBe('');
    const html = markup(storyPinnedSection, {}, { heading: 'Our story' }, { builderPreview: true });
    expect(html).toContain('data-cx-empty="story-pinned"');
  });

  it('heading as the first item of the row counts in the track length', () => {
    const second = fixture('story-pinned', 1);
    const root = dom(markup(storyPinnedSection, second.settings, second.content.en));
    const first = root.querySelector('ol.cx-track-row > li') as HTMLElement;
    expect(first.className).toBe('cx-sp-intro');
    expect(first.querySelector('h2')?.textContent).toBe('Why Atelier?');
    expect((root.querySelector('.cx-track') as HTMLElement).style.getPropertyValue('--cx-n')).toBe('7');
    // Panel style has no photo; numerals are the outlined primitive at md.
    expect(root.querySelector('.cx-sp-media')).toBeNull();
    expect(root.querySelector('.cx-num')?.getAttribute('data-cx-size')).toBe('md');
  });

  it('unknown stored values fall back to the defaults', () => {
    const root = dom(
      markup(
        storyPinnedSection,
        { card_width: 'giant', card_style: 'x', image_aspect: 1, numerals: 'xl', progress: 'none', hint: false },
        fx.content.en,
      ),
    );
    const section = root.querySelector('[data-cx-section]') as HTMLElement;
    expect(section.getAttribute('data-cx-card')).toBe('editorial');
    expect(section.getAttribute('data-cx-aspect')).toBe('portrait');
    expect((root.querySelector('.cx-track') as HTMLElement).style.getPropertyValue('--cx-card-w')).toBe('28rem');
    expect(root.querySelector('.cx-sp-prog')).toBeNull();
  });

  it('Arabic render: logical classes only, nothing mirrored, words are the smallest unit', () => {
    const html = markup(storyPinnedSection, fx.settings, fx.content.ar, { locale: 'ar' });
    expect(html).not.toMatch(PHYSICAL_CLASS);
    expect(html).not.toMatch(MIRROR);
    const root = dom(html);
    expect(root.querySelector('.cx-sp-label')?.getAttribute('data-cx-script')).toBe('arabic');
    for (const w of Array.from(root.querySelectorAll('.cx-wi'))) expect((w.textContent || '').length).toBeGreaterThan(1);
  });

  it('stylesheet: pinned layout only behind the gate, no physical properties', () => {
    expect(STORY_PINNED_CSS).not.toMatch(PHYSICAL_CSS);
    expect(STORY_PINNED_CSS).not.toMatch(MIRROR);
    expect(STORY_PINNED_CSS).not.toContain('prefers-reduced-motion');
    const sticky = STORY_PINNED_CSS.indexOf('position:sticky');
    expect(sticky).toBeGreaterThan(-1);
    expect(STORY_PINNED_CSS.split('position:sticky').length).toBe(2);
    expect(gated(STORY_PINNED_CSS, sticky)).toBe(true);
    expect(STORY_PINNED_CSS).toContain(`${G} .cx-track[data-cx-live] .cx-track-view{overflow-x:clip`);
    // Default: a native swipe row.
    expect(STORY_PINNED_CSS).toContain('.cx-track-view{overflow-x:auto');
  });
});

describe('sticky-steps', () => {
  const fx = fixture('sticky-steps');

  it('renders heading column and every step, static state untouched', () => {
    const html = markup(stickyStepsSection, fx.settings, fx.content.en);
    const root = dom(html);
    const list = root.querySelector('ol.cx-st-list') as HTMLElement;
    expect(list.getAttribute('data-cx-behavior')).toBe('steps');
    expect(list.hasAttribute('data-cx-line')).toBe(true);
    const steps = list.querySelectorAll(':scope > li.cx-st-step');
    expect(steps.length).toBe(5);
    expect(Array.from(steps).map((s) => s.querySelector('.cx-num')?.textContent)).toEqual(['01', '02', '03', '04', '05']);
    expect(steps[0].querySelector('.cx-num')?.getAttribute('aria-hidden')).toBe('true');
    expect(steps[0].querySelector('h3')?.textContent).toBe('You choose a piece');
    // Static state: no progress value, no passed step, not live.
    expect(list.style.getPropertyValue('--cx-p')).toBe('');
    expect(html).not.toContain('data-cx-passed');
    expect(html).not.toContain('data-cx-live');
    expect(root.querySelector('h2')?.textContent).toBe('How an order\ntakes shape');
    expect(root.querySelector('a.cx-btn')?.getAttribute('href')).toBe('/products');
  });

  it('numeral size offers sm / md only; anything else reads as md', () => {
    for (const [stored, expected] of [
      ['sm', 'sm'],
      ['md', 'md'],
      ['lg', 'md'],
      ['xl', 'md'],
      [undefined, 'md'],
    ] as const) {
      const root = dom(markup(stickyStepsSection, { numeral_size: stored }, fx.content.en));
      expect(root.querySelector('.cx-num')?.getAttribute('data-cx-size')).toBe(expected);
    }
    const none = dom(markup(stickyStepsSection, { numeral_style: 'none', progress_line: false }, fx.content.en));
    expect(none.querySelector('.cx-num')).toBeNull();
    expect(none.querySelector('.cx-st-list')?.hasAttribute('data-cx-line')).toBe(false);
  });

  it('renders nothing on the live store without steps and an empty state in the builder', () => {
    expect(markup(stickyStepsSection, {}, { heading: 'How it works' })).toBe('');
    expect(markup(stickyStepsSection, {}, { heading: 'How it works' }, { builderPreview: true })).toContain(
      'data-cx-empty="sticky-steps"',
    );
  });

  it('Arabic render: logical classes only, nothing mirrored', () => {
    const html = markup(stickyStepsSection, fx.settings, fx.content.ar, { locale: 'ar' });
    expect(html).not.toMatch(PHYSICAL_CLASS);
    expect(html).not.toMatch(MIRROR);
    expect(dom(html).querySelector('em.cx-em')?.getAttribute('data-cx-script')).toBe('arabic');
  });

  it('stylesheet: dimmed steps exist only under data-cx-live behind the gate; the line is full by default', () => {
    expect(STICKY_STEPS_CSS).not.toMatch(PHYSICAL_CSS);
    expect(STICKY_STEPS_CSS).toContain('scaleY(var(--cx-p,1))');
    expect(STICKY_STEPS_CSS).toContain(
      `${G} .cx-st-list[data-cx-live] .cx-st-step:not([data-cx-passed]) .cx-st-c{opacity:.45}`,
    );
    expect(STICKY_STEPS_CSS.split('opacity:.45').length).toBe(2);
    // The sticky heading column needs no gate.
    expect(STICKY_STEPS_CSS).toContain('.cx-st-head{position:sticky');
  });
});

describe('marquee-band', () => {
  const fx = fixture('marquee-band');

  it('static default: one real list, copies and the second row hidden from assistive technology, no island', () => {
    const html = markup(marqueeBandSection, fx.settings, fx.content.en);
    const root = dom(html);
    expect(html).not.toContain('data-cx-anchor');
    const rows = root.querySelectorAll('.cx-mq-row');
    expect(rows.length).toBe(2);
    const real = rows[0].querySelectorAll('ul.cx-mq-list:not(.cx-mq-copy)');
    expect(real.length).toBe(1);
    expect(Array.from(real[0].querySelectorAll('.cx-mq-t')).map((t) => t.textContent)).toEqual([
      'Craft',
      'Colour',
      'Made to last',
      'Small batches',
      'Everyday pieces',
      'Atelier',
    ]);
    const copies = root.querySelectorAll('ul.cx-mq-copy');
    expect(copies.length).toBeGreaterThan(0);
    for (const copy of Array.from(copies)) {
      expect(copy.getAttribute('aria-hidden')).toBe('true');
      expect(copy.hasAttribute('inert')).toBe(true);
    }
    expect(rows[1].getAttribute('aria-hidden')).toBe('true');
    expect(rows[1].hasAttribute('inert')).toBe(true);
    expect(rows[1].querySelector('ul.cx-mq-list:not(.cx-mq-copy)')).toBeNull();
    // An even number of lists per track: the keyframes move by exactly half.
    for (const track of Array.from(root.querySelectorAll('.cx-mq-track'))) {
      expect(track.children.length % 2).toBe(0);
      expect(track.hasAttribute('data-cx-loop')).toBe(true);
    }
    // Mixed style alternates; the separator is the symbol image, decorative.
    expect(Array.from(real[0].querySelectorAll('.cx-mq-t')).map((t) => t.getAttribute('data-cx-look'))).toEqual([
      null,
      'outline',
      null,
      'outline',
      null,
      'outline',
    ]);
    const sep = real[0].querySelector('.cx-mq-sep') as HTMLElement;
    expect(sep.getAttribute('aria-hidden')).toBe('true');
    expect(sep.querySelector('img')?.getAttribute('alt')).toBe('');
    // CSS-only pause control.
    const toggle = root.querySelector('input.cx-mq-toggle') as HTMLInputElement;
    expect(toggle.type).toBe('checkbox');
    expect(root.querySelector(`label[for="${toggle.id}"]`)?.textContent).toBe(
      'creative.marqueePausecreative.marqueePlay',
    );
  });

  it('size goes through accentSize: sm / md only', () => {
    for (const [stored, expected] of [
      ['sm', 'sm'],
      ['md', 'md'],
      ['lg', 'md'],
      ['giant', 'md'],
      [undefined, 'md'],
    ] as const) {
      const root = dom(markup(marqueeBandSection, { size: stored }, fx.content.en));
      expect(root.querySelector('[data-cx-section]')?.getAttribute('data-cx-size')).toBe(expected);
    }
  });

  it('one row, no separator for chips, links kept, Arabic never outlined', () => {
    const content = { items: [{ text: 'حِرفة', url: '/about' }, { text: 'Atelier' }] };
    const root = dom(
      markup(marqueeBandSection, { rows: '1', item_style: 'pill', text_style: 'outline' }, content, {
        locale: 'ar',
        primaryLocale: 'ar',
      }),
    );
    expect(root.querySelectorAll('.cx-mq-row').length).toBe(1);
    expect(root.querySelector('.cx-mq-sep')).toBeNull();
    const first = root.querySelector('ul.cx-mq-list:not(.cx-mq-copy) .cx-mq-item') as HTMLElement;
    expect(first.querySelector('a.cx-mq-c')?.getAttribute('href')).toContain('/about');
    const texts = root.querySelectorAll('ul.cx-mq-list:not(.cx-mq-copy) .cx-mq-t');
    expect(texts[0].getAttribute('data-cx-script')).toBe('arabic');
    expect(texts[0].hasAttribute('data-cx-look')).toBe(false);
    expect(texts[1].getAttribute('data-cx-look')).toBe('outline');
  });

  it('renders nothing on the live store without items and an empty state in the builder', () => {
    expect(markup(marqueeBandSection, {}, { items: [] })).toBe('');
    expect(markup(marqueeBandSection, {}, { items: [] }, { builderPreview: true })).toContain(
      'data-cx-empty="marquee-band"',
    );
  });

  it('Arabic render: logical classes only, images never mirrored', () => {
    const second = fixture('marquee-band', 1);
    const html = markup(marqueeBandSection, second.settings, second.content.ar, { locale: 'ar' });
    expect(html).not.toMatch(PHYSICAL_CLASS);
    expect(html).not.toMatch(MIRROR);
    expect(dom(html).querySelector('.cx-mq-h')?.getAttribute('data-cx-script')).toBe('arabic');
  });

  it('stylesheet: static by default, direction variable flips in RTL and for the second row', () => {
    expect(MARQUEE_BAND_CSS).not.toMatch(PHYSICAL_CSS);
    expect(MARQUEE_BAND_CSS).not.toMatch(MIRROR);
    // Default (no gate): copies, the second row and the control are not displayed.
    expect(MARQUEE_BAND_CSS).toContain('.cx-mq-copy{display:none}');
    expect(MARQUEE_BAND_CSS).toContain('.cx-mq-row[data-cx-row="2"]{display:none}');
    expect(MARQUEE_BAND_CSS).toContain('.cx-mq-toggle,.cx-mq-ctl{display:none}');
    // The animation exists only behind the gate.
    const anim = MARQUEE_BAND_CSS.indexOf('animation:cx-mq ');
    expect(MARQUEE_BAND_CSS.split('animation:cx-mq ').length).toBe(2);
    expect(gated(MARQUEE_BAND_CSS, anim)).toBe(true);
    expect(MARQUEE_BAND_CSS).toContain(`${G} .cx-mq-track{--cx-dir:-1;--cx-off:0;`);
    expect(MARQUEE_BAND_CSS).toContain(`${G_RTL} .cx-mq-track{--cx-dir:1}`);
    expect(MARQUEE_BAND_CSS).toContain(`${G} .cx-mq-row[data-cx-row="2"] .cx-mq-track{--cx-dir:1;--cx-off:-50}`);
    expect(MARQUEE_BAND_CSS).toContain(`${G_RTL} .cx-mq-row[data-cx-row="2"] .cx-mq-track{--cx-dir:-1;--cx-off:50}`);
    expect(MARQUEE_BAND_CSS).toContain('var(--cx-dir,-1) * 50%');
    // Pause on hover, focus and through the checkbox.
    expect(MARQUEE_BAND_CSS).toContain('.cx-mq-toggle:checked~.cx-mq-row .cx-mq-track{animation-play-state:paused}');
  });
});
