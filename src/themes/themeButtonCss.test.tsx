import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { minimalTheme } from './minimal/theme';
import { classicTheme } from './classic/theme';
import { boldTheme } from './bold/theme';
import { minimalTokens } from './minimal/tokens';
import { THEME_BUTTON_SELECTORS, mergeTokens, themeButtonCss } from './tokens';
import type { Theme } from './types';

// The theme button radius (token `spacing.radius.button`) is applied by ONE
// rule that re-scopes two radius variables on the buttons of a few sections
// (themeButtonCss in tokens.ts); the sections themselves are not edited. This
// test renders every layout of those sections and checks what the selectors
// reach: the call-to-action links, the newsletter submit button and its input
// wrapper, and nothing else.

const PRIMARY = 'Primary button';
const SECONDARY = 'Secondary button';
const SUBMIT = 'Join the list';
const CONTENT = {
  eyebrow: 'Eyebrow',
  heading: 'Heading',
  subheading: 'Subheading',
  body: 'Body text',
  cta_text: PRIMARY,
  cta_secondary_text: SECONDARY,
  button_label: SUBMIT,
};
const IMAGE = '/uploads/pages/sample.jpg';
const URLS = { cta_url: '/products', cta_secondary_url: '/about' };

interface Case {
  theme: Theme;
  key: string;
  name: string;
  settings: Record<string, unknown>;
  /** Buttons the section renders in this layout. */
  buttons: string[];
}

const both = [PRIMARY, SECONDARY];
const CASES: Case[] = [
  // hero-banner: minimal has two buttons in every layout.
  ...['centered', 'image-background', 'side-by-side'].flatMap((layout) =>
    ['left', 'center', 'right'].map((alignment) => ({
      theme: minimalTheme,
      key: 'hero-banner',
      name: `${layout}, ${alignment}`,
      settings: { layout, alignment, image: IMAGE, ...URLS },
      buttons: both,
    })),
  ),
  { theme: minimalTheme, key: 'hero-banner', name: 'defaults, no image', settings: { ...URLS }, buttons: both },
  // The classic hero has one button (it uses --theme-radius-sm).
  { theme: classicTheme, key: 'hero-banner', name: 'with an image', settings: { image: IMAGE, ...URLS }, buttons: [PRIMARY] },
  { theme: classicTheme, key: 'hero-banner', name: 'no image', settings: { ...URLS }, buttons: [PRIMARY] },
  // hero-split: framed and edge to edge.
  { theme: minimalTheme, key: 'hero-split', name: 'framed', settings: { image: IMAGE, ...URLS }, buttons: both },
  { theme: minimalTheme, key: 'hero-split', name: 'framed, image at the end', settings: { image: IMAGE, image_side: 'end', ...URLS }, buttons: both },
  { theme: minimalTheme, key: 'hero-split', name: 'bleed', settings: { variant: 'bleed', image: IMAGE, cta_arrow: true, ...URLS }, buttons: both },
  { theme: minimalTheme, key: 'hero-split', name: 'bleed, no image', settings: { variant: 'bleed', tone: 'primary', ...URLS }, buttons: both },
  // image-with-text: framed and edge to edge.
  { theme: minimalTheme, key: 'image-with-text', name: 'framed', settings: { image: IMAGE, ...URLS }, buttons: both },
  { theme: minimalTheme, key: 'image-with-text', name: 'framed, no image', settings: { image_position: 'right', ...URLS }, buttons: both },
  { theme: minimalTheme, key: 'image-with-text', name: 'bleed', settings: { image_style: 'bleed', image: IMAGE, ...URLS }, buttons: both },
  { theme: minimalTheme, key: 'image-with-text', name: 'bleed, no image', settings: { image_style: 'bleed', tone: 'accent', ...URLS }, buttons: both },
  // call-to-action: one button in every style.
  ...['solid', 'gradient', 'image-bg', 'split'].map((style) => ({
    theme: minimalTheme,
    key: 'call-to-action',
    name: style,
    settings: { style, image: IMAGE, ...URLS },
    buttons: [PRIMARY],
  })),
  { theme: classicTheme, key: 'call-to-action', name: 'classic card', settings: { ...URLS }, buttons: [PRIMARY] },
  // newsletter-signup: the submit button and the input wrapper beside it.
  ...['card', 'inline', 'banner'].map((style) => ({
    theme: minimalTheme,
    key: 'newsletter-signup',
    name: style,
    settings: { style },
    buttons: [SUBMIT],
  })),
];

/** The section inside the wrappers the storefront and the builder render. */
function mount(theme: Theme, key: string, settings: Record<string, unknown>, wrapperKey = key): HTMLElement {
  const Component = theme.sections[key].Component;
  const markup = renderToStaticMarkup(
    <div className="store-root">
      <div data-section-id="s1" data-section-key={wrapperKey}>
        <Component locale="en" primaryLocale="en" storeSlug="demo" settings={settings} content={CONTENT} builderPreview={false} />
      </div>
    </div>,
  );
  const host = document.createElement('div');
  host.innerHTML = markup;
  return host;
}

const SELECTOR = THEME_BUTTON_SELECTORS.join(',');
const matched = (host: HTMLElement) => Array.from(host.querySelectorAll<HTMLElement>(SELECTOR));
const inlineRadius = (el: HTMLElement) => el.style.getPropertyValue('border-radius');
const text = (el: Element) => (el.textContent ?? '').trim();

/** What a matched element is: a button label, or the newsletter input wrapper. */
function role(el: HTMLElement): string {
  if (el.tagName === 'A') return text(el);
  if (el.tagName === 'BUTTON' && el.getAttribute('type') === 'submit') return text(el);
  if (el.tagName === 'DIV' && el.querySelector(':scope > input[type="email"]')) return 'input wrapper';
  return `unexpected <${el.tagName.toLowerCase()}>`;
}

describe('theme button radius: what the selectors reach', () => {
  it('the listed sections exist in every theme (bold inherits minimal)', () => {
    for (const key of ['hero-banner', 'hero-split', 'image-with-text', 'call-to-action', 'newsletter-signup']) {
      expect(THEME_BUTTON_SELECTORS.some((s) => s.includes(`[data-section-key="${key}"]`)), key).toBe(true);
      for (const theme of [minimalTheme, classicTheme, boldTheme]) expect(theme.sections[key], `${theme.key} ${key}`).toBeDefined();
      expect(boldTheme.sections[key]).toBe(minimalTheme.sections[key]);
    }
    // Classic overrides exactly the two sections rendered separately below.
    const overridden = Object.keys(classicTheme.sections).filter((k) => classicTheme.sections[k] !== minimalTheme.sections[k]);
    expect(overridden.sort()).toEqual(['call-to-action', 'hero-banner']);
  });

  for (const c of CASES) {
    it(`${c.theme.key} ${c.key} (${c.name}): only its buttons are matched, and all of them`, () => {
      const host = mount(c.theme, c.key, c.settings);
      const hits = matched(host);
      const expected = c.key === 'newsletter-signup' ? ['input wrapper', ...c.buttons] : c.buttons;
      expect(hits.map(role)).toEqual(expected);

      // Every matched element follows a theme radius variable the rule
      // re-scopes: the pill radius, or the small one in the classic theme.
      for (const el of hits) {
        expect(['var(--theme-radius-full)', 'var(--theme-radius-sm)'], role(el)).toContain(inlineRadius(el));
      }
      // No other element of the section carries the pill radius, so nothing
      // that should follow the theme button radius is left out.
      const pills = Array.from(host.querySelectorAll<HTMLElement>('[style]')).filter(
        (el) => inlineRadius(el).includes('var(--theme-radius-full)'),
      );
      for (const el of pills) expect(hits, `<${el.tagName.toLowerCase()}> ${text(el)}`).toContain(el);
      // Nothing inside a button reads the two re-scoped variables for anything else.
      for (const el of hits) {
        for (const inner of Array.from(el.querySelectorAll<HTMLElement>('[style]'))) {
          expect(inner.getAttribute('style')).not.toMatch(/--theme-radius-(full|sm)/);
        }
      }
    });
  }

  it('a corner radius set on the section stays inline, so it wins over the theme button radius', () => {
    const settings = { ...URLS, image: IMAGE, cta_border_radius: 4, cta_secondary_border_radius: 6 };
    for (const key of ['hero-banner', 'hero-split', 'image-with-text']) {
      for (const extra of [{}, { variant: 'bleed', image_style: 'bleed' }]) {
        const hits = matched(mount(minimalTheme, key, { ...settings, ...extra }));
        expect(hits.map(role)).toEqual(both);
        expect(hits.map(inlineRadius)).toEqual(['4px', '6px']);
      }
    }
    const cta = matched(mount(minimalTheme, 'call-to-action', settings));
    expect(cta.map(inlineRadius)).toEqual(['4px']);
    const newsletter = matched(mount(minimalTheme, 'newsletter-signup', { cta_border_radius: 4 }));
    // The submit button takes the section value; the input wrapper keeps following the theme.
    expect(newsletter.map(inlineRadius)).toEqual(['var(--theme-radius-full)', '4px']);
  });

  it('matches nothing outside the listed sections or outside .store-root', () => {
    // The same markup under another section key.
    for (const c of CASES) {
      expect(matched(mount(c.theme, c.key, c.settings, 'rich-text')), `${c.theme.key} ${c.key} ${c.name}`).toEqual([]);
    }
    // Sections that read the token themselves or have no button.
    const progress = mount(minimalTheme, 'progress-spotlight', { ...minimalTheme.sections['progress-spotlight'].defaultSettings, cta_url: '/x' });
    expect(matched(progress)).toEqual([]);
    const progressButton = progress.querySelector<HTMLElement>('a')!;
    expect(inlineRadius(progressButton)).toBe('var(--theme-radius-button, var(--theme-radius-full))');
    // Without the .store-root ancestor (the dashboard, a body-level portal).
    const host = mount(minimalTheme, 'hero-banner', { ...URLS });
    host.querySelector('.store-root')!.classList.remove('store-root');
    expect(matched(host)).toEqual([]);
  });
});

describe('theme button radius: the rule', () => {
  const set = mergeTokens(minimalTokens, { spacing: { radius: { button: '0px' } } });

  it('is one rule over exactly these selectors, and empty when the token is unset', () => {
    expect(themeButtonCss(mergeTokens(minimalTokens, undefined))).toBe('');
    expect(themeButtonCss(mergeTokens(minimalTokens, {}))).toBe('');
    const css = themeButtonCss(set);
    expect(css).toBe(
      `${SELECTOR}{--theme-radius-full:var(--theme-radius-button);--theme-radius-sm:var(--theme-radius-button)}`,
    );
    expect(css.match(/\{/g)).toHaveLength(1);
    expect(css).not.toContain('<');
    // The value itself is never spliced into the rule (it lives in the variable).
    expect(css).not.toContain('0px');
  });

  it('parses as a stylesheet whose single rule selects the same elements', () => {
    const style = document.createElement('style');
    style.textContent = themeButtonCss(set);
    document.head.appendChild(style);
    try {
      const rules = Array.from(style.sheet!.cssRules) as CSSStyleRule[];
      expect(rules).toHaveLength(1);
      expect(rules[0].style.getPropertyValue('--theme-radius-full')).toBe('var(--theme-radius-button)');
      expect(rules[0].style.getPropertyValue('--theme-radius-sm')).toBe('var(--theme-radius-button)');
      expect(rules[0].style.length).toBe(2);
      const host = mount(minimalTheme, 'hero-split', { variant: 'bleed', image: IMAGE, ...URLS });
      expect(Array.from(host.querySelectorAll(rules[0].selectorText)).map((el) => text(el))).toEqual(both);
    } finally {
      style.remove();
    }
  });
});
