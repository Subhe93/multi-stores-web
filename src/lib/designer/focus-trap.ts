// ── Focus trap of the designer dialog (M5 D30) ────────────────────────────
// Tab / Shift+Tab wrap inside the dialog. Everything a keyboard user can land
// on counts: form controls, links, the canvas, custom buttons (`role=button`)
// and anything made focusable with `tabindex="0"`.

export const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[role="button"]:not([disabled]):not([tabindex="-1"])',
  'canvas[tabindex="0"]',
  '[href]:not([tabindex="-1"])',
  '[tabindex="0"]',
].join(', ');

/** Focusable elements of `root` in DOM order (each once). */
export function focusableIn(root: ParentNode): HTMLElement[] {
  return [...new Set(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))];
}

/**
 * Keeps a Tab key press inside `root`: returns true when it wrapped (the
 * caller then prevents the default). Non-Tab keys are ignored.
 */
export function trapTabKey(root: ParentNode, e: { key: string; shiftKey: boolean }): boolean {
  if (e.key !== 'Tab') return false;
  const focusables = focusableIn(root);
  if (focusables.length === 0) return false;
  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !root.contains(active))) {
    last.focus();
    return true;
  }
  if (!e.shiftKey && (active === last || !root.contains(active))) {
    first.focus();
    return true;
  }
  return false;
}
