// ── Body scroll lock for the designer dialog (M5 D15) ─────────────────────
// `overflow: hidden` alone does not stop iOS Safari from scrolling the page
// under a fixed dialog (rubber-banding and the address bar still move it).
// The body is fixed at its current scroll offset while the dialog is open and
// the offset is restored on unlock, so the page does not jump.

const LOCK_ATTR = 'data-designer-scroll-lock';

/** Locks the page scroll; the returned function unlocks it (idempotent). */
export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const body = document.body;
  // A second lock (nested dialog) leaves the first one in charge.
  if (body.hasAttribute(LOCK_ATTR)) return () => undefined;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const prev = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overscrollBehavior: body.style.overscrollBehavior,
  };
  body.setAttribute(LOCK_ATTR, '');
  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overscrollBehavior = 'contain';
  let unlocked = false;
  return () => {
    if (unlocked) return;
    unlocked = true;
    body.style.overflow = prev.overflow;
    body.style.position = prev.position;
    body.style.top = prev.top;
    body.style.left = prev.left;
    body.style.right = prev.right;
    body.style.width = prev.width;
    body.style.overscrollBehavior = prev.overscrollBehavior;
    body.removeAttribute(LOCK_ATTR);
    window.scrollTo(0, scrollY);
  };
}
