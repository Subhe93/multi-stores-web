// Defers the first-layer consent banner until the visitor's first real
// interaction with the page (tap, click, wheel, key press).
//
// Why: a banner that paints during page load becomes the Largest Contentful
// Paint element and a late visual change (Speed Index). The browser stops
// recording LCP at the first input, so a banner shown on that input is never
// an LCP candidate, neither in lab tests nor in real-user data.
//
// Deliberately NO fallback timer: a timer-shown banner for a visitor who has
// not interacted yet would become a late LCP entry in the field data.
// `scroll` is not a trigger either: sliders scroll themselves (autoplay) and
// the browser can restore a scroll position on load. Touch, wheel and keys
// cover every user-initiated scroll.
//
// Tracking stays blocked until consent either way; this only moves WHEN the
// question is asked. The gate is document-wide: once open it stays open
// (client navigations, remounts).

const EVENTS = ['pointerdown', 'touchstart', 'wheel', 'keydown'] as const;
const OPTS: AddEventListenerOptions = { capture: true, passive: true };

let open = false;
let armed = false;
const listeners = new Set<() => void>();

function disarm() {
  if (!armed) return;
  armed = false;
  for (const e of EVENTS) window.removeEventListener(e, openBannerGate, OPTS);
}

function arm() {
  if (armed || open || typeof window === 'undefined') return;
  armed = true;
  for (const e of EVENTS) window.addEventListener(e, openBannerGate, OPTS);
}

/** Opens the gate (first interaction, or an explicit consent-settings open). */
export function openBannerGate(): void {
  if (open) return;
  open = true;
  disarm();
  for (const l of [...listeners]) l();
}

/** useSyncExternalStore subscribe: arms the interaction listeners lazily. */
export function subscribeBannerGate(cb: () => void): () => void {
  listeners.add(cb);
  arm();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) disarm();
  };
}

export function bannerGateOpen(): boolean {
  return open;
}

/** Test-only: back to the initial closed state. */
export function resetBannerGate(): void {
  disarm();
  open = false;
}

// Arm as soon as this module loads in the browser (before hydration), so a
// tap made while a slow phone is still hydrating already counts.
arm();
