import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

let pathname: string | null = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import { HeaderOverlayHome } from './HeaderOverlayHome.client';

const MARK = '<span data-overlay-home="" hidden=""></span>';

describe('HeaderOverlayHome', () => {
  afterEach(() => {
    pathname = '/';
  });

  it('marks the home page of the primary locale', () => {
    pathname = '/';
    expect(renderToStaticMarkup(<HeaderOverlayHome homeHref="/" />)).toBe(MARK);
  });

  it('marks the home page of a secondary locale, with or without a trailing slash', () => {
    for (const p of ['/ar', '/ar/']) {
      pathname = p;
      expect(renderToStaticMarkup(<HeaderOverlayHome homeHref="/ar" />)).toBe(MARK);
    }
  });

  it('renders nothing on any other page', () => {
    for (const p of ['/products', '/ar', '/pages/about', '', null]) {
      pathname = p;
      expect(renderToStaticMarkup(<HeaderOverlayHome homeHref="/" />)).toBe('');
    }
    pathname = '/ar/products';
    expect(renderToStaticMarkup(<HeaderOverlayHome homeHref="/ar" />)).toBe('');
  });
});
