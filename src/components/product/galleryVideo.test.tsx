import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { lazy, Suspense, type ComponentType } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductContext, SectionRenderProps } from '@/themes/types';
import { clearConsent } from '@/lib/consent';
import type { StorefrontProductVideo } from '@/lib/productVideo';

// Product video in the galleries (contract 6.5, web-galleries): the monolith
// ProductGallery, every product-gallery block layout, the shared lightbox,
// designer products and the page state's variant reset.

const loads = vi.hoisted(() => ({ count: 0 }));
const designerOn = vi.hoisted(() => ({ value: false }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/products/mug',
  useParams: () => ({ storeSlug: 'shop' }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (k: string, p?: Record<string, unknown>) => (p ? `${k}:${JSON.stringify(p)}` : k),
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: vi.fn() }) }));
vi.mock('@/components/StoreImage', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  StoreImage: ({ src, alt, loading }: { src: string; alt: string; loading?: string }) => (
    <img src={src} alt={alt} data-loading={loading} />
  ),
}));
// next/dynamic: SSR-enabled modules (the video gallery parts) resolve
// eagerly, as Next renders them on the server, so first renders and
// renderToString are synchronous. The ssr:false player stays React.lazy; the
// counter proves its chunk is requested only after Play.
const dyn = vi.hoisted(() => ({ pending: [] as Promise<unknown>[] }));
vi.mock('next/dynamic', () => ({
  default: (
    loader: () => Promise<ComponentType<Record<string, unknown>> | { default: ComponentType<Record<string, unknown>> }>,
    opts?: { ssr?: boolean },
  ) => {
    const asModule = (m: unknown) =>
      (m && typeof m === 'object' && 'default' in m ? m : { default: m }) as { default: ComponentType<Record<string, unknown>> };
    if (opts?.ssr === false) {
      const Lazy = lazy(() => {
        loads.count += 1;
        return loader().then(asModule);
      });
      return function Dynamic(props: Record<string, unknown>) {
        return (
          <Suspense fallback={null}>
            <Lazy {...props} />
          </Suspense>
        );
      };
    }
    let Loaded: ComponentType<Record<string, unknown>> | null = null;
    const ready = loader().then((m) => {
      Loaded = asModule(m).default;
    });
    dyn.pending.push(ready);
    return function Dynamic(props: Record<string, unknown>) {
      if (!Loaded) throw new Error('dynamic module not loaded yet');
      const C = Loaded;
      return <C {...props} />;
    };
  },
}));
// Designer sessions are toggled per test; the canvas is a stub.
vi.mock('@/components/designer/DesignerSession', async (orig) => {
  const actual = await orig<typeof import('@/components/designer/DesignerSession')>();
  return {
    ...actual,
    useDesignerSession: () => (designerOn.value ? { session: null } : null),
    DesignerCanvasSlot: ({ className }: { className?: string }) => <div className={className} data-testid="canvas" />,
  };
});

import { ProductGallery } from './ProductGallery';
import { ProductDetailClient } from './ProductDetailClient';
import { ProductPageStateProvider, useProductPageState } from './state/ProductPageState';
import { ProductGalleryMagic } from '@/themes/minimal/sections/product/ProductGalleryMagic.client';

Element.prototype.scrollIntoView = vi.fn();

const IMG = (n: string) => `https://cdn.test/${n}.jpg`;

const FILE_VIDEO: StorefrontProductVideo = {
  id: 'vid-1',
  kind: 'file',
  url: '/uploads/products/0f6c3d5e-1111-4222-8333-944455556666.mp4',
  poster_url: '/uploads/products/poster.webp',
  duration_s: 32,
  width: 1280,
  height: 720,
  position: 1,
  alt: 'Mug in use',
  created_at: '2026-11-13T10:00:00.000Z',
};
const YT_VIDEO: StorefrontProductVideo = {
  ...FILE_VIDEO,
  id: 'vid-yt',
  kind: 'youtube',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  position: 2,
  alt: 'Unboxing',
};

function makeProduct(overrides: Partial<ProductData> = {}): ProductData {
  return {
    id: 'p1',
    base_price: 100,
    translations: [{ locale: 'en', title: 'Mug', slug: 'mug' }],
    images: [
      { id: 'i1', url: IMG('one'), alt: 'One' },
      { id: 'i2', url: IMG('two'), alt: 'Two' },
    ],
    variants: [
      { id: 'v-s', price: 100, stock: 5, options: { Size: 'S' } },
      { id: 'v-m', price: 100, stock: 5, options: { Size: 'M' } },
    ],
    videos: [FILE_VIDEO],
    ...overrides,
  };
}

const playButton = () => screen.getByRole('button', { name: /product\.playVideoNamed/ });

beforeAll(async () => {
  // Settle every SSR-enabled dynamic module (and the ones they declare).
  for (let i = 0; i < 5; i += 1) await Promise.all(dyn.pending);
});

beforeEach(() => {
  loads.count = 0;
  designerOn.value = false;
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  clearConsent('shop');
});

/** The page state driving a monolith ProductGallery, plus a variant switch. */
function MonolithHarness() {
  const s = useProductPageState();
  return (
    <>
      <button type="button" onClick={() => s.setSelectedVariantId('v-m')}>pick-m</button>
      <span data-testid="active">{s.activeGalleryIndex}</span>
      <ProductGallery
        images={s.galleryImages}
        {...(s.hasVideos ? { items: s.galleryMedia, storeSlug: 'shop' } : {})}
        activeIndex={s.activeGalleryIndex}
        onIndexChange={s.setActiveGalleryIndex}
      />
    </>
  );
}

function renderMonolith(product = makeProduct()) {
  return render(
    <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="SEK">
      <MonolithHarness />
    </ProductPageStateProvider>,
  );
}

describe('monolith ProductGallery with videos', () => {
  it('puts the video after the first product image, with a thumbnail badge and no player before Play', () => {
    const html = renderToString(
      <ProductPageStateProvider product={makeProduct()} locale="en" primaryLocale="en" currency="SEK">
        <MonolithHarness />
      </ProductPageStateProvider>,
    );
    expect(html).not.toContain('<video');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('1<!-- --> / <!-- -->3');

    const { container } = renderMonolith();
    const thumbs = container.querySelectorAll('button[aria-label^="product.viewImage"]');
    expect(thumbs).toHaveLength(3);
    // Index 0 stays an image (D6); the video sits at index 1 with a Play badge.
    expect(thumbs[0].querySelector('img')?.getAttribute('src')).toBe(IMG('one'));
    expect(thumbs[1].querySelector('img')?.getAttribute('src')).toContain('poster.webp');
    expect(thumbs[1].querySelector('[aria-hidden="true"]')?.textContent).toContain('0:32');
    expect(loads.count).toBe(0);
  });

  it('plays the video in the main slot on Play, without opening the lightbox or zooming', async () => {
    const { container } = renderMonolith();
    fireEvent.click(container.querySelectorAll('button[aria-label^="product.viewImage"]')[1]);
    const main = container.querySelector('.cursor-default') as HTMLElement;
    expect(main).not.toBeNull();
    // Hover zoom stays off on a video slide.
    fireEvent.mouseEnter(main);
    expect(container.querySelector('.pointer-events-none[style*="background-size"]')).toBeNull();

    fireEvent.click(playButton());
    expect(screen.queryByRole('dialog')).toBeNull();
    const video = await waitFor(() => {
      const v = container.querySelector('video');
      expect(v).not.toBeNull();
      return v!;
    });
    expect(video.hasAttribute('playsinline')).toBe(true);
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(loads.count).toBe(1);
  });

  it('hands a playing video over to the lightbox (mediaViewer), inline player unmounted', async () => {
    const { container } = renderMonolith();
    fireEvent.click(container.querySelectorAll('button[aria-label^="product.viewImage"]')[1]);
    fireEvent.click(playButton());
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());

    fireEvent.click(screen.getByLabelText('product.viewFullScreen'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveAttribute('aria-label', 'product.mediaViewer');
    // The inline slide went back to its poster; the lightbox plays the clip.
    expect(container.querySelector('video')).toBeNull();
    await waitFor(() => expect(dialog.querySelector('video')).not.toBeNull());

    // Arrow keys do not change the slide while the video has focus.
    const lightboxVideo = dialog.querySelector('video') as HTMLVideoElement;
    // jsdom only focuses elements with a tab index (browsers focus controls).
    lightboxVideo.tabIndex = 0;
    lightboxVideo.focus();
    expect(document.activeElement).toBe(lightboxVideo);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('active').textContent).toBe('1');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('variant change while a video plays: back to index 0 and the player unmounts', async () => {
    const { container } = renderMonolith();
    fireEvent.click(container.querySelectorAll('button[aria-label^="product.viewImage"]')[1]);
    fireEvent.click(playButton());
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    expect(screen.getByTestId('active').textContent).toBe('1');

    fireEvent.click(screen.getByText('pick-m'));
    expect(screen.getByTestId('active').textContent).toBe('0');
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('[data-gallery-video]')).toBeNull();
  });

  it('YouTube without consent: the link-out notice, no iframe', () => {
    const { container } = renderMonolith(makeProduct({ videos: [YT_VIDEO] }));
    fireEvent.click(container.querySelectorAll('button[aria-label^="product.viewImage"]')[2]);
    fireEvent.click(playButton());
    expect(container.querySelector('iframe')).toBeNull();
    const link = screen.getByRole('link', { name: 'product.watchOnYouTube' });
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('a product whose videos have no image to sit after shows images only', () => {
    const { container } = renderMonolith(makeProduct({ images: [], videos: [FILE_VIDEO] }));
    expect(container.querySelector('[data-gallery-video]')).toBeNull();
  });
});

describe('shared lightbox: reading direction', () => {
  it('flips the arrows and the arrow keys in RTL (video products)', () => {
    const images = [
      { id: 'a', url: IMG('a'), alt: 'A' },
      { id: 'b', url: IMG('b'), alt: 'B' },
      { id: 'c', url: IMG('c'), alt: 'C' },
    ];
    const items = images.map((img) => ({ kind: 'image' as const, ...img }));
    const onIndexChange = vi.fn();
    render(
      <div dir="rtl">
        <ProductGallery images={images} items={items} storeSlug="shop" activeIndex={1} onIndexChange={onIndexChange} />
      </div>,
    );
    fireEvent.click(screen.getByLabelText('product.viewFullScreen'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('dir', 'rtl');
    const prev = dialog.querySelector('button[aria-label="product.previousImage"]')!;
    const next = dialog.querySelector('button[aria-label="product.nextImage"]')!;
    expect(prev.className).toContain('inset-s-4');
    expect(next.className).toContain('inset-e-4');
    expect(prev.querySelector('svg')?.getAttribute('class')).toContain('rtl:rotate-180');
    // ArrowLeft moves forward in RTL.
    onIndexChange.mockClear();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
  });
});

function blockProps(settings: Record<string, unknown>): SectionRenderProps {
  return {
    settings,
    content: {},
    locale: 'en',
    primaryLocale: 'en',
    storeSlug: 'shop',
    currency: 'SEK',
    product: makeProduct() as unknown as ProductContext,
    builderPreview: false,
  };
}

function renderBlock(settings: Record<string, unknown>, product = makeProduct()) {
  return render(
    <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="SEK">
      <ProductGalleryMagic {...blockProps(settings)} />
    </ProductPageStateProvider>,
  );
}

describe('product-gallery block with videos', () => {
  it('classic delegates to ProductGallery with the mixed list', () => {
    const { container } = renderBlock({ layout: 'classic' });
    expect(container.querySelectorAll('button[aria-label^="product.viewImage"]')).toHaveLength(3);
  });

  it('main-thumbnails: video thumbnail, inline play and the full-screen viewer', async () => {
    const { container } = renderBlock({ layout: 'main-thumbnails', enable_zoom: true });
    const thumbs = container.querySelectorAll('button[aria-pressed]');
    expect(thumbs).toHaveLength(3);
    // Image click opens the shared lightbox.
    fireEvent.click(container.querySelector('[data-gallery-expand]')!);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'product.imageViewer');
    fireEvent.click(screen.getByLabelText('common.close'));

    fireEvent.click(thumbs[1]);
    // No zoom badge on a video slide.
    expect(container.querySelector('.lucide-zoom-in')).toBeNull();
    fireEvent.click(playButton());
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
  });

  it('carousel plays inline and keeps the dots', async () => {
    const { container } = renderBlock({ layout: 'carousel' });
    expect(container.querySelectorAll('button[aria-label^="Image "]')).toHaveLength(3);
    fireEvent.click(screen.getByLabelText('Next'));
    fireEvent.click(playButton());
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
  });

  it('grid / stacked: one poster per video, only one plays at a time', async () => {
    const product = makeProduct({ videos: [FILE_VIDEO, { ...FILE_VIDEO, id: 'vid-2', alt: 'Second' }] });
    for (const layout of ['grid', 'stacked']) {
      const { container, unmount } = renderBlock({ layout }, product);
      const plays = screen.getAllByRole('button', { name: /product\.playVideoNamed/ });
      expect(plays).toHaveLength(2);
      fireEvent.click(plays[0]);
      await waitFor(() => expect(container.querySelectorAll('video')).toHaveLength(1));
      fireEvent.click(screen.getByRole('button', { name: /playVideoNamed.*Second/ }));
      await waitFor(() => {
        expect(container.querySelectorAll('video')).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: /product\.playVideoNamed/ })).toHaveLength(1);
      });
      unmount();
    }
  });

  it('designer products list their videos below the canvas (D7)', () => {
    designerOn.value = true;
    const { container } = renderBlock({ layout: 'main-thumbnails' });
    const gallery = container.querySelector('[data-designer-gallery]')!;
    const canvas = gallery.querySelector('[data-testid="canvas"]')!;
    const list = gallery.querySelector('section[aria-label="product.productVideos"]')!;
    expect(list).not.toBeNull();
    expect(canvas.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('no list for a designer product without video', () => {
    designerOn.value = true;
    const { container } = renderBlock({ layout: 'main-thumbnails' }, makeProduct({ videos: undefined }));
    expect(container.querySelector('section[aria-label="product.productVideos"]')).toBeNull();
  });
});

describe('block layouts: full-screen viewer only for products with videos', () => {
  for (const layout of ['main-thumbnails', 'carousel', 'grid', 'stacked']) {
    it(`${layout}: no button and no click-to-open without videos (markup unchanged)`, () => {
      const { container } = renderBlock({ layout }, makeProduct({ videos: undefined }));
      expect(container.querySelector('[data-gallery-expand]')).toBeNull();
      fireEvent.click(container.querySelector('img')!);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it(`${layout}: with videos, portalled to <body>, closes on Escape`, () => {
      const { container } = renderBlock({ layout });
      fireEvent.click(container.querySelector('[data-gallery-expand]')!);
      const dialog = screen.getByRole('dialog');
      expect(dialog.parentElement).toBe(document.body);
      expect(container.contains(dialog)).toBe(false);
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  }
});

describe('monolith page (ProductDetailClient) with a designer product', () => {
  it('shows the videos below the canvas', () => {
    designerOn.value = true;
    const { container } = render(
      <ProductDetailClient product={makeProduct()} locale="en" primaryLocale="en" currency="SEK" />,
    );
    const canvas = container.querySelector('[data-testid="canvas"]')!;
    const list = container.querySelector('section[aria-label="product.productVideos"]')!;
    expect(list).not.toBeNull();
    expect(canvas.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('lightbox never starts a video that was not playing (D3 / D4)', () => {
  it('monolith: expand on a poster shows poster + Play in the viewer, no player', async () => {
    const { container } = renderMonolith();
    fireEvent.click(container.querySelectorAll('button[aria-label^="product.viewImage"]')[1]);
    fireEvent.click(screen.getByLabelText('product.viewFullScreen'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('video')).toBeNull();
    expect(dialog.querySelector('button[aria-label^="product.playVideoNamed"]')).not.toBeNull();
  });

  it('monolith: after the hand-off, leaving and coming back shows the poster again', async () => {
    const { container } = renderMonolith();
    fireEvent.click(container.querySelectorAll('button[aria-label^="product.viewImage"]')[1]);
    fireEvent.click(playButton());
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    fireEvent.click(screen.getByLabelText('product.viewFullScreen'));
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog.querySelector('video')).not.toBeNull());
    fireEvent.click(dialog.querySelector('button[aria-label="product.previousImage"]')!);
    expect(dialog.querySelector('video')).toBeNull();
    fireEvent.click(dialog.querySelector('button[aria-label="product.nextImage"]')!);
    expect(dialog.querySelector('video')).toBeNull();
    expect(dialog.querySelector('button[aria-label^="product.playVideoNamed"]')).not.toBeNull();
  });

  it('block main-thumbnails: expand on a poster does not start it', () => {
    const { container } = renderBlock({ layout: 'main-thumbnails' });
    fireEvent.click(container.querySelectorAll('button[aria-pressed]')[1]);
    fireEvent.click(container.querySelector('[data-gallery-expand]')!);
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('video')).toBeNull();
    expect(dialog.querySelector('button[aria-label^="product.playVideoNamed"]')).not.toBeNull();
  });
});

describe('grid layout: eager images count images only (critic A5)', () => {
  it('a video at slot 1 keeps the second image eager', () => {
    const product = makeProduct({
      images: [
        { id: 'i1', url: IMG('one'), alt: 'One' },
        { id: 'i2', url: IMG('two'), alt: 'Two' },
        { id: 'i3', url: IMG('three'), alt: 'Three' },
      ],
    });
    const { container } = renderBlock({ layout: 'grid' }, product);
    const byName = (n: string) => container.querySelector(`img[src="${IMG(n)}"]`)!;
    expect(byName('one').getAttribute('data-loading')).toBe('eager');
    expect(byName('two').getAttribute('data-loading')).toBe('eager');
    expect(byName('three').getAttribute('data-loading')).toBeNull();
  });
});

describe('designer products: the video list follows the form on phones', () => {
  it('monolith and block lists carry the mobile order', () => {
    designerOn.value = true;
    const mono = render(<ProductDetailClient product={makeProduct()} locale="en" primaryLocale="en" currency="SEK" />);
    const list = mono.container.querySelector('section[aria-label="product.productVideos"]')!;
    expect(list.className).toContain('order-last');
    expect(list.className).toContain('md:order-0');
    mono.unmount();
    const block = renderBlock({ layout: 'main-thumbnails' });
    expect(block.container.querySelector('section[aria-label="product.productVideos"]')!.className).toContain('order-last');
  });
});
