import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { lazy, Suspense, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearExternalMediaConsent, grantExternalMediaConsent } from '@/lib/consent';
import { __resetAutoplayForTests, holdAutoplay } from '@/lib/videoAutoplay';
import { toGalleryVideoItem, type GalleryVideoItem, type StorefrontProductVideo } from '@/lib/productVideo';

// Muted autoplay of ProductVideoSlide (product-video CONTRACT-AUTOPLAY A3 / 6.4).

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, p?: Record<string, unknown>) => (p ? `${k}:${JSON.stringify(p)}` : k),
}));
vi.mock('@/hooks/useLocalePath', () => ({ useLocalePath: () => (p: string) => p }));
vi.mock('@/components/StoreImage', () => ({
  StoreImage: ({ src, alt, fetchPriority }: { src: string; alt: string; fetchPriority?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-fetchpriority={fetchPriority} />
  ),
}));
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>) => {
    const Lazy = lazy(loader);
    return function Dynamic(props: Record<string, unknown>) {
      return (
        <Suspense fallback={null}>
          <Lazy {...props} />
        </Suspense>
      );
    };
  },
}));

import { ProductVideoSlide } from './ProductVideoSlide';

function item(overrides: Partial<StorefrontProductVideo> = {}): GalleryVideoItem {
  const v = toGalleryVideoItem(
    {
      id: 'v1',
      kind: 'file',
      url: '/uploads/products/a.mp4',
      poster_url: '/uploads/products/a.webp',
      duration_s: 12,
      width: 1280,
      height: 720,
      position: 1,
      alt: 'Mug demo',
      created_at: '2026-11-13T10:00:00.000Z',
      autoplay: true,
      loop: true,
      ...overrides,
    } as StorefrontProductVideo,
    'Mug',
  );
  if (!v) throw new Error('fixture');
  return v;
}

// Fake IntersectionObserver driven by the test.
let ioCallback: ((entries: Array<Partial<IntersectionObserverEntry>>) => void) | null = null;
const observed: Element[] = [];
class FakeIO {
  constructor(cb: typeof ioCallback) {
    ioCallback = cb;
  }
  observe(el: Element) {
    observed.push(el);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
function showAll(ratio = 1) {
  act(() => {
    ioCallback?.(observed.map((target) => ({ target, isIntersecting: ratio > 0, intersectionRatio: ratio })));
  });
}

let playMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetAutoplayForTests();
  ioCallback = null;
  observed.length = 0;
  vi.stubGlobal('IntersectionObserver', FakeIO);
  playMock = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.play = playMock as unknown as HTMLMediaElement['play'];
  HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  __resetAutoplayForTests();
  clearExternalMediaConsent('shop');
  Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true, writable: true });
});

describe('ProductVideoSlide muted autoplay', () => {
  it('SSR is the poster only (priority poster keeps fetchPriority high)', () => {
    const html = renderToString(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" priority />);
    expect(html).toContain('/uploads/products/a.webp');
    expect(html).toContain('data-fetchpriority="high"');
    expect(html).not.toContain('<video');
    expect(html).not.toContain('<iframe');
  });

  it('a video without autoplay keeps the pre-autoplay markup (no wrapper)', () => {
    const { container } = render(<ProductVideoSlide item={item({ autoplay: false })} storeSlug="shop" sizes="100vw" />);
    expect(container.firstElementChild?.getAttribute('data-gallery-video')).toBe('poster');
    expect(observed).toHaveLength(0);
  });

  it('mounts a muted <video playsinline> without controls / poster only when granted', async () => {
    const { container } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />);
    expect(container.querySelector('video')).toBeNull();
    showAll(1);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    const video = container.querySelector('video')!;
    expect(video.muted).toBe(true);
    expect(video.hasAttribute('playsinline')).toBe(true);
    expect(video.hasAttribute('controls')).toBe(false);
    expect(video.hasAttribute('poster')).toBe(false);
    expect(video.hasAttribute('loop')).toBe(true);
    expect(playMock).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'product.videoPause' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'product.videoUnmute' })).toBeInTheDocument();
  });

  it('does not autoplay with prefers-reduced-motion', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }),
      configurable: true,
      writable: true,
    });
    const { container } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />);
    showAll(1);
    expect(observed).toHaveLength(0);
    expect(container.querySelector('video')).toBeNull();
  });

  it('a manual pause is sticky; play resumes', async () => {
    const { container } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />);
    showAll(1);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    const pause = HTMLMediaElement.prototype.pause as ReturnType<typeof vi.fn>;
    pause.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'product.videoPause' }));
    expect(pause).toHaveBeenCalled();
    playMock.mockClear();
    showAll(0.9);
    expect(playMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'product.videoResume' }));
    expect(playMock).toHaveBeenCalled();
  });

  it('mute toggle unmutes the autoplaying video', async () => {
    const { container } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />);
    showAll(1);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'product.videoUnmute' }));
    expect(container.querySelector('video')!.muted).toBe(false);
    expect(screen.getByRole('button', { name: 'product.videoMute' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('losing the grant re-mutes: an automatic resume never starts with sound', async () => {
    const { container } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />);
    showAll(1);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'product.videoUnmute' }));
    expect(container.querySelector('video')!.muted).toBe(false);
    showAll(0);
    showAll(1);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    expect(container.querySelector('video')!.muted).toBe(true);
    expect(screen.getByRole('button', { name: 'product.videoUnmute' })).toBeInTheDocument();
  });

  it('no read-ahead: preload=metadata, and the <video> is dropped (not just paused) off-screen', async () => {
    const { container } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />);
    showAll(1);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    expect(container.querySelector('video')!.getAttribute('preload')).toBe('metadata');
    Object.defineProperty(container.querySelector('video')!, 'currentTime', { value: 4.5, configurable: true });
    showAll(0);
    expect(container.querySelector('video')).toBeNull();
    // The poster (with its Play button) is what remains.
    expect(screen.getByRole('button', { name: 'product.playVideoNamed:{"alt":"Mug demo"}' })).toBeInTheDocument();
    showAll(1);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    expect(playMock).toHaveBeenCalled();
  });

  it('a rejected play() falls back to the poster with Play (no retry)', async () => {
    playMock.mockImplementation(() => Promise.reject(Object.assign(new Error('nope'), { name: 'NotAllowedError' })));
    const { container } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />);
    showAll(1);
    await waitFor(() => expect(container.querySelector('video')).toBeNull());
    expect(screen.getByRole('button', { name: 'product.playVideoNamed:{"alt":"Mug demo"}' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'product.videoPause' })).toBeNull();
  });

  it('a tap on the autoplaying video opens the user player with sound and controls', async () => {
    const onPlayingChange = vi.fn();
    const { container } = render(
      <ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" onPlayingChange={onPlayingChange} />,
    );
    showAll(1);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    expect(onPlayingChange).not.toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'product.playVideoNamed:{"alt":"Mug demo"}' }));
    await waitFor(() => expect(container.querySelector('video[controls]')).not.toBeNull());
    expect(container.querySelector('[data-gallery-video="player"]')).not.toBeNull();
    expect(onPlayingChange).toHaveBeenLastCalledWith(true);
  });

  it('a hold (lightbox / user player) pauses it', async () => {
    const { container } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />);
    showAll(1);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    const pause = HTMLMediaElement.prototype.pause as ReturnType<typeof vi.fn>;
    pause.mockClear();
    let release = () => {};
    act(() => {
      release = holdAutoplay();
    });
    expect(pause).toHaveBeenCalled();
    act(() => release());
  });

  it('only one of two visible autoplay videos plays', async () => {
    const { container } = render(
      <>
        <ProductVideoSlide item={item({ id: 'a' })} storeSlug="shop" sizes="100vw" />
        <ProductVideoSlide item={item({ id: 'b', url: '/uploads/products/b.mp4' })} storeSlug="shop" sizes="100vw" />
      </>,
    );
    showAll(1);
    await waitFor(() => expect(container.querySelectorAll('video')).toHaveLength(1));
  });

  it('YouTube autoplay never starts without the external grant (facade instead)', () => {
    const { container } = render(
      <ProductVideoSlide item={item({ kind: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' })} storeSlug="shop" sizes="100vw" />,
    );
    showAll(1);
    expect(observed).toHaveLength(0);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('button', { name: 'product.externalVideoPlay' })).toBeInTheDocument();
  });

  it('with the grant, YouTube autoplays muted through the provider params', async () => {
    grantExternalMediaConsent('shop');
    const { container } = render(
      <ProductVideoSlide
        item={item({ kind: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ', loop: false })}
        storeSlug="shop"
        sizes="100vw"
      />,
    );
    showAll(1);
    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
    const src = container.querySelector('iframe')!.getAttribute('src')!;
    expect(src).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&playsinline=1');
    expect(src).toContain('enablejsapi=1');
    expect(src).not.toContain('loop=1');
  });

  it('posterless autoplay clip: no first-frame <video> next to the autoplay layer (one download)', async () => {
    const { container } = render(<ProductVideoSlide item={item({ poster_url: null })} storeSlug="shop" sizes="100vw" />);
    expect(container.querySelector('[data-video-first-frame]')).toBeNull();
    showAll(1);
    await waitFor(() => expect(container.querySelector('[data-gallery-video="autoplay"] video')).not.toBeNull());
    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(container.querySelector('[data-video-first-frame]')).toBeNull();
    // Losing the grant does not remount a first-frame fetch either.
    showAll(0);
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('[data-video-first-frame]')).toBeNull();
  });

  it('posterless autoplay clip keeps the first frame when autoplay cannot run (reduced motion)', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }),
      configurable: true,
      writable: true,
    });
    const { container } = render(<ProductVideoSlide item={item({ poster_url: null })} storeSlug="shop" sizes="100vw" />);
    expect(container.querySelector('[data-video-first-frame]')).not.toBeNull();
  });

  it('posterless autoplay clip shows the first frame after a refused play()', async () => {
    playMock.mockImplementation(() => Promise.reject(Object.assign(new Error('nope'), { name: 'NotAllowedError' })));
    const { container } = render(<ProductVideoSlide item={item({ poster_url: null })} storeSlug="shop" sizes="100vw" />);
    showAll(1);
    await waitFor(() => expect(container.querySelector('[data-video-first-frame]')).not.toBeNull());
    expect(container.querySelector('[data-gallery-video="autoplay"]')).toBeNull();
  });

  it('autoStart never autoplays (user player)', async () => {
    const { container } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" autoStart />);
    await waitFor(() => expect(container.querySelector('video[controls]')).not.toBeNull());
    expect(container.querySelector('[data-video-autoplay]')).toBeNull();
    expect(container.querySelector('video')!.muted).toBe(false);
  });
});
