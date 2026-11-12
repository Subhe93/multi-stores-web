import { describe, expect, it } from 'vitest';
import { CUSTOM_CSS_MAX_LENGTH, sanitizeCustomCss } from './customCss';

describe('sanitizeCustomCss', () => {
  it('returns an empty string for non-strings', () => {
    for (const value of [undefined, null, 42, true, {}, ['a{}'], () => 'a{}']) {
      expect(sanitizeCustomCss(value)).toBe('');
    }
  });

  it('leaves ordinary CSS intact', () => {
    const css = [
      '.store-root > main a:hover { color: #f00; }',
      'ul > li + li ~ li { margin: 0 auto; }',
      '@media (min-width: 768px) { .hero h1 { font-size: 3rem !important; } }',
      '.card { background: url("https://example.com/a.png") no-repeat; }',
      'html { scroll-behavior: smooth; overscroll-behavior: contain; }',
      '.x::after { content: "a > b"; width: calc(100% - 2px); }',
      '@font-face { font-family: "X"; src: url(/fonts/x.woff2); }',
    ].join('\n');
    expect(sanitizeCustomCss(css)).toBe(css);
  });

  it('caps the length', () => {
    const long = 'a'.repeat(CUSTOM_CSS_MAX_LENGTH + 500);
    expect(sanitizeCustomCss(long)).toHaveLength(CUSTOM_CSS_MAX_LENGTH);
    expect(CUSTOM_CSS_MAX_LENGTH).toBe(20000);
  });

  it('drops everything beyond the cap, even a payload', () => {
    const css = `${'a'.repeat(CUSTOM_CSS_MAX_LENGTH)}</style><script>alert(1)</script>`;
    expect(sanitizeCustomCss(css)).toBe('a'.repeat(CUSTOM_CSS_MAX_LENGTH));
  });

  it('cannot close the style element or open markup', () => {
    const out = sanitizeCustomCss(
      'a{color:red}</style><script>alert(1)</script><STYLE>b{}</StYlE ><!-- x --><?php ?><img src=x onerror=alert(1)>',
    );
    expect(out).not.toMatch(/<[a-zA-Z/!?]/);
    expect(out.toLowerCase()).not.toContain('</style');
    expect(out).not.toContain('<!--');
    expect(out).toContain('a{color:red}');
  });

  it('keeps a "<" inside a string readable through a CSS escape', () => {
    expect(sanitizeCustomCss('.a::before { content: "<b>"; }')).toBe(String.raw`.a::before { content: "\3c b>"; }`);
    // A lone "<" that cannot start markup is left alone.
    expect(sanitizeCustomCss('@media (width < 600px) { a { color: red } }')).toBe(
      '@media (width < 600px) { a { color: red } }',
    );
  });

  it('strips NUL and control characters but keeps tabs and newlines', () => {
    expect(sanitizeCustomCss('a\u0000{\u0008color\u001F:\u007Fred}\n\tb{}\r\n')).toBe('a{color:red}\n\tb{}');
  });

  it('removes @import rules', () => {
    expect(sanitizeCustomCss('@import url("https://evil.test/x.css");\na{color:red}')).toBe('a{color:red}');
    expect(sanitizeCustomCss('@IMPORT "x.css" screen;a{}')).toBe('a{}');
    expect(sanitizeCustomCss('@im@import "a";port "b";a{}')).toBe('a{}');
  });

  it('removes script-capable tokens, case-insensitively', () => {
    const out = sanitizeCustomCss(
      'a{width:EXPRESSION (alert(1));background:url(JavaScript:alert(1));behavior:url(x.htc);-MOZ-binding:url(x)}',
    ).toLowerCase();
    expect(out).not.toMatch(/expression\s*\(/);
    expect(out).not.toMatch(/javascript\s*:/);
    expect(out).not.toMatch(/(^|[^\w-])behavior\s*:/);
    expect(out).not.toContain('-moz-binding');
  });

  it('does not let a removal assemble a new token', () => {
    const out = sanitizeCustomCss('a{b:exprexpression(ession(1);c:javajavascript:script:x;d:-moz--moz-bindingbinding}').toLowerCase();
    expect(out).not.toContain('expression(');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('-moz-binding');
  });

  it('trims surrounding whitespace so a blank field renders nothing', () => {
    expect(sanitizeCustomCss('  \n\t ')).toBe('');
  });
});
