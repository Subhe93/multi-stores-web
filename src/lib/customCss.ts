// Store-wide "Custom CSS" (theme_customizations.customCss): CSS the store
// owner pastes in the theme customizer, rendered into a <style> element on
// every page of their storefront.
//
// The owner is trusted to style their own store, but the string ends up in
// HTML, so it is made inert as markup before rendering. Deliberately simple:
// plain token matching, no CSS parsing. Tokens hidden behind CSS escapes or
// split by comments are NOT detected (they cannot close the <style> element
// either way, which is the property that matters).

/** Maximum stored / rendered length. The dashboard enforces the same cap. */
export const CUSTOM_CSS_MAX_LENGTH = 20000;

// C0 control characters (NUL included) except tab / LF / CR, plus DEL.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// `<` that could start markup: a tag, a closing tag (`</style`), a comment or
// declaration (`<!--`), a processing instruction.
const MARKUP_OPEN = /<(?=[a-zA-Z/!?])/g;

// Rules / tokens that load or run something: removed outright.
const REMOVALS: [RegExp, string][] = [
  // `@import ...;` up to the end of the rule.
  [/@import\b[^;]*;?/gi, ''],
  [/expression\s*\(/gi, ''],
  [/javascript\s*:/gi, ''],
  // The legacy `behavior:` property, but not `scroll-behavior:` and friends.
  [/(^|[^\w-])behavior\s*:/gi, '$1'],
  [/-moz-binding/gi, ''],
];

/**
 * Make owner CSS safe to place inside a `<style>` element.
 *
 * - non-strings give '';
 * - capped at CUSTOM_CSS_MAX_LENGTH characters (the rest is dropped);
 * - control characters are stripped;
 * - `@import` rules and `expression(` / `javascript:` / `behavior:` /
 *   `-moz-binding` tokens are removed (case-insensitive, repeated until
 *   nothing is left so a removal cannot assemble a new token);
 * - every `<` followed by a letter, `/`, `!` or `?` becomes the CSS escape
 *   `\3c `, so the text can neither close the style element nor open
 *   markup (`-->` is left alone: it means nothing inside <style>). Inside a
 *   CSS string the escape still
 *   renders as the original character (`content: "<b>"` keeps working).
 *
 * Ordinary CSS (selectors, `>` combinators, at-rules, urls) is untouched.
 */
export function sanitizeCustomCss(input: unknown): string {
  if (typeof input !== 'string') return '';
  let css = input.slice(0, CUSTOM_CSS_MAX_LENGTH).replace(CONTROL_CHARS, '');
  // Each pass only removes characters, so this always terminates.
  for (let previous = ''; previous !== css; ) {
    previous = css;
    for (const [pattern, replacement] of REMOVALS) css = css.replace(pattern, replacement);
  }
  return css.replace(MARKUP_OPEN, String.raw`\3c `).trim();
}
