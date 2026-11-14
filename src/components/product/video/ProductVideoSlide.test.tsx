import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { lazy, Suspense, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearConsent,
  clearExternalMediaConsent,
  grantExternalMediaConsent,
  readExternalMediaConsent,
  writeConsent,
} from '@/lib/consent';
import { toGalleryVideoItem, type GalleryVideoItem, type StorefrontProductVideo } from '@/lib/productVideo';

const loads = vi.hoisted(() => ({ count: 0 }));

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, p?: Record<string, unknown>) => (p ? `${k}:${JSON.stringify(p)}` : k),
}));
vi.mock('@/hooks/useLocalePath', () => ({ useLocalePath: () => (p: string) => p }));
vi.mock('@/components/StoreImage', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  StoreImage: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
// next/dynamic -> React.lazy so the player chunk resolves in jsdom; the
// counter proves the chunk is not requested before Play (React.lazy caches
// the first load, so only the first render of the file is checked).
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>) => {
    const Lazy = lazy(() => {
      loads.count += 1;
      return loader();
    });
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
import { ProductVideoList } from './ProductVideoList';
import { ProductVideoThumbBadge } from './ProductVideoThumbBadge';

function item(overrides: Partial<StorefrontProductVideo> = {}): GalleryVideoItem {
  const v = toGalleryVideoItem(
    {
      id: 'v1',
      kind: 'file',
      url: '/uploads/products/a.mp4',
      poster_url: '/uploads/products/a.webp',
      duration_s: 75,
      width: 1280,
      height: 720,
      position: 1,
      alt: 'Mug demo',
      created_at: '2026-11-13T10:00:00.000Z',
      ...overrides,
    },
    'Mug',
  );
  if (!v) throw new Error('fixture');
  return v;
}

const youtubeItem = () => item({ id: 'yt', kind: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' });
const vimeoItem = () => item({ id: 'vm', kind: 'vimeo', url: 'https://vimeo.com/76979871' });

beforeEach(() => {
  loads.count = 0;
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  clearConsent('shop');
  clearExternalMediaConsent('shop');
});

describe('ProductVideoSlide before play', () => {
  it('server-renders the poster and Play button with no <video> or <iframe>', () => {
    const html = renderToString(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />);
    expect(html).toContain('data-gallery-video');
    expect(html).toContain('product.playVideoNamed');
    expect(html).toContain('/uploads/products/a.webp');
    expect(html).toContain('1:15');
    expect(html).not.toContain('<video');
    expect(html).not.toContain('<iframe');
    expect(loads.count).toBe(0);
  });

  it('renders a neutral tile when there is no poster', () => {
    render(<ProductVideoSlide item={item({ poster_url: null })} storeSlug="shop" sizes="100vw" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button')).toHaveAccessibleName('product.playVideoNamed:{"alt":"Mug demo"}');
  });

  it('a click never bubbles to the gallery (lightbox); touches do (swipe)', () => {
    const parentClick = vi.fn();
    const parentTouch = vi.fn();
    render(
      <div onClick={parentClick} onTouchStart={parentTouch}>
        <ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />
      </div>,
    );
    fireEvent.touchStart(screen.getByRole('button'), { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.click(screen.getByRole('button'));
    expect(parentClick).not.toHaveBeenCalled();
    expect(parentTouch).toHaveBeenCalled();
  });

  it('the click that ends a swipe over the poster does not start the player', () => {
    const { container } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />);
    const btn = screen.getByRole('button');
    fireEvent.touchStart(btn, { touches: [{ clientX: 100, clientY: 10 }] });
    fireEvent.touchMove(btn, { touches: [{ clientX: 40, clientY: 12 }] });
    fireEvent.click(btn);
    expect(container.querySelector('[data-gallery-video="player"]')).toBeNull();
    expect(container.querySelector('[data-gallery-video="poster"]')).not.toBeNull();
  });
});

describe('ProductVideoSlide after play', () => {
  it('a file video mounts <video playsinline controls> and starts it', async () => {
    const onPlayingChange = vi.fn();
    const { container } = render(
      <ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" onPlayingChange={onPlayingChange} />,
    );
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    const video = container.querySelector('video')!;
    expect(video.hasAttribute('playsinline')).toBe(true);
    expect(video.hasAttribute('controls')).toBe(true);
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(video.getAttribute('src')).toMatch(/\/uploads\/products\/a\.mp4$/);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(onPlayingChange).toHaveBeenLastCalledWith(true);
  });

  it('pauses the file video when the tab is hidden', async () => {
    const { container } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('shows the unavailable chip when the file fails', async () => {
    const { container } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    fireEvent.error(container.querySelector('video')!);
    expect(screen.getByText('product.videoUnavailable')).toBeInTheDocument();
    expect(container.querySelector('video')).toBeNull();
  });

  it('without the external grant, an external video shows the two-click facade and no iframe', () => {
    const { container } = render(<ProductVideoSlide item={youtubeItem()} storeSlug="shop" sizes="100vw" />);
    // Shown up front after hydration (not only after a click).
    expect(screen.getByRole('group', { name: 'product.externalVideoTitle:{"provider":"YouTube"}' })).toBeInTheDocument();
    expect(
      screen.getByText('product.externalVideoNotice:{"provider":"YouTube","company":"YouTube/Google"}'),
    ).toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
    expect(loads.count).toBe(0);
    const link = screen.getByRole('link', { name: 'product.watchOnYouTube' });
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'product.externalVideoPrivacy' })).toHaveAttribute('href', '/legal/privacy');
  });

  it('a general "Accept all" does not unlock embeds (Vimeo facade)', () => {
    writeConsent('shop', 'granted');
    const { container } = render(<ProductVideoSlide item={vimeoItem()} storeSlug="shop" sizes="100vw" />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByText('product.externalVideoNotice:{"provider":"Vimeo","company":"Vimeo"}')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'product.watchOnVimeo' })).toHaveAttribute('href', 'https://vimeo.com/76979871');
  });

  it('[Play video] loads this one nocookie embed and stores nothing', async () => {
    const { container } = render(<ProductVideoSlide item={youtubeItem()} storeSlug="shop" sizes="100vw" />);
    fireEvent.click(screen.getByRole('button', { name: 'product.externalVideoPlay' }));
    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
    const frame = container.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0');
    expect(frame.getAttribute('title')).toBe('Mug demo');
    expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(readExternalMediaConsent('shop')).toBe(false);
  });

  it('the poster Play on a facade is [Play video] (one click loads the embed)', async () => {
    const { container } = render(<ProductVideoSlide item={vimeoItem()} storeSlug="shop" sizes="100vw" />);
    fireEvent.click(screen.getByRole('button', { name: 'product.playVideoNamed:{"alt":"Mug demo"}' }));
    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
    expect(container.querySelector('iframe')!.getAttribute('src')).toBe('https://player.vimeo.com/video/76979871?autoplay=1&dnt=1');
    expect(readExternalMediaConsent('shop')).toBe(false);
  });

  it('[Always allow external videos] stores the grant and loads the embed; other facades disappear', async () => {
    const { container } = render(
      <>
        <ProductVideoSlide item={youtubeItem()} storeSlug="shop" sizes="100vw" />
        <ProductVideoSlide item={vimeoItem()} storeSlug="shop" sizes="100vw" />
      </>,
    );
    expect(screen.getAllByRole('button', { name: 'product.externalVideoAlwaysAllow' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'product.externalVideoAlwaysAllow' })[0]);
    expect(readExternalMediaConsent('shop')).toBe(true);
    await waitFor(() => expect(container.querySelectorAll('iframe')).toHaveLength(1));
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('with the external grant, Play mounts the nocookie iframe', async () => {
    grantExternalMediaConsent('shop');
    const { container } = render(<ProductVideoSlide item={youtubeItem()} storeSlug="shop" sizes="100vw" />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
  });

  it('clearing the grant while the embed plays unmounts it (back to the facade)', async () => {
    grantExternalMediaConsent('shop');
    const { container } = render(<ProductVideoSlide item={youtubeItem()} storeSlug="shop" sizes="100vw" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
    act(() => clearExternalMediaConsent('shop'));
    await waitFor(() => expect(container.querySelector('iframe')).toBeNull());
    expect(screen.getByRole('link', { name: 'product.watchOnYouTube' })).toBeTruthy();
  });

  it('autoStart of an external video without the grant shows the facade, not the iframe', () => {
    const { container } = render(<ProductVideoSlide item={youtubeItem()} storeSlug="shop" sizes="100vw" autoStart />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('button', { name: 'product.externalVideoPlay' })).toBeInTheDocument();
  });

  it('server-renders only the poster for an external video (no facade before hydration)', () => {
    const html = renderToString(<ProductVideoSlide item={youtubeItem()} storeSlug="shop" sizes="100vw" />);
    expect(html).not.toContain('externalVideoNotice');
    expect(html).not.toContain('<iframe');
  });

  it('autoStart (lightbox hand-off) mounts the player immediately and resumes', async () => {
    const { container } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" autoStart startAt={12} />);
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    expect(container.querySelector('video')!.currentTime).toBe(12);
  });

  it('unmounting the slide pauses the player', async () => {
    const { container, unmount } = render(<ProductVideoSlide item={item()} storeSlug="shop" sizes="100vw" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    unmount();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });
});

describe('ProductVideoList', () => {
  it('lists the videos under a labelled section and plays one at a time', async () => {
    const a = item({ id: 'a' });
    const b = item({ id: 'b', url: '/uploads/products/b.mp4' });
    const { container } = render(<ProductVideoList videos={[a, b]} storeSlug="shop" />);
    expect(screen.getByRole('region', { name: 'product.productVideos' })).toBeInTheDocument();
    const [playA, playB] = screen.getAllByRole('button');
    fireEvent.click(playA);
    await waitFor(() => expect(container.querySelectorAll('video')).toHaveLength(1));
    fireEvent.click(playB);
    await waitFor(() => {
      const videos = container.querySelectorAll('video');
      expect(videos).toHaveLength(1);
      expect(videos[0].getAttribute('src')).toMatch(/b\.mp4$/);
    });
  });

  it('renders nothing without videos', () => {
    const { container } = render(<ProductVideoList videos={[]} storeSlug="shop" />);
    expect(container.innerHTML).toBe('');
  });
});

describe('ProductVideoThumbBadge', () => {
  it('is decorative and shows the duration left-to-right', () => {
    const { container } = render(<ProductVideoThumbBadge durationS={9} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('[dir="ltr"]')?.textContent).toBe('0:09');
  });
});
