import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Reveal } from './Reveal';
import { SectionRenderer, shouldReveal } from '../SectionRenderer';
import type { SectionInstance, Theme } from '../types';

type IOCallback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void;
let ioCallback: IOCallback | null = null;
const observed = new Set<Element>();

beforeEach(() => {
  observed.clear();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IOCallback) {
        ioCallback = cb;
      }
      observe(el: Element) {
        observed.add(el);
      }
      unobserve(el: Element) {
        observed.delete(el);
      }
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function Dummy() {
  return <p>hello</p>;
}
const theme = {
  key: 't',
  sections: { 'hero-slider': { Component: Dummy }, 'rich-text': { Component: Dummy }, 'product-page': { Component: Dummy } },
} as unknown as Theme;
const sec = (id: string, key: string, sort: number) =>
  ({ id, section_key: key, sort_order: sort, is_hidden: false, settings: {}, translations: [] }) as unknown as SectionInstance;

describe('SectionRenderer SSR', () => {
  it('renders the first and LCP-type sections without a reveal and nothing hidden', () => {
    const html = renderToString(
      <SectionRenderer
        theme={theme}
        locale="en"
        primaryLocale="en"
        storeSlug="s"
        sections={[sec('b', 'rich-text', 2), sec('a', 'hero-slider', 1), sec('c', 'product-page', 3), sec('d', 'rich-text', 4)]}
      />,
    );
    expect(html).not.toContain('opacity');
    expect(html).not.toContain('data-reveal-state');
    expect(html).toMatch(/data-section-id="a"(?![^>]*data-reveal)/);
    expect(html).toMatch(/data-section-id="c"(?![^>]*data-reveal)/);
    expect(html).toMatch(/data-reveal="up"[^>]*data-section-id="b"/);
    expect(html).toMatch(/data-reveal="up"[^>]*data-section-id="d"/);
  });

  it('shouldReveal skips first, hero-* and LCP keys', () => {
    expect(shouldReveal('rich-text', true)).toBe(false);
    expect(shouldReveal('hero-banner', false)).toBe(false);
    expect(shouldReveal('aurora-hero', false)).toBe(false);
    expect(shouldReveal('product-listing', false)).toBe(false);
    expect(shouldReveal('product-gallery', false)).toBe(false);
    expect(shouldReveal('rich-text', false)).toBe(true);
  });
});

describe('Reveal', () => {
  it('arms an off-screen element and reveals it on intersection', () => {
    const { container } = render(<Reveal>x</Reveal>);
    const el = container.firstElementChild as HTMLElement;
    // jsdom rect is all zeros (bottom 0) => treated as off-screen.
    expect(el.dataset.revealState).toBe('pending');
    expect(observed.has(el)).toBe(true);
    act(() => ioCallback?.([{ isIntersecting: true, target: el }]));
    expect(el.dataset.revealState).toBe('shown');
    expect(observed.has(el)).toBe(false);
  });

  it('leaves an element already in the viewport visible', () => {
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ top: 10, bottom: 300 } as DOMRect);
    const { container } = render(<Reveal direction="scale" delay={0.1}>x</Reveal>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset.revealState).toBeUndefined();
    expect(el.dataset.reveal).toBe('scale');
    expect(el.style.getPropertyValue('--reveal-delay')).toBe('0.1s');
    spy.mockRestore();
  });
});
