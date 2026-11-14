import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { lazy, Suspense, type ComponentType, type ReactElement } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductContext, SectionRenderProps } from '@/themes/types';
import { clearConsent } from '@/lib/consent';
import type { StorefrontProductVideo } from '@/lib/productVideo';

// Featured product video (CONTRACT-AUTOPLAY A1 / A2, web-gallery): a video
// with position 0 opens the gallery in every layout, its poster is
// server-rendered as the LCP image (preload + fetchpriority=high + the lead
// sizes), and SSR never contains a <video> or an <iframe>. The real
// StoreImage (next/image) renders here, so the asserted attributes are the
// ones the browser sees.

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
// next/dynamic: SSR-enabled modules resolve eagerly (as Next renders them on
// the server); the ssr:false player stays React.lazy.
const dyn = vi.hoisted(() => ({ pending: [] as Promise<unknown>[] }));
vi.mock('next/dynamic', () => ({
  default: (
    loader: () => Promise<ComponentType<Record<string, unknown>> | { default: ComponentType<Record<string, unknown>> }>,
    opts?: { ssr?: boolean },
  ) => {
    const asModule = (m: unknown) =>
      (m && typeof m === 'object' && 'default' in m ? m : { default: m }) as { default: ComponentType<Record<string, unknown>> };
    if (opts?.ssr === false) {
      const Lazy = lazy(() => loader().then(asModule));
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

import { ProductGallery } from './ProductGallery';
import { ProductPageStateProvider, useProductPageState } from './state/ProductPageState';
import { ProductGalleryMagic } from '@/themes/minimal/sections/product/ProductGalleryMagic.client';

Element.prototype.scrollIntoView = vi.fn();

const IMG = (n: string) => `https://cdn.test/${n}.jpg`;
const POSTER = '/uploads/products/featured-poster.webp';

const FEATURED: StorefrontProductVideo = {
  id: 'vid-featured',
  kind: 'file',
  url: '/uploads/products/0f6c3d5e-1111-4222-8333-944455556666.mp4',
  poster_url: POSTER,
  duration_s: 12,
  width: 1080,
  height: 1080,
  position: 0,
  alt: 'Featured clip',
  created_at: '2026-11-14T10:00:00.000Z',
  autoplay: true,
  loop: true,
};

function makeProduct(overrides: Partial<ProductData> = {}): ProductData {
  return {
    id: 'p1',
    base_price: 100,
    translations: [{ locale: 'en', title: 'Mug', slug: 'mug' }],
    images: [
      { id: 'i1', url: IMG('one'), alt: 'One' },
      { id: 'i2', url: IMG('two'), alt: 'Two' },
      { id: 'i3', url: IMG('three'), alt: 'Three' },
    ],
    variants: [
      { id: 'v-s', price: 100, stock: 5, options: { Size: 'S' } },
      { id: 'v-m', price: 100, stock: 5, options: { Size: 'M' } },
    ],
    videos: [FEATURED],
    ...overrides,
  };
}

/** Exposes the page state's lead values next to a monolith gallery. */
function MonolithHarness() {
  const s = useProductPageState();
  return (
    <>
      <span data-testid="lead-is-video">{String(s.leadIsVideo)}</span>
      <span data-testid="first-image">{s.galleryImages[0]?.url}</span>
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

function monolith(product = makeProduct()) {
  return (
    <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="SEK">
      <MonolithHarness />
    </ProductPageStateProvider>
  );
}

function block(layout: string, product = makeProduct()) {
  const props: SectionRenderProps = {
    settings: { layout, aspect: 'square', enable_zoom: true },
    content: {},
    locale: 'en',
    primaryLocale: 'en',
    storeSlug: 'shop',
    currency: 'SEK',
    product: product as unknown as ProductContext,
    builderPreview: false,
  };
  return (
    <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="SEK">
      <ProductGalleryMagic {...props} />
    </ProductPageStateProvider>
  );
}

/** The <img> tags of an HTML string whose src mentions `needle`. */
function imgTags(html: string, needle: string): string[] {
  return (html.match(/<img\b[^>]*>/g) ?? []).filter((tag) => tag.includes(needle));
}

/** Every <img> tag carrying fetchpriority="high". */
function highPriority(html: string): string[] {
  return (html.match(/<img\b[^>]*>/g) ?? []).filter((tag) => /fetchpriority="high"/i.test(tag));
}

beforeAll(async () => {
  for (let i = 0; i < 5; i += 1) await Promise.all(dyn.pending);
});

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  clearConsent('shop');
});

const LEAD_SIZES: Record<string, string> = {
  monolith: '(min-width: 768px) 50vw, 100vw',
  classic: '(min-width: 768px) 50vw, 100vw',
  'main-thumbnails': '(min-width: 768px) 50vw, 100vw',
  carousel: '(min-width: 768px) 50vw, 100vw',
  grid: '(min-width: 768px) 25vw, 50vw',
  stacked: '(min-width: 768px) 50vw, 100vw',
};

describe('featured video: SSR poster is the LCP image (A2)', () => {
  const cases: [string, () => ReactElement][] = [
    ['monolith', () => monolith()],
    ...(['classic', 'main-thumbnails', 'carousel', 'grid', 'stacked'] as const).map(
      (layout): [string, () => ReactElement] => [layout, () => block(layout)],
    ),
  ];

  for (const [name, el] of cases) {
    it(`${name}: poster with fetchpriority=high and the lead sizes, no player markup`, () => {
      const html = renderToString(el());
      expect(html).not.toContain('<video');
      expect(html).not.toContain('<iframe');

      // The poster is rendered first among the main media, at high priority.
      const posters = imgTags(html, 'featured-poster');
      const lead = posters.find((tag) => /fetchpriority="high"/i.test(tag));
      expect(lead, `${name}: high-priority poster`).toBeDefined();
      expect(lead).toContain(`sizes="${LEAD_SIZES[name]}"`);
      expect(lead).not.toMatch(/loading="lazy"/);
      // Only one high-priority image: the first product image does not compete.
      expect(highPriority(html)).toHaveLength(1);
      expect(imgTags(html, 'one.jpg').some((tag) => /fetchpriority="high"/i.test(tag))).toBe(false);
    });
  }

  it('the page state keeps the first IMAGE for cart / OG, and flags the video lead', () => {
    render(monolith());
    expect(screen.getByTestId('lead-is-video').textContent).toBe('true');
    expect(screen.getByTestId('first-image').textContent).toBe(IMG('one'));
  });

  it('without a featured video the first image stays the lead', () => {
    const html = renderToString(monolith(makeProduct({ videos: [{ ...FEATURED, position: 1 }] })));
    const high = highPriority(html);
    expect(high).toHaveLength(1);
    expect(high[0]).toContain('one.jpg');
    render(monolith(makeProduct({ videos: [{ ...FEATURED, position: 1 }] })));
    expect(screen.getByTestId('lead-is-video').textContent).toBe('false');
  });
});

describe('featured video: gallery order', () => {
  it('monolith: the video is slide 1, the image star badge stays on images only', () => {
    const { container } = render(monolith());
    const thumbs = container.querySelectorAll('button[aria-label^="product.viewImage"]');
    expect(thumbs).toHaveLength(4);
    expect(thumbs[0].querySelector('img')?.getAttribute('src')).toContain('featured-poster');
    // The amber star marks index 0 only when it is an image.
    expect(container.querySelector('.bg-amber-500')).toBeNull();
    // Main slot: poster + Play, no player before a click.
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByRole('button', { name: /product\.playVideoNamed/ })).toBeTruthy();
  });

  it('block main-thumbnails / carousel / grid / stacked: the video comes first', () => {
    for (const layout of ['main-thumbnails', 'carousel', 'grid', 'stacked']) {
      const { container, unmount } = render(block(layout));
      const first = container.querySelector('section img');
      expect(first?.getAttribute('src'), layout).toContain('featured-poster');
      unmount();
    }
  });
});

describe('featured video: swipe', () => {
  // ProductVideoPoster still stops touch events until web-embeds-stories (W2)
  // lands CONTRACT-AUTOPLAY 6.4; the gallery side (swipe skipped only inside
  // [data-gallery-video="player"]) is in place. Enable this test with W2.
  it.skip('a swipe over the featured poster navigates to the next slide', () => {
    const { container } = render(monolith());
    const poster = container.querySelector('[data-gallery-video]') as HTMLElement;
    fireEvent.touchStart(poster, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(poster, { changedTouches: [{ clientX: 100, clientY: 105 }] });
    expect(screen.getByTestId('active').textContent).toBe('1');
  });

  it('a swipe inside a user-started player does not navigate', async () => {
    const { container } = render(monolith());
    fireEvent.click(screen.getByRole('button', { name: /product\.playVideoNamed/ }));
    const video = await waitFor(() => {
      const v = container.querySelector('video');
      expect(v).not.toBeNull();
      return v!;
    });
    fireEvent.touchStart(video, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(video, { changedTouches: [{ clientX: 100, clientY: 105 }] });
    expect(screen.getByTestId('active').textContent).toBe('0');
  });

  it('a swipe outside the video (counter badge) still navigates', () => {
    const { container } = render(monolith());
    const counter = Array.from(container.querySelectorAll('span')).find((s) => /\d+\s*\/\s*\d+/.test(s.textContent ?? ''))!;
    fireEvent.touchStart(counter, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(counter, { changedTouches: [{ clientX: 100, clientY: 105 }] });
    expect(screen.getByTestId('active').textContent).toBe('1');
  });
});
