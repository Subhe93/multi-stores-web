import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findLoadedRendition, LightboxImage } from './LightboxImage';

// jsdom never decodes images: mark chosen <img>s as loaded with a width.
function markLoaded(img: HTMLImageElement, width: number, currentSrc?: string) {
  Object.defineProperty(img, 'complete', { value: true, configurable: true });
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  if (currentSrc) Object.defineProperty(img, 'currentSrc', { value: currentSrc, configurable: true });
}

function pageImage(src: string): HTMLImageElement {
  const img = document.createElement('img');
  img.setAttribute('src', src);
  document.body.appendChild(img);
  return img;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('findLoadedRendition', () => {
  it('returns the currentSrc of a loaded page image of the same source (optimizer URL)', () => {
    const img = pageImage('/_next/image?url=%2Fuploads%2Fa.jpg&w=3840&q=75');
    markLoaded(img, 828, 'http://shop.test/_next/image?url=%2Fuploads%2Fa.jpg&w=828&q=75');
    expect(findLoadedRendition('/uploads/a.jpg')).toBe('http://shop.test/_next/image?url=%2Fuploads%2Fa.jpg&w=828&q=75');
  });

  it('ignores a page image that has not loaded (lazy, off-screen)', () => {
    pageImage('/_next/image?url=%2Fuploads%2Fa.jpg&w=3840&q=75');
    expect(findLoadedRendition('/uploads/a.jpg')).toBeNull();
  });

  it('ignores other images and prefers the largest loaded rendition', () => {
    markLoaded(pageImage('/_next/image?url=%2Fuploads%2Fb.jpg&w=3840&q=75'), 2000, 'http://shop.test/b-big');
    markLoaded(pageImage('/_next/image?url=%2Fuploads%2Fa.jpg&w=3840&q=75'), 96, 'http://shop.test/a-thumb');
    markLoaded(pageImage('/_next/image?url=%2Fuploads%2Fa.jpg&w=3840&q=75'), 640, 'http://shop.test/a-main');
    expect(findLoadedRendition('/uploads/a.jpg')).toBe('http://shop.test/a-main');
  });
});

describe('LightboxImage', () => {
  it('uses the exact file the page loaded as placeholder (no srcset, so no new download)', () => {
    markLoaded(pageImage('/_next/image?url=%2Fuploads%2Fa.jpg&w=3840&q=75'), 828, 'http://shop.test/a-828');
    render(<LightboxImage src="/uploads/a.jpg" alt="A" sizes="92vw" loadingLabel="loading" />);
    const ph = document.querySelector('[data-lightbox-placeholder] img')!;
    expect(ph.getAttribute('src')).toBe('http://shop.test/a-828');
    expect(ph.hasAttribute('srcset')).toBe(false);
    expect(ph.hasAttribute('sizes')).toBe(false);
    fireEvent.load(screen.getByAltText('A'));
    expect(document.querySelector('[data-lightbox-placeholder]')).toBeNull();
  });

  it('an image the page never loaded gets the spinner only (no extra rendition request)', () => {
    pageImage('/_next/image?url=%2Fuploads%2Fa.jpg&w=3840&q=75');
    render(<LightboxImage src="/uploads/a.jpg" alt="A" sizes="92vw" loadingLabel="loading" />);
    expect(document.querySelector('[data-lightbox-placeholder]')).not.toBeNull();
    expect(document.querySelector('[data-lightbox-placeholder] img')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('loading');
    // Only the full image is requested.
    expect(document.querySelectorAll('img')).toHaveLength(2);
  });
});
