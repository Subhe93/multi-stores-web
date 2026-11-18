import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
vi.mock('../engine/core', () => ({ register: () => () => {} }));

import { physicalClasses } from '../../minimal/sections/_shared/testHelpers';
import { G } from '../css/base.css';
import { SCRIPT_MANIFESTO_CSS } from '../css/scriptManifesto.css';
import { entry } from '../schemas/script-manifesto.schema';
import {
  manifestoActiveIndex,
  manifestoDir,
  manifestoLang,
  manifestoLines,
  scriptManifestoSection,
} from './ScriptManifesto';

const ScriptManifesto = scriptManifestoSection.Component;

// Neutral lines: no store's words live in platform code or tests.
const LINES = [
  { text: 'One sentence.\nSaid here.', label: 'English', lang: 'en', dir: 'auto' },
  { text: 'Yek hevok.', label: 'Kurdî', lang: 'ku', dir: 'auto' },
  { text: 'جملة واحدة.', label: 'العربية', lang: 'ar', dir: 'auto' },
  { text: 'En mening.', label: 'Svenska', lang: 'sv', dir: 'auto' },
];

function html(props: Partial<SectionRenderProps> = {}) {
  const markup = renderToStaticMarkup(
    <ScriptManifesto
      locale="en"
      primaryLocale="en"
      storeSlug="demo"
      settings={{ ...entry.defaultSettings, lines: LINES }}
      content={{}}
      {...props}
    />,
  );
  return markup.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
}

const texts = (out: string) =>
  [...out.matchAll(/<(p|h2) class="cx-sm-text"[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2].replace(/<[^>]+>/g, ''));

describe('script-manifesto', () => {
  it('without motion: the complete stack, no reveal or behaviour attribute', () => {
    const out = html({ content: { cta_text: 'Read more' }, settings: { ...entry.defaultSettings, lines: LINES, cta_url: '/about' } });
    expect(out).toContain('data-cx-section="script-manifesto"');
    expect(out).not.toMatch(/data-cx-(reveal|intro|behavior|hover|magnetic|d|i)=/);
    expect(texts(out)).toEqual(['One sentence.\nSaid here.', 'Yek hevok.', 'جملة واحدة.', 'En mening.']);
    // A list of real translations: nothing hidden from assistive technology.
    expect((out.match(/<li class="cx-sm-row"/g) || []).length).toBe(4);
    expect(out).not.toMatch(/<li[^>]*aria-hidden/);
    expect(out).toContain('>Kurdî</span>');
    expect(out).toMatch(/<a class="cx-sm-link" href="\/about">Read more<\/a>/);
    expect(physicalClasses(out)).toEqual([]);
  });

  it('each sentence carries its own lang and dir; Arabic script is marked, never split into characters', () => {
    const out = html({ motion: 'scroll' });
    expect(out).toMatch(/<p class="cx-sm-text" lang="ar" dir="rtl" data-text-look="heading" data-cx-script="arabic">/);
    expect(out).toMatch(/<p class="cx-sm-text" lang="ku" dir="ltr"/);
    // Words are the smallest unit.
    expect(out).toContain('>جملة</span>');
    expect(out).toContain('>واحدة.</span>');
    // Artwork and text are never mirrored by a transform.
    expect(SCRIPT_MANIFESTO_CSS).not.toMatch(/scaleX\(-1\)|scale:-1/);
  });

  it('the active row is the page locale, moved to the top; the others keep their order', () => {
    const sv = html({ locale: 'sv' });
    expect(texts(sv)).toEqual(['En mening.', 'One sentence.\nSaid here.', 'Yek hevok.', 'جملة واحدة.']);
    expect(sv).toMatch(/<li class="cx-sm-row" data-active="">[\s\S]*?En mening\./);
    expect((sv.match(/data-active=""/g) || []).length).toBe(1);
    expect((sv.match(/class="cx-sm-bar"/g) || []).length).toBe(1);

    // active_first off: stored order, the active row is still the locale's.
    const kept = html({ locale: 'ar', settings: { lines: LINES, active_first: false } });
    expect(texts(kept)[0]).toBe('One sentence.\nSaid here.');
    expect(kept).toMatch(/data-active="">(?:(?!<\/li>)[\s\S])*lang="ar"/);

    // No line in the page locale: the first line is active.
    const tr = html({ locale: 'tr' });
    expect(tr).toMatch(/data-active="">(?:(?!<\/li>)[\s\S])*lang="en"/);
  });

  it('helpers: lang validation, dir resolution, active index, four lines at most', () => {
    expect(manifestoLang('en')).toBe('en');
    expect(manifestoLang(' ckb ')).toBe('ckb');
    expect(manifestoLang('sv-SE')).toBe('sv-SE');
    for (const bad of ['EN', 'e', 'en_US', 'en"><script>', '', 12, null]) expect(manifestoLang(bad)).toBeUndefined();

    expect(manifestoDir('auto', 'ar', 'x')).toBe('rtl');
    expect(manifestoDir('auto', 'ckb', 'x')).toBe('rtl');
    expect(manifestoDir(undefined, 'he-IL', 'x')).toBe('rtl');
    expect(manifestoDir('auto', 'ku', 'x')).toBe('ltr');
    expect(manifestoDir('ltr', 'ar', 'x')).toBe('ltr');
    expect(manifestoDir('rtl', 'en', 'x')).toBe('rtl');
    expect(manifestoDir('auto', undefined, 'جملة')).toBe('rtl');
    expect(manifestoDir('junk', undefined, 'abc')).toBe('ltr');

    const six = manifestoLines([...LINES, { text: 'five' }, { text: 'six' }]);
    expect(six).toHaveLength(4);
    expect(manifestoLines([{ text: '  ' }, null, 'x', { text: 'ok', lang: 'BAD!' }])).toEqual([
      { text: 'ok', label: '', lang: undefined, dir: 'ltr', arabic: false },
    ]);
    expect(manifestoActiveIndex(six, 'ar')).toBe(2);
    expect(manifestoActiveIndex(six, 'sv-SE')).toBe(3);
    expect(manifestoActiveIndex(six, 'de')).toBe(0);
  });

  it('an invalid lang is omitted from the markup; colours are validated', () => {
    const out = html({
      settings: {
        lines: [{ text: 'Plain', lang: 'x"y', dir: 'auto' }],
        bg_color: '#111111',
        text_color: 'red;position:fixed',
        accent_color: 'rgb(182, 0, 24)',
      },
    });
    expect(out).toMatch(/<p class="cx-sm-text" dir="ltr"/);
    expect(out).toContain('data-nolabel=""');
    expect(out).toContain('--cx-sm-bg:#111111');
    expect(out).toContain('--cx-sm-ac:rgb(182, 0, 24)');
    expect(out).not.toContain('position:fixed');
  });

  it('scroll motion: one row per beat (hairline, label, words), mark fade and drift, link rise and underline', () => {
    const out = html({
      motion: 'scroll',
      content: { cta_text: 'Read more' },
      settings: { ...entry.defaultSettings, lines: LINES, mark_image: '/mark.svg', cta_url: '/about' },
    });
    expect(out).toMatch(/class="cx-sm-mark" aria-hidden="true" data-cx-reveal="fade"/);
    expect(out).toMatch(/class="cx-sm-mark-in" data-cx-behavior="scrub" data-cx-drift="" data-cx-y="-4"/);
    expect(out).toMatch(/<img[^>]*alt=""/);
    // Inline artwork passes through untouched (no media origin in front).
    const inline = html({ settings: { lines: LINES, mark_image: 'data:image/svg+xml;base64,AAAA' } });
    expect(inline).toContain('src="data:image/svg+xml;base64,AAAA"');
    // Row 0 has no delay; row 2 starts at d = 4, its label at d = 5.
    expect(out).toMatch(/class="cx-sm-rule" aria-hidden="true" data-cx-reveal="line"><\/span>/);
    expect(out).toMatch(/class="cx-sm-rule" aria-hidden="true" data-cx-reveal="line" data-cx-d="4"/);
    expect(out).toMatch(/class="cx-sm-label"[^>]*data-cx-reveal="fade" data-cx-d="5"/);
    expect((out.match(/data-cx-reveal="words"/g) || []).length).toBe(4);
    expect(out).toContain('--cx-delay:0.4s');
    // Closing hairline after the last row.
    expect(out).toMatch(/class="cx-sm-rule" data-end="" aria-hidden="true" data-cx-reveal="line" data-cx-d="8"/);
    expect(out).toMatch(/class="cx-sm-link" href="\/about" data-cx-reveal="rise" data-cx-i="4" data-cx-hover="underline"/);
    expect(out).toContain('--cx-sm-bd:0.8s');
  });

  it('intro motion uses the intro recipes; the heading level is the owner choice', () => {
    const out = html({ motion: 'intro', settings: { lines: LINES, heading_level: 'h2' } });
    expect(out).toContain('data-cx-intro="rule"');
    expect(out).toContain('data-cx-intro="words"');
    expect(out).not.toContain('data-cx-reveal=');
    expect((out.match(/<h2 class="cx-sm-text"/g) || []).length).toBe(1);
    expect(html()).not.toContain('<h2');
  });

  it('empty: nothing on the store, the empty state in the builder', () => {
    expect(html({ settings: {} })).toBe('');
    expect(html({ settings: { lines: [{ text: ' ' }] }, content: { cta_text: 'x' } })).toBe('');
    expect(html({ settings: {}, builderPreview: true })).toContain('data-cx-empty="script-manifesto"');
  });

  it('own motion CSS sits behind the gate; the schema follows the spec', () => {
    for (const rule of SCRIPT_MANIFESTO_CSS.split('}').filter((r) => /scaleY\(0\)/.test(r) && !r.includes('from{'))) {
      expect(rule).toContain(G);
    }
    const s = entry.schema;
    expect(s.id).toBe('script-manifesto');
    expect(s.schema.map((f) => f.key)).toEqual([
      'lines', 'cta_text', 'mark_image', 'active_first', 'cta_url', 'bg_color', 'text_color', 'accent_color', 'heading_level',
    ]);
    expect(s.schema[0].maxItems).toBe(4);
    expect(s.schema[0].fields?.map((f) => f.key)).toEqual(['text', 'label', 'lang', 'dir']);
    expect(s.translatable).toEqual(['cta_text']);
    expect(s.pageTypes).toEqual(['HOME', 'STATIC', 'LANDING', 'FOOTER']);
    expect(entry.defaultSettings).toEqual({ active_first: true, heading_level: 'p' });
    expect(entry.defaultContent).toEqual({});
  });
});
