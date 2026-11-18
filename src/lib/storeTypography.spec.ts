import { describe, expect, it } from 'vitest';
import { buildTypographyCss, cssSafe, type StoreTypography } from './storeTypography';

// Stored typography settings and the exact CSS the store layout built for
// them BEFORE the helpers moved here (recorded by running the layout's own
// functions). Without an Arabic family the output must stay these strings.
const FULL: StoreTypography = {
  heading: { fontFamily: 'Playfair Display', color: '#111111', fontSize: 40 },
  body: { fontFamily: 'Inter', color: '#333333', fontSize: 16 },
  button: { fontFamily: 'Poppins' },
  link: { fontFamily: 'Lora', color: '#0055aa' },
  header: { fontFamily: 'Montserrat', fontSize: 4 },
};
const COLORS_ONLY: StoreTypography = {
  heading: { color: '#111111' },
  body: { fontSize: 500 },
  link: { color: 'red' },
  button: {},
  header: { fontSize: 0 },
};
const ESCAPE: StoreTypography = {
  heading: { fontFamily: "Evil\"</style><script>\\", color: 'red;}</STYLE>' },
};

const FULL_CSS =
  ".store-root main :is(h1, h2, h3, h4, h5, h6):where(:not([data-text-look=\"body\"])), .store-root main :where([data-text-look=\"heading\"]) { font-family: \"Playfair Display\", system-ui, sans-serif; color: #111111; font-size: 40px; }\n.store-root main :is(p, li, span):where(:not([data-text-look=\"heading\"])), .store-root main :where([data-text-look=\"body\"]) { font-family: \"Inter\", system-ui, sans-serif; color: #333333; font-size: 16px; }\n.store-root main button { font-family: \"Poppins\", system-ui, sans-serif; }\n.store-root main a { font-family: \"Lora\", system-ui, sans-serif; color: #0055aa; }\n.store-root header, .store-root header * { font-family: \"Montserrat\", system-ui, sans-serif; font-size: 8px; }\n.store-overlay p, .store-overlay li, .store-overlay span { font-family: \"Inter\", system-ui, sans-serif; color: #333333; font-size: 16px; }\n.store-overlay button { font-family: \"Poppins\", system-ui, sans-serif; }\n.store-overlay a { font-family: \"Lora\", system-ui, sans-serif; color: #0055aa; }";
const COLORS_ONLY_CSS =
  ".store-root main :is(h1, h2, h3, h4, h5, h6):where(:not([data-text-look=\"body\"])), .store-root main :where([data-text-look=\"heading\"]) { color: #111111; }\n.store-root main :is(p, li, span):where(:not([data-text-look=\"heading\"])), .store-root main :where([data-text-look=\"body\"]) { font-size: 160px; }\n.store-root main a { color: red; }\n.store-overlay p, .store-overlay li, .store-overlay span { font-size: 160px; }\n.store-overlay a { color: red; }";
const ESCAPE_CSS =
  ".store-root main :is(h1, h2, h3, h4, h5, h6):where(:not([data-text-look=\"body\"])), .store-root main :where([data-text-look=\"heading\"]) { font-family: \"Evil\\\"<\\/style><script>\\\\\", system-ui, sans-serif; color: red;}<\\/style>; }";

describe('buildTypographyCss without an Arabic family (unchanged)', () => {
  const NO_ARABIC = [undefined, null, {}, { heading: undefined, body: undefined }, { heading: '', body: '' }];

  it('builds the string the layout always built', () => {
    for (const arabic of NO_ARABIC) {
      expect(buildTypographyCss(FULL, arabic)).toBe(FULL_CSS);
      expect(buildTypographyCss(COLORS_ONLY, arabic)).toBe(COLORS_ONLY_CSS);
      expect(buildTypographyCss(ESCAPE, arabic)).toBe(ESCAPE_CSS);
      expect(buildTypographyCss({}, arabic)).toBe("");
    }
  });

  it('a store without typography settings gets no rule, with or without an Arabic family', () => {
    expect(buildTypographyCss({}, { heading: 'Cairo', body: 'Cairo' })).toBe('');
    // Rules without a font keep their exact text: the family only follows a font.
    expect(buildTypographyCss(COLORS_ONLY, { heading: 'Cairo', body: 'Cairo' })).toBe(COLORS_ONLY_CSS);
  });
});

describe('buildTypographyCss with an Arabic family', () => {
  const rules = (css: string) => css.split('\n');
  const fontOf = (rule: string) => /font-family: ([^;]+);/.exec(rule)?.[1];

  it('the heading rule takes the heading family, every other rule the body family', () => {
    const css = buildTypographyCss(FULL, { heading: 'Noto Kufi Arabic', body: 'Noto Naskh Arabic' });
    expect(rules(css).map(fontOf)).toEqual([
      '"Playfair Display", "Noto Kufi Arabic", system-ui, sans-serif',
      '"Inter", "Noto Naskh Arabic", system-ui, sans-serif',
      '"Poppins", "Noto Naskh Arabic", system-ui, sans-serif',
      '"Lora", "Noto Naskh Arabic", system-ui, sans-serif',
      '"Montserrat", "Noto Naskh Arabic", system-ui, sans-serif',
      '"Inter", "Noto Naskh Arabic", system-ui, sans-serif',
      '"Poppins", "Noto Naskh Arabic", system-ui, sans-serif',
      '"Lora", "Noto Naskh Arabic", system-ui, sans-serif',
    ]);
    // Nothing else moves: removing the family gives the recorded string.
    expect(css.replace(', "Noto Kufi Arabic"', '').replaceAll(', "Noto Naskh Arabic"', '')).toBe(FULL_CSS);
  });

  it('one slot only: the other rules keep their exact text', () => {
    const before = rules(FULL_CSS);
    const headingOnly = rules(buildTypographyCss(FULL, { heading: 'Cairo' }));
    expect(fontOf(headingOnly[0])).toBe('"Playfair Display", "Cairo", system-ui, sans-serif');
    expect(headingOnly.slice(1)).toEqual(before.slice(1));
    const bodyOnly = rules(buildTypographyCss(FULL, { body: 'Cairo' }));
    expect(bodyOnly[0]).toBe(before[0]);
    for (const rule of bodyOnly.slice(1)) expect(fontOf(rule)).toContain(', "Cairo", system-ui, sans-serif');
  });

  it('escapes the stored font name exactly as before, next to the Arabic family', () => {
    const css = buildTypographyCss(ESCAPE, { heading: 'Cairo' });
    expect(css).toBe(ESCAPE_CSS.replace(', system-ui', ', "Cairo", system-ui'));
    expect(css.toLowerCase()).not.toContain('</style');
  });
});

describe('cssSafe', () => {
  it('escapes backslashes and a closing style tag', () => {
    expect(cssSafe("a\\b")).toBe("a\\\\b");
    expect(cssSafe('x</style>y</STYLE>')).toBe("x<\\/style>y<\\/style>");
    expect(cssSafe('#112233')).toBe('#112233');
  });
});
