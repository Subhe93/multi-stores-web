// Cursor dot (store option `cursor: 'dot'`, default off). Mounted by
// runtime/store.ts on brand pages of a store that switched its motion style
// on, for a fine pointer only.
//
// An 8 px dot that trails the pointer by a few frames and opens to a soft
// 28 px disc over links and buttons. The system cursor stays visible, the
// dot never takes a pointer event, and it hides over form fields, embedded
// frames and when the pointer leaves the window. Frames run only while the
// dot is still catching up; nothing runs while the pointer rests.

/** The dot opens over these. */
const GROW_OVER = 'a[href], button, summary, [role="button"], [role="link"], [role="tab"], [data-cx-cursor="grow"]';
/** The dot hides over these: text entry, native controls and other documents. */
const HIDE_OVER =
  'input, textarea, select, option, iframe, embed, object, video, [contenteditable]:not([contenteditable="false"]), [data-cx-cursor="hide"]';

const SIZE = 28;
const DOT = 8;
/** Time constant of the trail in ms (about 63 % of the gap closes in this time). */
const TRAIL_MS = 70;

type Mode = 'hidden' | 'dot' | 'grow';

export function mountCursor(root: HTMLElement): () => void {
  if (typeof document === 'undefined') return () => {};

  const color = window.getComputedStyle(root).getPropertyValue('--theme-colors-text').trim() || '#111111';

  const holder = document.createElement('div');
  holder.setAttribute('data-cx-cursor-dot', '');
  holder.setAttribute('aria-hidden', 'true');
  Object.assign(holder.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '0',
    height: '0',
    zIndex: '2147482500',
    pointerEvents: 'none',
    willChange: 'transform',
  });
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    position: 'absolute',
    top: `${-SIZE / 2}px`,
    left: `${-SIZE / 2}px`,
    width: `${SIZE}px`,
    height: `${SIZE}px`,
    borderRadius: '50%',
    background: color,
    opacity: '0',
    transform: `scale(${DOT / SIZE})`,
    transition: 'transform .45s cubic-bezier(.16,1,.3,1), opacity .3s ease',
    pointerEvents: 'none',
  });
  holder.appendChild(dot);
  document.body.appendChild(holder);

  let mode: Mode = 'hidden';
  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;
  let frame = 0;
  let lastTime = 0;

  const setMode = (next: Mode) => {
    if (next === mode) return;
    mode = next;
    dot.style.opacity = next === 'hidden' ? '0' : next === 'grow' ? '0.14' : '0.9';
    dot.style.transform = `scale(${next === 'grow' ? 1 : DOT / SIZE})`;
  };

  const write = () => {
    holder.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  };

  const tick = (time: number) => {
    frame = 0;
    const dt = lastTime ? Math.min(64, time - lastTime) : 16;
    lastTime = time;
    const k = 1 - Math.exp(-dt / TRAIL_MS);
    x += (targetX - x) * k;
    y += (targetY - y) * k;
    if (Math.abs(targetX - x) < 0.1 && Math.abs(targetY - y) < 0.1) {
      x = targetX;
      y = targetY;
      write();
      lastTime = 0;
      return;
    }
    write();
    frame = requestAnimationFrame(tick);
  };

  const modeFor = (node: EventTarget | null): Mode => {
    if (!(node instanceof Element)) return 'dot';
    if (node.closest(HIDE_OVER)) return 'hidden';
    return node.closest(GROW_OVER) ? 'grow' : 'dot';
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType && e.pointerType !== 'mouse') {
      setMode('hidden');
      return;
    }
    targetX = e.clientX;
    targetY = e.clientY;
    if (mode === 'hidden') {
      // First sight, or back from hiding: appear in place, never fly in.
      x = targetX;
      y = targetY;
      write();
    }
    setMode(modeFor(e.target));
    if (!frame && (x !== targetX || y !== targetY)) frame = requestAnimationFrame(tick);
  };

  // The pointer left the window.
  const onOut = (e: PointerEvent) => {
    if (!e.relatedTarget) setMode('hidden');
  };
  const onHide = () => setMode('hidden');

  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerover', onMove, { passive: true });
  document.addEventListener('pointerout', onOut, { passive: true });
  window.addEventListener('blur', onHide);

  return () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerover', onMove);
    document.removeEventListener('pointerout', onOut);
    window.removeEventListener('blur', onHide);
    holder.remove();
  };
}
