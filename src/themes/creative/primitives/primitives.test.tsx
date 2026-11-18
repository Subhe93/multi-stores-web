import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
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

import { MOTION_FLAG_SCRIPT } from '../motionFlag';
import { BASE_CSS } from '../css/base.css';
import { CxAssets, CxSection, EmptyState, Eyebrow, HeadingText, MaskReveal, Numeral, OutlineAccent, PillButton } from '.';

/** Static markup without the hoisted <style> block React puts first. */
function body(html: string): string {
  return html.replace(/<style[^>]*>[^<]*<\/style>/g, '');
}

function heading(node: React.ReactElement) {
  const { container } = render(<h2>{node}</h2>);
  return container.querySelector('h2') as HTMLElement;
}

describe('HeadingText', () => {
  it('reveal none + emphasis none is the plain text, markers printed literally', () => {
    const h = heading(<HeadingText text={'More than *just a drink*'} />);
    expect(h.innerHTML).toBe('More than *just a drink*');
  });

  it('split into words keeps the text content, spaces and line breaks (Latin)', () => {
    const text = 'Made with care\nfor every day';
    const h = heading(<HeadingText text={text} reveal="scroll" />);
    expect(h.textContent).toBe(text);
    const words = h.querySelectorAll('.cx-w > .cx-wi');
    expect(Array.from(words).map((w) => w.textContent)).toEqual(['Made', 'with', 'care', 'for', 'every', 'day']);
    // Running stagger index across lines.
    expect(Array.from(words).map((w) => (w as HTMLElement).style.getPropertyValue('--cx-i'))).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    const wrapper = h.querySelector('.cx-ht') as HTMLElement;
    expect(wrapper.getAttribute('data-cx-reveal')).toBe('words');
    expect(wrapper.hasAttribute('data-cx-intro')).toBe(false);
    // The line break stays a real "\n" text node (white-space: pre-line on the heading).
    expect(Array.from(wrapper.childNodes).some((n) => n.nodeType === 3 && n.textContent === '\n')).toBe(true);
  });

  it('intro mode marks the wrapper for the CSS intro and carries the delay', () => {
    const h = heading(<HeadingText text="Hello there" reveal="intro" delay={0.3} />);
    const wrapper = h.querySelector('.cx-ht') as HTMLElement;
    expect(wrapper.getAttribute('data-cx-intro')).toBe('words');
    expect(wrapper.hasAttribute('data-cx-reveal')).toBe(false);
    expect(wrapper.style.getPropertyValue('--cx-delay')).toBe('0.3s');
  });

  it('Arabic is split into words only, never characters', () => {
    const text = 'كل عملية شراء\nفرصة جديدة';
    const h = heading(<HeadingText text={text} reveal="scroll" />);
    expect(h.textContent).toBe(text);
    const words = Array.from(h.querySelectorAll('.cx-wi')).map((w) => w.textContent);
    expect(words).toEqual(['كل', 'عملية', 'شراء', 'فرصة', 'جديدة']);
    // Every innermost span holds a whole word.
    for (const span of Array.from(h.querySelectorAll('span'))) {
      if (span.children.length === 0) expect(words).toContain(span.textContent);
    }
  });

  it('emphasis wraps the marked phrase as whole words and removes the markers', () => {
    const h = heading(<HeadingText text={'More than *just a drink*'} reveal="scroll" emphasis="italic" />);
    expect(h.textContent).toBe('More than just a drink');
    const em = h.querySelector('em.cx-em') as HTMLElement;
    expect(em.getAttribute('data-cx-em')).toBe('italic');
    expect(em.getAttribute('data-text-look')).toBe('heading');
    expect(em.hasAttribute('data-cx-script')).toBe(false);
    expect(em.style.color).toBe('var(--theme-colors-accent)');
    expect(em.style.fontSize).toBe('inherit');
    expect(Array.from(em.querySelectorAll(':scope > .cx-w')).map((w) => w.textContent)).toEqual(['just', 'a', 'drink']);
    // No word wrapper is cut by the em.
    for (const w of Array.from(h.querySelectorAll('.cx-w'))) expect(w.querySelector('em')).toBeNull();
  });

  it('emphasis without a reveal renders text and one em, no word spans', () => {
    const h = heading(<HeadingText text={'Culture, *reimagined.*'} emphasis="color" emphasisColor="#aa2233" />);
    expect(h.innerHTML).not.toContain('cx-w');
    expect(h.textContent).toBe('Culture, reimagined.');
    const em = h.querySelector('em') as HTMLElement;
    expect(em.textContent).toBe('reimagined.');
    expect(em.getAttribute('data-cx-em')).toBe('color');
    expect(em.style.color).toBe('rgb(170, 34, 51)');
  });

  it('emphasis none keeps the asterisks even when the heading is split', () => {
    const h = heading(<HeadingText text={'More than *just*'} reveal="scroll" emphasis="none" />);
    expect(h.textContent).toBe('More than *just*');
    expect(h.querySelector('em')).toBeNull();
  });

  it('an Arabic accent phrase is flagged so CSS never slants it', () => {
    const h = heading(<HeadingText text={'فرصة *للتعلّم*'} reveal="scroll" emphasis="italic" />);
    const em = h.querySelector('em') as HTMLElement;
    expect(em.getAttribute('data-cx-script')).toBe('arabic');
    expect(h.textContent).toBe('فرصة للتعلّم');
    expect(BASE_CSS).toContain('.cx-em[data-cx-em][data-cx-script="arabic"]{font-style:normal;letter-spacing:0}');
  });

  it('one accent per line; unbalanced markers stay text', () => {
    const h = heading(<HeadingText text={'*One* and *two*\nRated 5*'} emphasis="italic" />);
    expect(h.querySelectorAll('em')).toHaveLength(1);
    expect(h.textContent).toBe('One and *two*\nRated 5*');
  });

  it('renders nothing for an empty text', () => {
    expect(renderToStaticMarkup(<HeadingText text="" reveal="scroll" />)).toBe('');
  });
});

describe('OutlineAccent and Numeral', () => {
  it('is decorative, sized sm / md only', () => {
    const { container } = render(<OutlineAccent text="ATELIER" size="xl" look="outline" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('data-cx-size')).toBe('md');
    expect(el.getAttribute('data-cx-accent')).toBe('outline');
    expect(el.hasAttribute('data-cx-script')).toBe(false);
    expect(render(<OutlineAccent text="ATELIER" size="sm" look="faint" />).container.firstElementChild?.getAttribute('data-cx-size')).toBe('sm');
  });

  it('falls back to faint for Arabic-script text (no text stroke on joined letters)', () => {
    const { container } = render(<OutlineAccent text="أتيليه" size="md" look="outline" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('data-cx-accent')).toBe('faint');
    expect(el.getAttribute('data-cx-script')).toBe('arabic');
  });

  it('renders nothing without text', () => {
    expect(render(<OutlineAccent text="" size="md" look="outline" />).container.innerHTML).toBe('');
  });

  it('numerals are two Latin digits, decorative, sm / md only', () => {
    const { container } = render(<Numeral n={4} look="outline" size="lg" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.textContent).toBe('04');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('data-cx-num')).toBe('outline');
    expect(el.getAttribute('data-cx-size')).toBe('md');
    expect(render(<Numeral n={12} look="solid" size="sm" />).container.firstElementChild?.textContent).toBe('12');
  });
});

describe('Eyebrow, MaskReveal, PillButton, EmptyState', () => {
  it('eyebrow flags Arabic text (no uppercase, no tracking)', () => {
    const latin = render(<Eyebrow text="Our story" intro />).container.firstElementChild as HTMLElement;
    expect(latin.tagName).toBe('P');
    expect(latin.className).toBe('cx-eyebrow');
    expect(latin.hasAttribute('data-cx-script')).toBe(false);
    expect(latin.getAttribute('data-cx-intro')).toBe('eyebrow');
    const arabic = render(<Eyebrow text="قصتنا" />).container.firstElementChild as HTMLElement;
    expect(arabic.getAttribute('data-cx-script')).toBe('arabic');
    expect(arabic.hasAttribute('data-cx-intro')).toBe(false);
    expect(render(<Eyebrow text="" />).container.innerHTML).toBe('');
  });

  it('mask reveal: intro only scales, scroll clips with a direction', () => {
    const intro = render(
      <MaskReveal mode="intro">
        <img alt="" />
      </MaskReveal>,
    ).container.firstElementChild as HTMLElement;
    expect(intro.getAttribute('data-cx-intro')).toBe('scale');
    expect(intro.hasAttribute('data-cx-reveal')).toBe(false);
    expect(intro.querySelector(':scope > .cx-mask-in > img')).not.toBeNull();

    const scroll = render(
      <MaskReveal mode="scroll" direction="start">
        <img alt="" />
      </MaskReveal>,
    ).container.firstElementChild as HTMLElement;
    expect(scroll.getAttribute('data-cx-reveal')).toBe('mask');
    expect(scroll.getAttribute('data-cx-dir')).toBe('start');
    expect(scroll.hasAttribute('data-cx-intro')).toBe(false);
  });

  it('pill button is a magnetic link with an inner layer for the pull', () => {
    const { container } = render(
      <PillButton href="/products" variant="outline" tone="accent">
        Shop now
      </PillButton>,
    );
    const a = container.querySelector('a') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('/products');
    expect(a.hasAttribute('data-cx-magnetic')).toBe(true);
    expect(a.getAttribute('data-cx-variant')).toBe('outline');
    expect(a.getAttribute('data-cx-tone')).toBe('accent');
    expect(a.className).toContain('cx-btn');
    expect(a.className).toContain('focus-visible:outline');
    expect(a.querySelector('.cx-btn-in > .cx-btn-l')?.textContent).toBe('Shop now');
    expect(a.querySelector('svg.cx-btn-arrow')?.getAttribute('aria-hidden')).toBe('true');
    expect(render(<PillButton href="#" arrow={false}>x</PillButton>).container.querySelector('svg')).toBeNull();
  });

  it('empty state reads creative.empty.<camelCase name>', () => {
    const { container } = render(<EmptyState name="hero-outline" />);
    expect(container.querySelector('[data-cx-empty="hero-outline"]')?.textContent).toBe('creative.empty.heroOutline');
  });
});

describe('CxSection', () => {
  it('renders the flag script, then the section with the island as its last child', () => {
    const html = renderToStaticMarkup(
      <CxSection name="hero-outline" css=".cx-x{color:red}" aria-labelledby="h1">
        <p>content</p>
      </CxSection>,
    );
    const markup = body(html);
    const script = markup.indexOf('<script>');
    const section = markup.indexOf('<section');
    expect(script).toBeGreaterThan(-1);
    expect(section).toBeGreaterThan(script);
    expect(html).toContain(MOTION_FLAG_SCRIPT.slice(0, 40));
    expect(html).toContain('data-cx-section="hero-outline"');
    expect(html).toContain('class="cx-bleed"');
    expect(html).toContain('aria-labelledby="h1"');
    expect(html).toMatch(/<p>content<\/p><span hidden="" data-cx-anchor=""><\/span><\/section>$/);
    // No scene: no attribute, no inline style.
    expect(markup).not.toContain('data-cx-scene');
    expect(markup).not.toContain('style="');
  });

  it('ships the base stylesheet and the section stylesheet once each, keyed for dedupe', () => {
    const html = renderToStaticMarkup(
      <>
        <CxSection name="a" css=".cx-a{color:red}">
          <p>1</p>
        </CxSection>
        <CxSection name="a" css=".cx-a{color:red}">
          <p>2</p>
        </CxSection>
      </>,
    );
    expect(html.split('.cx-a{color:red}').length - 1).toBe(1);
    expect(html.split('--cx-ease:').length - 1).toBe(1);
    // React merges the hoisted styles of one precedence and keys them by href.
    expect(html).toContain('data-precedence="cx"');
    expect(html).toMatch(/data-href="[^"]*cx-base[^"]*"/);
    expect(html).toMatch(/data-href="[^"]*cx-a[^"]*"/);
  });

  it('scene attributes and overrides land on the section element', () => {
    const { container } = render(
      <CxSection name="x" island={false} bleed={false} scene="accent" sceneBg="#aa2233" sceneText="junk" style={{ minHeight: 10 }}>
        <p>content</p>
      </CxSection>,
    );
    const el = container.querySelector('[data-cx-section="x"]') as HTMLElement;
    expect(el.getAttribute('data-cx-scene')).toBe('accent');
    expect(el.style.getPropertyValue('--cx-bg')).toBe('#aa2233');
    expect(el.style.getPropertyValue('--cx-fg')).toBe('');
    expect(el.style.minHeight).toBe('10px');
    expect(el.hasAttribute('class')).toBe(false);
    // island={false}: no anchor, zero JavaScript.
    expect(el.querySelector('[data-cx-anchor]')).toBeNull();
  });

  it('scene "none" or junk adds nothing', () => {
    for (const scene of ['none', 'pink', undefined, 3]) {
      const html = renderToStaticMarkup(
        <CxSection name="x" island={false} scene={scene}>
          <p>c</p>
        </CxSection>,
      );
      expect(body(html)).not.toContain('data-cx-scene');
    }
  });

  it('as="div" and CxAssets for existing sections', () => {
    const html = renderToStaticMarkup(
      <CxSection name="x" as="div" island={false}>
        <p>c</p>
      </CxSection>,
    );
    expect(html).toContain('<div data-cx-section="x"');
    const assets = renderToStaticMarkup(
      <div data-cx-section="">
        <CxAssets />
      </div>,
    );
    expect(assets).toContain('<script>');
    expect(assets).toContain('data-cx-anchor');
    const noIsland = renderToStaticMarkup(
      <div data-cx-section="">
        <CxAssets island={false} />
      </div>,
    );
    expect(noIsland).toContain('<script>');
    expect(noIsland).not.toContain('data-cx-anchor');
  });
});

describe('base stylesheet', () => {
  it('hides or animates nothing outside the motion gate', () => {
    const gate = 'html[data-cx-motion] .store-root';
    // Every rule that touches a pending state, an intro or a loop starts with the gate.
    for (const rule of BASE_CSS.split('}')) {
      const selector = rule.split('{')[0];
      if (/data-cx-state="pending"|data-cx-intro|data-cx-loop/.test(selector) && !rule.includes('@media print')) {
        for (const part of selector.split(',')) expect(part.trim().startsWith(gate), part).toBe(true);
      }
    }
    expect(BASE_CSS).not.toContain('prefers-reduced-motion');
  });

  it('the gate excludes store motion off and the builder preview', () => {
    expect(BASE_CSS).toContain(
      'html[data-cx-motion] .store-root:not([data-motion-reveal="off"]):not([data-cx-builder]) [data-cx-reveal="rise"][data-cx-state="pending"]',
    );
  });

  it('decorative sizes stay medium: the largest accent token caps at 3.5rem', () => {
    expect(BASE_CSS).toContain('--cx-accent-sm:clamp(1.25rem,2.4vw,2rem)');
    expect(BASE_CSS).toContain('--cx-accent-md:clamp(1.75rem,4vw,3.5rem)');
    expect(BASE_CSS).not.toMatch(/--cx-accent-(lg|xl)/);
  });

  it('uses logical properties only (no physical margin / padding / inset sides)', () => {
    expect(BASE_CSS).not.toMatch(/(margin|padding|border)-(left|right)\s*:/);
    expect(BASE_CSS).not.toMatch(/[;{](left|right)\s*:/);
    expect(BASE_CSS).not.toMatch(/text-align:(left|right)/);
  });
});
