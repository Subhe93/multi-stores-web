import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { classTokens, hrefs, physicalClasses } from '../../minimal/sections/_shared/testHelpers';
import { G, G_RTL } from '../css/base.css';
import { PATTERN_BAND_CSS } from '../css/patternBand.css';
import { entry } from '../schemas/pattern-band.schema';
import { patternBandSection } from './PatternBand';

const PatternBand = patternBandSection.Component;

function html(props: Partial<SectionRenderProps> = {}) {
  const markup = renderToStaticMarkup(
    <PatternBand locale="en" primaryLocale="en" storeSlug="demo" settings={{}} content={{}} {...props} />,
  );
  // Without the hoisted <style> blocks and the flag script.
  return markup.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
}

const TILE = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
const DEFAULTS = entry.defaultSettings;
const count = (markup: string, re: RegExp) => (markup.match(re) || []).length;
const MOTION_ATTR = /data-cx-(reveal|intro|behavior|hover|magnetic|item|state|i|d)\b/;

describe('pattern-band', () => {
  it('without the motion prop: the band at rest, no reveal or behaviour attribute, no island', () => {
    const out = html({ settings: { ...DEFAULTS, tile_image: TILE, rails: true, label_url: '/our-impact' }, content: { label: 'Woven tag' } });
    expect(out).toMatch(/^<div data-cx-section="pattern-band" class="cx-bleed cx-pb"/);
    expect(out).not.toMatch(MOTION_ATTR);
    expect(out).toContain('Woven tag');
    expect(out).toContain(`--cx-pb-img:url(&quot;${TILE}&quot;)`);
    expect(out).toMatch(/data-cx-size="md" data-cx-rows="1" data-cx-width="full" data-cx-space="md"/);
    // The cloth is decorative; one row by default.
    expect(out).toMatch(/<div class="cx-pb-band" aria-hidden="true"><span class="cx-pb-row"><\/span><\/div>/);
  });

  it('motion "scroll": fade on the band, line on the rails, late rise on the tag, underline on the link', () => {
    const out = html({
      motion: 'scroll',
      settings: { ...DEFAULTS, tile_image: TILE, rails: true, label_url: '/our-impact' },
      content: { label: 'Woven tag' },
    });
    expect(out).toMatch(/class="cx-pb-band" aria-hidden="true" data-cx-reveal="fade"/);
    expect(count(out, /class="cx-pb-rail"[^>]*data-cx-reveal="line"/g)).toBe(2);
    expect(out).toMatch(/<p class="cx-pb-tag" data-cx-reveal="rise" data-cx-d="8">/);
    expect(out).toMatch(/<a class="cx-pb-label" href="\/our-impact" data-cx-hover="underline">Woven tag<\/a>/);
    expect(out).not.toMatch(/data-cx-behavior|data-cx-intro/);
  });

  it('motion "intro": the CSS-only kinds of the same recipes', () => {
    const out = html({ motion: 'intro', settings: { ...DEFAULTS, tile_image: TILE, rails: true }, content: { label: 'Tag' } });
    expect(out).toMatch(/class="cx-pb-band" aria-hidden="true" data-cx-intro="fade"/);
    expect(count(out, /data-cx-intro="rule"/g)).toBe(2);
    expect(out).toMatch(/<p class="cx-pb-tag" data-cx-intro="rise" data-cx-d="8">/);
    expect(out).not.toContain('data-cx-reveal');
  });

  it('no accepted tile: nothing on the store, the empty state in the builder', () => {
    for (const tile_image of [undefined, '', '  ', 'http://cdn.example/t.png', 'javascript:alert(1)', '/a.svg");x:url("y']) {
      expect(html({ settings: { ...DEFAULTS, tile_image }, content: { label: 'Tag' } })).toBe('');
      expect(html({ settings: { ...DEFAULTS, tile_image }, builderPreview: false })).toBe('');
    }
    const builder = html({ settings: { ...DEFAULTS }, builderPreview: true });
    expect(builder).toContain('data-cx-empty="pattern-band"');
    expect(builder).toContain('creative.empty.patternBand');
  });

  it('the tile URL is sanitized, encoded and resolved before it reaches the style attribute', () => {
    const uploaded = html({ settings: { ...DEFAULTS, tile_image: '/uploads/my tile.svg' } });
    expect(uploaded).toMatch(/--cx-pb-img:url\(&quot;https?:\/\/[^/&]+\/uploads\/my%20tile\.svg&quot;\)/);
    const remote = html({ settings: { ...DEFAULTS, tile_image: 'https://cdn.example.com/t.webp' } });
    expect(remote).toContain('--cx-pb-img:url(&quot;https://cdn.example.com/t.webp&quot;)');
    // No <img>: the tile is a CSS background only.
    expect(remote).not.toMatch(/<img\b/);
  });

  it('sizes, spacing and width are known values only', () => {
    const lg = html({ settings: { tile_image: TILE, size: 'lg', space: 'none', width: 'contained' } });
    expect(lg).toMatch(/data-cx-size="lg" data-cx-rows="1" data-cx-width="contained" data-cx-space="none"/);
    const sm = html({ settings: { tile_image: TILE, size: 'sm', space: 'sm' } });
    expect(sm).toMatch(/data-cx-size="sm" data-cx-rows="1" data-cx-width="full" data-cx-space="sm"/);
    const junk = html({ settings: { tile_image: TILE, size: 'xl', space: '"><b>', width: 7, rows: '9' } });
    expect(junk).toMatch(/data-cx-size="md" data-cx-rows="1" data-cx-width="full" data-cx-space="md"/);
    // Desktop 24 / 48 / 96 px, phone 20 / 36 / 64 px; space 0 / 24 / 48 / 96 px, phone half.
    expect(PATTERN_BAND_CSS).toContain('.cx-pb{--cx-pb-h:48px;--cx-pb-space:48px;');
    expect(PATTERN_BAND_CSS).toContain('.cx-pb[data-cx-size="sm"]{--cx-pb-h:24px}');
    expect(PATTERN_BAND_CSS).toContain('.cx-pb[data-cx-size="lg"]{--cx-pb-h:96px}');
    expect(PATTERN_BAND_CSS).toContain(
      '@media (max-width:767px){.cx-pb{--cx-pb-h:36px;--cx-pb-space:24px}.cx-pb[data-cx-size="sm"]{--cx-pb-h:20px}.cx-pb[data-cx-size="lg"]{--cx-pb-h:64px}.cx-pb[data-cx-space="sm"]{--cx-pb-space:12px}.cx-pb[data-cx-space="lg"]{--cx-pb-space:48px}',
    );
    expect(PATTERN_BAND_CSS).toContain('background-repeat:repeat-x;background-size:auto 100%');
  });

  it('two rows: two stacked elements, the second offset by half a tile (brick weave)', () => {
    const out = html({ settings: { ...DEFAULTS, tile_image: TILE, rows: '2' } });
    expect(out).toContain('data-cx-rows="2"');
    expect(count(out, /<span class="cx-pb-row"><\/span>/g)).toBe(2);
    expect(PATTERN_BAND_CSS).toContain('.cx-pb-row+.cx-pb-row{background-position:calc(var(--cx-pb-h) / -2) 0}');
    // The image travels once, on the root, not once per row.
    expect(count(out, /--cx-pb-img/g)).toBe(1);
  });

  it('tag: real text, plain without a link, colours as variables, long labels flagged for phones', () => {
    const plain = html({
      settings: { ...DEFAULTS, tile_image: TILE, bg_color: '#111111', tag_color: '#F7F4EF', text_color: '#B60018' },
      content: { label: 'Culture. Education.' },
    });
    expect(plain).toMatch(/<p class="cx-pb-tag"><span class="cx-pb-label">Culture\. Education\.<\/span><\/p>/);
    expect(plain).not.toMatch(/<a\b/);
    expect(plain).toContain('data-cx-tag="short"');
    expect(plain).toContain('--cx-pb-bg:#111111');
    expect(plain).toContain('--cx-pb-tag:#F7F4EF');
    expect(plain).toContain('--cx-pb-ink:#B60018');

    const none = html({ settings: { ...DEFAULTS, tile_image: TILE, label_url: '/x' } });
    expect(none).not.toMatch(/cx-pb-tag|data-cx-tag|<a\b|--cx-pb-(bg|tag|ink)/);

    const long = html({ settings: { ...DEFAULTS, tile_image: TILE }, content: { label: 'x'.repeat(80) } });
    expect(long).toContain('data-cx-tag="long"');
    expect(long).toContain(`>${'x'.repeat(60)}<`);
    expect(long).not.toContain('x'.repeat(61));

    // Owner text is a text node, never markup.
    const unsafe = html({ settings: { ...DEFAULTS, tile_image: TILE }, content: { label: '<img src=x onerror=1>' } });
    expect(unsafe).not.toMatch(/<img\b/);
  });

  it('Arabic and RTL: same artwork, never mirrored, logical classes only, links keep their locale', () => {
    const settings = { ...DEFAULTS, tile_image: TILE, rows: '2', rails: true, label_url: '/our-impact' };
    const ar = html({ settings, content: { label: 'ثقافة. تعليم. مستقبل أفضل.' }, locale: 'ar', primaryLocale: 'en', motion: 'scroll' });
    expect(ar).toContain('ثقافة. تعليم. مستقبل أفضل.');
    expect(ar).toContain('data-cx-script="arabic"');
    expect(hrefs(ar)).toEqual(['/ar/our-impact']);
    expect(physicalClasses(ar)).toEqual([]);
    expect(classTokens(ar).filter((c) => !c.startsWith('cx-'))).toEqual([]);
    expect(ar).not.toMatch(/scaleX\(-1\)|scale-x|transform/);
    expect(ar).toContain(`--cx-pb-img:url(&quot;${TILE}&quot;)`);
    // RTL only moves the anchor and the side the cloth arrives from.
    expect(PATTERN_BAND_CSS).toContain('.store-root[dir="rtl"] .cx-pb-row{background-position:100% 0}');
    expect(PATTERN_BAND_CSS).not.toMatch(/scale\w*\(-1|scale:-1/);
    expect(PATTERN_BAND_CSS).toContain(':is(:lang(ar),[data-cx-script="arabic"]){font-size:13px;letter-spacing:0;margin-inline-end:0;text-transform:none}');
  });

  it('the hidden start state exists only behind the gate and the band state; one continuous soft wipe, never stepped, never looping', () => {
    // Hidden = the mask parked at its closed position (LTR 100% 0, RTL 0 0 with the mirrored gradient).
    const hidden = PATTERN_BAND_CSS.split('}').filter((rule) => /mask:linear-gradient\((90deg[^;]*\) 100% 0|270deg[^;]*\) 0 0)\//.test(rule));
    expect(hidden).toHaveLength(2);
    expect(hidden[0]).toContain(`${G} .cx-pb-band[data-cx-reveal][data-cx-state="pending"]{opacity:1;`);
    expect(hidden[1]).toContain(`${G_RTL} .cx-pb-band[data-cx-reveal][data-cx-state="pending"]{`);
    // Every rule that carries a mask or moves sits behind the gate.
    for (const rule of PATTERN_BAND_CSS.split('}').filter((r) => /mask:linear-gradient|animation:cx-pb/.test(r))) {
      expect(rule).toContain(G.slice(0, 20));
    }
    expect(PATTERN_BAND_CSS).toContain('transition:-webkit-mask-position 1.6s var(--cx-ease-io,cubic-bezier(.65,0,.35,1)),mask-position 1.6s var(--cx-ease-io,cubic-bezier(.65,0,.35,1))');
    expect(PATTERN_BAND_CSS).not.toMatch(/steps\(|clip-path:inset/);
    expect(PATTERN_BAND_CSS).not.toMatch(/infinite|translateX|marquee/);
  });

  it('schema: keys, order, types and defaults of the spec', () => {
    const s = entry.schema;
    expect(s.id).toBe('pattern-band');
    expect(s.icon).toBe('grip-horizontal');
    expect(s.category).toBe('content');
    expect(s.pageTypes).toEqual(['HOME', 'STATIC', 'LANDING', 'FOOTER']);
    expect(s.translatable).toEqual(['label']);
    expect(s.schema.map((f) => [f.key, f.type, f.defaultValue])).toEqual([
      ['label', 'text', undefined],
      ['tile_image', 'image', undefined],
      ['size', 'select', 'md'],
      ['rows', 'select', '1'],
      ['width', 'select', 'full'],
      ['space', 'select', 'md'],
      ['rails', 'boolean', false],
      ['label_url', 'url', undefined],
      ['bg_color', 'color', undefined],
      ['tag_color', 'color', undefined],
      ['text_color', 'color', undefined],
    ]);
    expect(s.schema[0].maxLength).toBe(60);
    const options = (key: string) => s.schema.find((f) => f.key === key)?.options?.map((o) => o.value);
    expect(options('size')).toEqual(['sm', 'md', 'lg']);
    expect(options('rows')).toEqual(['1', '2']);
    expect(options('width')).toEqual(['full', 'contained']);
    expect(options('space')).toEqual(['none', 'sm', 'md', 'lg']);
    expect(entry.defaultSettings).toEqual({ size: 'md', rows: '1', width: 'full', space: 'md', rails: false });
    expect(patternBandSection.needsBuilderPreview).toBe(true);
    expect(patternBandSection.schema).toBe(s);
    for (const f of s.schema) {
      expect(f.label.en && f.label.ar, f.key).toBeTruthy();
      for (const o of f.options || []) expect(o.label.en && o.label.ar, `${f.key}.${o.value}`).toBeTruthy();
    }
  });
});
