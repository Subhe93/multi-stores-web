/** Reading direction at a gallery element (the lightbox portal leaves its `dir` scope). */
export function readDirection(el: Element | null): 'ltr' | 'rtl' {
  if (!el) return 'ltr';
  const attr = el.closest('[dir]')?.getAttribute('dir');
  if (attr === 'rtl' || attr === 'ltr') return attr;
  try {
    return getComputedStyle(el).direction === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    return 'ltr';
  }
}
