import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountCursor } from './cursor';

let frames: Array<(time: number) => void> = [];
let clock = 0;
/** Runs the queued frame(s) `ms` later. */
const frame = (ms = 16) => {
  clock += ms;
  const run = frames;
  frames = [];
  for (const cb of run) cb(clock);
};

const holder = () => document.querySelector('[data-cx-cursor-dot]') as HTMLElement | null;
const dot = () => holder()?.firstElementChild as HTMLElement;

function pointer(type: string, target: EventTarget, x = 0, y = 0, init: Record<string, unknown> = {}) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  for (const [k, v] of Object.entries(init)) Object.defineProperty(event, k, { value: v });
  target.dispatchEvent(event);
}

let root: HTMLElement;
const el = (id: string) => root.querySelector(`#${id}`) as HTMLElement;

describe('mountCursor', () => {
  beforeEach(() => {
    frames = [];
    clock = 1000;
    vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames = [];
    });
    document.body.innerHTML = `
      <div class="store-root" style="--theme-colors-text: #111111">
        <p id="text">Text</p>
        <a id="link" href="/story"><span id="in-link">Story</span></a>
        <button id="button">Open</button>
        <input id="input" />
        <textarea id="area"></textarea>
        <select id="select"><option>One</option></select>
        <iframe id="frame"></iframe>
        <div contenteditable="true"><span id="editable">Edit</span></div>
      </div>`;
    root = document.querySelector('.store-root') as HTMLElement;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('mounts one hidden, decorative dot on <body> that never takes a pointer event', () => {
    const off = mountCursor(root);
    const node = holder() as HTMLElement;
    expect(node.parentElement).toBe(document.body);
    expect(node.getAttribute('aria-hidden')).toBe('true');
    expect(node.style.position).toBe('fixed');
    expect(node.style.pointerEvents).toBe('none');
    expect(dot().style.pointerEvents).toBe('none');
    expect(dot().style.opacity).toBe('0');
    expect(dot().style.width).toBe('28px');
    expect(dot().style.background).toContain('rgb(17, 17, 17)');
    expect(frames).toHaveLength(0);
    off();
  });

  it('appears in place on the first move (never flies in) as an 8 px dot', () => {
    const off = mountCursor(root);
    pointer('pointermove', el('text'), 300, 200);
    expect(holder()?.style.transform).toBe('translate3d(300.0px, 200.0px, 0)');
    expect(dot().style.opacity).toBe('0.9');
    // 8 px shown through a 28 px box.
    expect(dot().style.transform).toBe(`scale(${8 / 28})`);
    expect(frames).toHaveLength(0);
    off();
  });

  it('trails the pointer for a few frames, then stops asking for frames', () => {
    const off = mountCursor(root);
    pointer('pointermove', el('text'), 100, 100);
    pointer('pointermove', el('text'), 200, 100);
    expect(frames).toHaveLength(1);
    frame();
    const x = parseFloat((holder()?.style.transform || '').slice('translate3d('.length));
    expect(x).toBeGreaterThan(100);
    expect(x).toBeLessThan(200);
    for (let i = 0; i < 80 && frames.length; i += 1) frame();
    expect(frames).toHaveLength(0);
    expect(holder()?.style.transform).toBe('translate3d(200.0px, 100.0px, 0)');
    off();
  });

  it('opens to the full 28 px disc over links and buttons, also from a child', () => {
    const off = mountCursor(root);
    pointer('pointermove', el('text'), 10, 10);
    pointer('pointerover', el('in-link'), 12, 10);
    expect(dot().style.transform).toBe('scale(1)');
    expect(dot().style.opacity).toBe('0.14');
    pointer('pointerover', el('text'), 14, 10);
    expect(dot().style.transform).toBe(`scale(${8 / 28})`);
    pointer('pointerover', el('button'), 16, 10);
    expect(dot().style.transform).toBe('scale(1)');
    off();
  });

  it.each(['input', 'area', 'select', 'frame', 'editable'])('hides over form fields and frames (%s)', (id) => {
    const off = mountCursor(root);
    pointer('pointermove', el('text'), 10, 10);
    expect(dot().style.opacity).toBe('0.9');
    pointer('pointerover', el(id), 20, 10);
    expect(dot().style.opacity).toBe('0');
    // Back on the page: it reappears where the pointer is.
    pointer('pointermove', el('text'), 400, 300);
    expect(dot().style.opacity).toBe('0.9');
    expect(holder()?.style.transform).toBe('translate3d(400.0px, 300.0px, 0)');
    off();
  });

  it('hides when the pointer leaves the window and when the window loses focus', () => {
    const off = mountCursor(root);
    pointer('pointermove', el('text'), 10, 10);
    pointer('pointerout', el('text'), 0, 10, { relatedTarget: null });
    expect(dot().style.opacity).toBe('0');
    pointer('pointermove', el('text'), 10, 10);
    // Moving from one element to another is not leaving.
    pointer('pointerout', el('text'), 10, 10, { relatedTarget: el('link') });
    expect(dot().style.opacity).toBe('0.9');
    window.dispatchEvent(new Event('blur'));
    expect(dot().style.opacity).toBe('0');
    off();
  });

  it('ignores touch and pen pointers', () => {
    const off = mountCursor(root);
    pointer('pointermove', el('text'), 10, 10, { pointerType: 'touch' });
    pointer('pointermove', el('text'), 10, 10, { pointerType: 'pen' });
    expect(dot().style.opacity).toBe('0');
    expect(frames).toHaveLength(0);
    pointer('pointermove', el('text'), 10, 10, { pointerType: 'mouse' });
    expect(dot().style.opacity).toBe('0.9');
    // A touch after the mouse puts it away again.
    pointer('pointermove', el('text'), 50, 50, { pointerType: 'touch' });
    expect(dot().style.opacity).toBe('0');
    off();
  });

  it('never moves focus', () => {
    const off = mountCursor(root);
    el('button').focus();
    pointer('pointermove', el('link'), 10, 10);
    pointer('pointerover', el('input'), 10, 10);
    expect(document.activeElement).toBe(el('button'));
    off();
  });

  it('cleanup removes the node, every listener and the running frame', () => {
    const docAdded = vi.spyOn(document, 'addEventListener');
    const docRemoved = vi.spyOn(document, 'removeEventListener');
    const winRemoved = vi.spyOn(window, 'removeEventListener');
    const off = mountCursor(root);
    pointer('pointermove', el('text'), 10, 10);
    pointer('pointermove', el('text'), 90, 10);
    expect(frames).toHaveLength(1);
    off();
    expect(holder()).toBeNull();
    expect(frames).toHaveLength(0);
    for (const type of ['pointermove', 'pointerover', 'pointerout']) {
      const handler = docAdded.mock.calls.find((c) => c[0] === type)?.[1];
      expect(handler).toBeTypeOf('function');
      expect(docRemoved).toHaveBeenCalledWith(type, handler);
    }
    expect(winRemoved).toHaveBeenCalledWith('blur', expect.any(Function));
    pointer('pointermove', el('text'), 200, 10);
    expect(frames).toHaveLength(0);
    docAdded.mockRestore();
    docRemoved.mockRestore();
    winRemoved.mockRestore();
  });
});
