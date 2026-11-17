// Helpers shared by the section tests (not imported by any component).

/** Every class token of every `class="…"` attribute in the markup. */
export function classTokens(html: string): string[] {
  return [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/).filter(Boolean));
}

// Physical (left / right) Tailwind utilities, with any variant prefix. The
// storefront must mirror in right-to-left languages, so new markup uses the
// logical ones (ms- me- ps- pe- start- end- text-start border-s).
const PHYSICAL = /^(?:[a-z0-9-]+:)*-?(?:text-left|text-right|m[lr]-|p[lr]-|left-|right-|border-[lr](?:-|$)|rounded-[lr](?:-|$)|float-(?:left|right))/;

/** The physical-direction class tokens found in the markup (expected: none). */
export function physicalClasses(html: string): string[] {
  return classTokens(html).filter((c) => PHYSICAL.test(c));
}

/** `href` of every anchor, in document order. */
export function hrefs(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*?href="([^"]*)"/g)].map((m) => m[1]);
}

/** `alt` of every image, in document order. */
export function imgAlts(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*?alt="([^"]*)"/g)].map((m) => m[1]);
}

/** The full `<img …>` tags, in document order. */
export function imgTags(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
}
