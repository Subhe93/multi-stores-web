// Page curtain between brand pages (contract 4.11). Optional store switch,
// default off; mounted by runtime/store.ts on brand pages only.
//
// A client-only fixed panel appended to <body>. A capture-phase click
// listener recognises a plain same-origin link to another brand page and
// lets the panel cover the page IN PARALLEL with the navigation: the click
// is never delayed and never prevented, so links, prefetching and the
// router behave exactly as without the curtain. The panel lifts when the
// runtime reports the new route (`arrived()`), not before 450 ms, and in any
// case after 2.5 s. It never shows on first load or on back / forward
// (neither is a link click).

export interface CurtainOptions {
  push(href: string): void;
  prefetch(href: string): void;
  isBrandPath(pathname: string): boolean;
  label: string;
  logoUrl?: string;
}

export interface CurtainHandle {
  /** The destination route rendered: the panel may lift. */
  arrived(): void;
  destroy(): void;
}

const COVER_MS = 450;
const LIFT_MS = 700;
const MIN_COVERED_MS = 450;
const HARD_CAP_MS = 2500;
const EASE = 'cubic-bezier(.76,0,.24,1)';
/** Links inside these never start the curtain (dialogs, drawers, the mobile menu). */
const INSIDE_OVERLAY = '[role="dialog"], [aria-modal="true"], .store-overlay';

const BELOW = 'translateY(100%)';
const COVERING = 'translateY(0)';
const ABOVE = 'translateY(-100%)';

type Phase = 'idle' | 'covering' | 'lifting';

/** The destination of a click that should run the curtain, else null. */
function destinationOf(e: MouseEvent, isBrandPath: (pathname: string) => boolean): URL | null {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const node = e.target;
  if (!(node instanceof Element)) return null;
  const anchor = node.closest<HTMLAnchorElement>('a[href]');
  if (!anchor) return null;
  const target = anchor.getAttribute('target');
  if (target && target !== '_self') return null;
  if (anchor.hasAttribute('download') || anchor.closest('[data-no-transition]')) return null;
  // A link that acts as a button is handled by its own script.
  if (anchor.getAttribute('role') === 'button') return null;
  if (anchor.closest(INSIDE_OVERLAY)) return null;
  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  // Same document (a hash link or the current page): no navigation to cover.
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  if (!isBrandPath(url.pathname)) return null;
  return url;
}

export function mountCurtain(opts: CurtainOptions): CurtainHandle {
  if (typeof document === 'undefined') return { arrived() {}, destroy() {} };

  const root = document.querySelector<HTMLElement>('.store-root');
  const tokens = root ? window.getComputedStyle(root) : null;
  const background = tokens?.getPropertyValue('--theme-colors-background').trim() || '#ffffff';
  const foreground = tokens?.getPropertyValue('--theme-colors-text').trim() || '#111111';

  // The panel: decorative, out of the accessibility tree, no pointer events
  // unless it is covering.
  const panel = document.createElement('div');
  panel.setAttribute('data-cx-curtain', '');
  panel.setAttribute('aria-hidden', 'true');
  Object.assign(panel.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    background,
    color: foreground,
    transform: BELOW,
    visibility: 'hidden',
    pointerEvents: 'none',
    contain: 'strict',
  });
  if (opts.logoUrl) {
    const logo = document.createElement('img');
    logo.src = opts.logoUrl;
    logo.alt = '';
    logo.decoding = 'async';
    // Never mirrored, whatever the page direction.
    Object.assign(logo.style, { blockSize: 'clamp(40px, 6vh, 56px)', inlineSize: 'auto', maxInlineSize: '60vw' });
    panel.appendChild(logo);
  }
  const hairline = document.createElement('span');
  Object.assign(hairline.style, { display: 'block', inlineSize: '72px', blockSize: '1px', background: 'currentColor', opacity: '0.5' });
  panel.appendChild(hairline);

  // Screen readers get one polite line while the page is covered.
  const status = document.createElement('div');
  status.setAttribute('data-cx-curtain-status', '');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  Object.assign(status.style, {
    position: 'fixed',
    inlineSize: '1px',
    blockSize: '1px',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  });

  document.body.append(panel, status);

  let phase: Phase = 'idle';
  let coveredAt = 0;
  let animation: Animation | null = null;
  let liftTimer: ReturnType<typeof setTimeout> | undefined;
  let capTimer: ReturnType<typeof setTimeout> | undefined;
  let busyMain: HTMLElement | null = null;

  const run = (from: string, to: string, duration: number, done?: () => void) => {
    animation?.cancel();
    animation = null;
    panel.style.transform = to;
    if (typeof panel.animate !== 'function') {
      done?.();
      return;
    }
    const current = panel.animate([{ transform: from }, { transform: to }], { duration, easing: EASE });
    animation = current;
    current.onfinish = () => {
      if (animation !== current) return;
      animation = null;
      done?.();
    };
  };

  const reset = () => {
    clearTimeout(liftTimer);
    clearTimeout(capTimer);
    animation?.cancel();
    animation = null;
    phase = 'idle';
    panel.style.transform = BELOW;
    panel.style.visibility = 'hidden';
    panel.style.pointerEvents = 'none';
    status.textContent = '';
    busyMain?.removeAttribute('aria-busy');
    busyMain = null;
  };

  const lift = () => {
    if (phase !== 'covering') return;
    clearTimeout(liftTimer);
    clearTimeout(capTimer);
    phase = 'lifting';
    panel.style.pointerEvents = 'none';
    status.textContent = '';
    // The new page's <main> may be a different element.
    busyMain?.removeAttribute('aria-busy');
    busyMain = null;
    run(COVERING, ABOVE, LIFT_MS, reset);
  };

  const cover = () => {
    if (phase === 'covering') return;
    clearTimeout(liftTimer);
    clearTimeout(capTimer);
    phase = 'covering';
    coveredAt = performance.now();
    panel.style.visibility = 'visible';
    panel.style.pointerEvents = 'auto';
    status.textContent = opts.label;
    busyMain = document.querySelector<HTMLElement>('.store-root main') || document.querySelector<HTMLElement>('main');
    busyMain?.setAttribute('aria-busy', 'true');
    run(BELOW, COVERING, COVER_MS);
    capTimer = setTimeout(lift, HARD_CAP_MS);
  };

  const onClick = (e: MouseEvent) => {
    if (!destinationOf(e, opts.isBrandPath)) return;
    // No preventDefault: the navigation starts now, the panel covers meanwhile.
    cover();
  };

  // A page restored from the back/forward cache must not come back covered.
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) reset();
  };

  document.addEventListener('click', onClick, true);
  window.addEventListener('pageshow', onPageShow);

  return {
    arrived() {
      if (phase !== 'covering') return;
      const wait = Math.max(0, MIN_COVERED_MS - (performance.now() - coveredAt));
      clearTimeout(liftTimer);
      liftTimer = setTimeout(lift, wait);
    },
    destroy() {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('pageshow', onPageShow);
      reset();
      panel.remove();
      status.remove();
    },
  };
}
