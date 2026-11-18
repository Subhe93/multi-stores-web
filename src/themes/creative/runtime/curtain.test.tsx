import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isBrandPath } from '../constants';
import { mountCurtain, type CurtainHandle } from './curtain';

const panel = () => document.querySelector('[data-cx-curtain]') as HTMLElement | null;
const status = () => document.querySelector('[data-cx-curtain-status]') as HTMLElement | null;
const covering = () => panel()?.style.visibility === 'visible';

let handle: CurtainHandle | null = null;
let main: HTMLElement;
// jsdom does not navigate: stop the default action after the curtain saw the click.
const swallow = (e: Event) => e.preventDefault();

function mount(extra: Partial<Parameters<typeof mountCurtain>[0]> = {}) {
  const opts = { push: vi.fn(), prefetch: vi.fn(), isBrandPath, label: 'Loading page', ...extra };
  handle = mountCurtain(opts);
  return opts;
}

function link(href: string, attrs: Record<string, string> = {}, parent: Element = main) {
  const a = document.createElement('a');
  a.setAttribute('href', href);
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  a.innerHTML = '<span>Go</span>';
  parent.appendChild(a);
  return a;
}

function click(el: Element, init: MouseEventInit = {}) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  (el.querySelector('span') || el).dispatchEvent(event);
  return event;
}

describe('mountCurtain', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<div class="store-root" style="--theme-colors-background: #F7F4EF; --theme-colors-text: #111111"><main></main></div>';
    main = document.querySelector('main') as HTMLElement;
    document.addEventListener('click', swallow);
    window.history.replaceState(null, '', '/about?tab=1');
  });
  afterEach(() => {
    handle?.destroy();
    handle = null;
    document.removeEventListener('click', swallow);
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('mounts one hidden, inert panel in the theme colours (never on first load)', () => {
    mount({ logoUrl: '/uploads/logo.svg' });
    const el = panel() as HTMLElement;
    expect(el.parentElement).toBe(document.body);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.position).toBe('fixed');
    expect(el.style.visibility).toBe('hidden');
    expect(el.style.pointerEvents).toBe('none');
    expect(el.style.transform).toBe('translateY(100%)');
    expect(el.style.background).toContain('rgb(247, 244, 239)');
    const logo = el.querySelector('img') as HTMLImageElement;
    expect(logo.getAttribute('src')).toBe('/uploads/logo.svg');
    expect(logo.alt).toBe('');
    expect(status()?.textContent).toBe('');
    expect(main.hasAttribute('aria-busy')).toBe(false);
    // One flat panel: the optional logo and nothing else.
    expect(el.children).toHaveLength(1);
    handle?.destroy();
    mount();
    expect(panel()?.children).toHaveLength(0);
    expect(panel()?.querySelector('a, button, [tabindex]')).toBeNull();
  });

  it('covers on a plain link to another brand page without touching the click', () => {
    const opts = mount();
    const event = click(link('/our-story'));
    // The listener runs in the capture phase and never prevents the navigation.
    // The panel waits 120 ms before it moves.
    expect(covering()).toBe(false);
    expect(status()?.textContent).toBe('');
    vi.advanceTimersByTime(120);
    expect(covering()).toBe(true);
    expect(panel()?.style.pointerEvents).toBe('auto');
    expect(panel()?.style.transform).toBe('translateY(0)');
    expect(status()?.textContent).toBe('Loading page');
    expect(main.getAttribute('aria-busy')).toBe('true');
    expect(opts.push).not.toHaveBeenCalled();
    // Only the test's own bubble-phase listener prevented it.
    expect(event.defaultPrevented).toBe(true);
    document.removeEventListener('click', swallow);
    expect(click(link('/en/landing')).defaultPrevented).toBe(false);
  });

  it('a destination that is ready within 120 ms gets no curtain at all', () => {
    mount();
    click(link('/our-story'));
    vi.advanceTimersByTime(100);
    handle?.arrived();
    vi.advanceTimersByTime(3000);
    expect(covering()).toBe(false);
    expect(status()?.textContent).toBe('');
    expect(main.hasAttribute('aria-busy')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a destination that arrives while the panel has barely moved backs it out unseen', () => {
    mount();
    click(link('/our-story'));
    vi.advanceTimersByTime(120);
    expect(covering()).toBe(true);
    vi.advanceTimersByTime(50);
    handle?.arrived();
    expect(covering()).toBe(false);
    expect(panel()?.style.transform).toBe('translateY(100%)');
    expect(main.hasAttribute('aria-busy')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('lifts after arrived(), not before it has closed (0.5 s), and ends hidden and inert', () => {
    mount();
    click(link('/our-story'));
    vi.advanceTimersByTime(120);
    vi.advanceTimersByTime(150);
    handle?.arrived();
    vi.advanceTimersByTime(300);
    expect(covering()).toBe(true);
    expect(main.getAttribute('aria-busy')).toBe('true');
    vi.advanceTimersByTime(60);
    expect(covering()).toBe(false);
    expect(panel()?.style.pointerEvents).toBe('none');
    expect(panel()?.style.transform).toBe('translateY(100%)');
    expect(status()?.textContent).toBe('');
    expect(main.hasAttribute('aria-busy')).toBe(false);
  });

  it('a slow navigation lifts at the 2.5 s cap', () => {
    mount();
    click(link('/our-story'));
    vi.advanceTimersByTime(120 + 2400);
    expect(covering()).toBe(true);
    vi.advanceTimersByTime(150);
    expect(covering()).toBe(false);
    expect(main.hasAttribute('aria-busy')).toBe(false);
  });

  it('a second click while armed or covering starts nothing new', () => {
    mount();
    const a = link('/our-story');
    click(a);
    click(a);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(120);
    click(a);
    // Only the 2.5 s cap is pending.
    expect(vi.getTimerCount()).toBe(1);
    expect(covering()).toBe(true);
  });

  it('never takes or traps focus', () => {
    mount({ logoUrl: '/uploads/logo.svg' });
    const a = link('/our-story');
    a.focus();
    click(a);
    vi.advanceTimersByTime(300);
    expect(covering()).toBe(true);
    expect(document.activeElement).toBe(a);
    expect(panel()?.getAttribute('aria-hidden')).toBe('true');
    expect(panel()?.hasAttribute('tabindex')).toBe(false);
    expect(status()?.getAttribute('aria-live')).toBe('polite');
  });

  it('arrived() without a covered click does nothing (first load, back / forward)', () => {
    mount();
    handle?.arrived();
    vi.advanceTimersByTime(3000);
    expect(covering()).toBe(false);
    expect(status()?.textContent).toBe('');
  });

  it('ignores modified and non-primary clicks', () => {
    mount();
    const a = link('/our-story');
    click(a, { ctrlKey: true });
    click(a, { metaKey: true });
    click(a, { shiftKey: true });
    click(a, { altKey: true });
    click(a, { button: 1 });
    vi.advanceTimersByTime(200);
    expect(covering()).toBe(false);
  });

  it('ignores commerce destinations', () => {
    mount();
    for (const href of ['/products/tumbler', '/collections/home', '/cart', '/checkout', '/account', '/sv/products', '/legal/terms']) {
      click(link(href));
    }
    vi.advanceTimersByTime(200);
    expect(covering()).toBe(false);
  });

  it('ignores hash links and links to the current page', () => {
    mount();
    click(link('#story'));
    click(link('/about?tab=1#team'));
    click(link('/about?tab=1'));
    vi.advanceTimersByTime(200);
    expect(covering()).toBe(false);
    // Another query string on the same path is a navigation.
    click(link('/about?tab=2'));
    vi.advanceTimersByTime(120);
    expect(covering()).toBe(true);
  });

  it('ignores other origins, new tabs, downloads, opt-outs, button links and non-links', () => {
    mount();
    click(link('https://example.com/our-story'));
    click(link('/our-story', { target: '_blank' }));
    click(link('/our-story', { download: '' }));
    click(link('/our-story', { 'data-no-transition': '' }));
    click(link('/our-story', { role: 'button' }));
    click(link('mailto:hello@example.com'));
    const button = document.createElement('button');
    main.appendChild(button);
    click(button);
    vi.advanceTimersByTime(200);
    expect(covering()).toBe(false);
  });

  it('ignores links inside dialogs, drawers and the mobile menu', () => {
    mount();
    for (const html of ['<div role="dialog"></div>', '<div aria-modal="true"></div>', '<div class="store-overlay"></div>']) {
      const holder = document.createElement('div');
      holder.innerHTML = html;
      main.appendChild(holder);
      click(link('/our-story', {}, holder.firstElementChild as Element));
    }
    vi.advanceTimersByTime(200);
    expect(covering()).toBe(false);
  });

  it('a page restored from the back/forward cache comes back uncovered', () => {
    mount();
    click(link('/our-story'));
    vi.advanceTimersByTime(120);
    expect(covering()).toBe(true);
    const event = new Event('pageshow');
    Object.defineProperty(event, 'persisted', { value: true });
    window.dispatchEvent(event);
    expect(covering()).toBe(false);
    expect(main.hasAttribute('aria-busy')).toBe(false);
    // The cap timer of the old cover is gone.
    vi.advanceTimersByTime(3000);
    expect(covering()).toBe(false);
  });

  it('destroy removes the nodes, the listeners, the timers and aria-busy', () => {
    const docRemoved = vi.spyOn(document, 'removeEventListener');
    const winRemoved = vi.spyOn(window, 'removeEventListener');
    mount();
    click(link('/our-story'));
    vi.advanceTimersByTime(120);
    handle?.destroy();
    handle = null;
    expect(panel()).toBeNull();
    expect(status()).toBeNull();
    expect(main.hasAttribute('aria-busy')).toBe(false);
    expect(docRemoved).toHaveBeenCalledWith('click', expect.any(Function), true);
    expect(winRemoved).toHaveBeenCalledWith('pageshow', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
    click(link('/our-story'));
    expect(panel()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('destroy while armed cancels the pending cover', () => {
    mount();
    click(link('/our-story'));
    handle?.destroy();
    handle = null;
    expect(vi.getTimerCount()).toBe(0);
  });
});
