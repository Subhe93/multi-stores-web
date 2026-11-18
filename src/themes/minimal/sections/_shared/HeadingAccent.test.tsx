import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeadingAccent } from './HeadingAccent';
import { HEADING_ACCENT_FIELDS, headingAccentValue } from './headingAccentFields';
import { buildTypographyCss } from '@/lib/storeTypography';

const html = (props: Parameters<typeof HeadingAccent>[0]) => renderToStaticMarkup(<HeadingAccent {...props} />);

describe('headingAccentValue', () => {
  it("reads only 'line' and 'brush'; everything else is 'none'", () => {
    expect(headingAccentValue('line')).toBe('line');
    expect(headingAccentValue('brush')).toBe('brush');
    for (const raw of [undefined, null, '', 'none', 'Brush', 'wave', 1, true, {}, []]) {
      expect(headingAccentValue(raw)).toBe('none');
    }
  });
});

describe('HeadingAccent', () => {
  it('renders nothing for none, unset and unknown values', () => {
    for (const variant of [undefined, null, '', 'none', 'wave', 'LINE', 3, true, {}]) {
      expect(html({ variant })).toBe('');
      expect(html({ variant, color: '#ff0000', align: 'center' })).toBe('');
    }
  });

  it('line: one hidden decorative span in the theme accent colour', () => {
    expect(html({ variant: 'line' })).toBe(
      '<span aria-hidden="true" class="heading-accent" data-variant="line" data-align="start" style="color:var(--theme-colors-accent);font-size:inherit"></span>',
    );
  });

  it('brush: the span holds one inline svg path drawn in currentColor', () => {
    const out = html({ variant: 'brush' });
    expect(out).toMatch(
      /^<span aria-hidden="true" class="heading-accent" data-variant="brush" data-align="start" style="color:var\(--theme-colors-accent\);font-size:inherit"><svg viewBox="0 0 200 12" preserveAspectRatio="none" focusable="false"><path d="[^"]+" fill="currentColor"><\/path><\/svg><\/span>$/,
    );
    expect(out.match(/<path\b/g)).toHaveLength(1);
    expect(out.match(/<svg\b/g)).toHaveLength(1);
    // The whole accent, svg included, stays under 1 KB.
    expect(new TextEncoder().encode(out).length).toBeLessThan(1024);
  });

  it('is never exposed to assistive technology and carries no text', () => {
    for (const variant of ['line', 'brush']) {
      const out = html({ variant });
      expect(out).toContain('aria-hidden="true"');
      expect(out.replace(/<[^>]+>/g, '')).toBe('');
      expect(out).not.toMatch(/<title|aria-label|role=/);
    }
  });

  it('passes the alignment through; unset or unknown is the logical start', () => {
    for (const align of ['start', 'center', 'end', 'left', 'right'] as const) {
      expect(html({ variant: 'line', align })).toContain(`data-align="${align}"`);
    }
    expect(html({ variant: 'line' })).toContain('data-align="start"');
    expect(html({ variant: 'line', align: 'justify' as never })).toContain('data-align="start"');
  });

  it('the colour is always inline: the theme accent by default, the stored colour when set', () => {
    expect(html({ variant: 'brush', color: '#B60018' })).toContain('style="color:#B60018;font-size:inherit"');
    expect(html({ variant: 'line', color: '#B60018' })).toContain('style="color:#B60018;font-size:inherit"');
    for (const color of [undefined, null, '', 0, false]) {
      expect(html({ variant: 'line', color })).toContain('style="color:var(--theme-colors-accent);font-size:inherit"');
    }
  });
});

describe('HeadingAccent under the store typography rule', () => {
  it('keeps the heading font size: the body rule for `main span` sets a px size, the inline `inherit` beats it', () => {
    // The rule a store with a body font size gets. It matches every span in
    // <main> that is not marked as a heading, the accent included, and its
    // (0,1,2) specificity beats the .heading-accent class.
    const css = buildTypographyCss({ body: { fontSize: 16 } });
    expect(css).toContain('.store-root main :is(p, li, span):where(:not([data-text-look="heading"]))');
    expect(css).toContain('font-size: 16px;');
    // Only an inline style wins over it, so the accent's em sizes (3em line,
    // 4.5em brush, 0.22em height) keep following the heading it sits in.
    for (const variant of ['line', 'brush']) {
      const out = html({ variant });
      expect(out).toMatch(/^<span [^>]*style="[^"]*font-size:inherit[^"]*"/);
      expect(out).not.toContain('data-text-look');
    }
  });

  it('the computed size follows the heading, not the body rule', () => {
    const style = document.createElement('style');
    style.textContent = 'main span { font-size: 16px; } main h1 { font-size: 56px; }';
    document.head.appendChild(style);
    const main = document.createElement('main');
    main.innerHTML = `<h1>Title${html({ variant: 'brush' })}</h1><h1><span id="plain"></span></h1>`;
    document.body.appendChild(main);
    try {
      const accent = main.querySelector('.heading-accent') as HTMLElement;
      expect(accent.style.fontSize).toBe('inherit');
      expect(getComputedStyle(main.querySelector('#plain')!).fontSize).toBe('16px');
      expect(getComputedStyle(accent).fontSize).not.toBe('16px');
    } finally {
      main.remove();
      style.remove();
    }
  });
});

describe('HEADING_ACCENT_FIELDS', () => {
  it('declares the pair: a select defaulting to none and a colour shown only with an accent', () => {
    expect(HEADING_ACCENT_FIELDS.map((f) => f.key)).toEqual(['heading_accent', 'heading_accent_color']);
    const [accent, color] = HEADING_ACCENT_FIELDS;
    expect(accent.type).toBe('select');
    expect(accent.defaultValue).toBe('none');
    expect(accent.options?.map((o) => o.value)).toEqual(['none', 'line', 'brush']);
    expect(color.type).toBe('color');
    expect(color.defaultValue).toBeUndefined();
    expect(color.showIf).toEqual({ key: 'heading_accent', in: ['line', 'brush'] });
    for (const f of HEADING_ACCENT_FIELDS) {
      expect(f.min).toBeUndefined();
      expect(f.max).toBeUndefined();
      expect(f.maxItems).toBeUndefined();
    }
  });
});
