import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { __clearConsentForTests, clearExternalMediaConsent } from '@/lib/consent';
import { __resetAutoplayForTests } from '@/lib/videoAutoplay';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { StorefrontProductStory } from '@/lib/productStories';
import type { ProductContext, SectionRenderProps } from '../../../../types';

// `product-stories` block (customer-stories contract 7): layouts, toggles,
// locale fallback, the shared video player (one at a time, click-to-play),
// empty states and RTL. Rendered inside a real ProductPageStateProvider
// (same harness as productBlocksB3.test.tsx).

const loads = vi.hoisted(() => ({ count: 0 }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/products/mug',
  useParams: () => ({ storeSlug: 'demo' }),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (k: string, vals?: Record<string, unknown>) => (vals ? `${k} ${JSON.stringify(vals)}` : k),
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: vi.fn(() => Promise.resolve()) }) }));
vi.mock('@/components/product/personalization/usePersonalizationApp', () => ({
  usePersonalizationApp: () => ({
    appOn: false,
    appSettings: { validation_summary: false },
    market: null,
    storeSlug: 'demo',
    fields: {
      fields: [],
      values: {},
      onChange: () => undefined,
      validateAll: () => ({ ok: true }),
      buildPayload: () => ({ fields: {}, display: [] }),
      applyServerError: () => null,
      errors: {},
      showAllErrors: false,
      fillable: undefined,
      onFill: undefined,
    },
    advanced: null,
    cardsConfig: undefined,
    priceDelta: 0,
    deltaInCart: false,
  }),
}));
vi.mock('@/components/designer/DesignerSession', () => ({
  useDesignerSession: () => null,
  useDesignerAddonsTotal: () => 0,
  DesignerFormSlot: () => null,
}));
vi.mock('@/components/StoreImage', () => ({
  StoreImage: ({ src, alt, sizes, loading, preload, fetchPriority }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src as string}
      alt={alt as string}
      data-sizes={sizes as string}
      data-loading={(loading as string) ?? ''}
      data-priority={String(Boolean(preload) || fetchPriority === 'high')}
    />
  ),
}));
// next/dynamic -> React.lazy with a load counter: the video slide and the
// player chunk must not be requested before a Play click. Like next/dynamic,
// the loader may resolve to a module or straight to a component.
type Loaded = ComponentType<Record<string, unknown>> | { default: ComponentType<Record<string, unknown>> };
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<Loaded>) => {
    const Lazy = lazy(() => {
      loads.count += 1;
      return loader().then((m) => (typeof m === 'function' ? { default: m } : m));
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
// The shared player chunk, stubbed so the test can see which story plays. A
// file story renders a real <video> so media events (pause / ended) reach React.
vi.mock('@/components/product/video/ProductVideoPlayer', () => ({
  default: ({ item, mode = 'user' }: { item: { id: string; source: { type: string } }; mode?: string }) =>
    item.source.type === 'file' ? (
      <video data-testid="shared-player" data-id={item.id} data-source={item.source.type} data-mode={mode} />
    ) : (
      <div data-testid="shared-player" data-id={item.id} data-source={item.source.type} data-mode={mode} />
    ),
}));

import { ProductPageStateProvider } from '@/components/product/state/ProductPageState';
import { ProductStoriesBlock } from './ProductStoriesBlock.client';
import { productBlocksB3, PRODUCT_STORIES_DEFAULTS } from './registryB3';
import { PRODUCT_BLOCK_KEYS } from './productBlockKeys';
import * as group from './productBlocks.client';
import { minimalTheme } from '../../../theme';

function story(id: string, overrides: Partial<StorefrontProductStory> = {}): StorefrontProductStory {
  return {
    id,
    kind: 'image',
    url: `/uploads/products/${id}.webp`,
    poster_url: null,
    duration_s: null,
    width: 900,
    height: 1600,
    name: `Name ${id}`,
    rating: 4,
    verified: true,
    translations: [
      { locale: 'ar', quote: `اقتباس ${id}`, subtitle: `الرياض ${id}` },
      { locale: 'en', quote: `Quote ${id}\nsecond line`, subtitle: `Stockholm ${id}` },
    ],
    ...overrides,
  };
}

const videoStory = (id: string, overrides: Partial<StorefrontProductStory> = {}) =>
  story(id, {
    kind: 'file',
    url: `/uploads/products/${id}.mp4`,
    poster_url: `/uploads/video-posters/${id}.webp`,
    duration_s: 65,
    ...overrides,
  });

function makeProduct(stories?: StorefrontProductStory[]): ProductData {
  return {
    id: 'p1',
    base_price: 100,
    translations: [
      { locale: 'en', title: 'Mug', slug: 'mug' },
      { locale: 'ar', title: 'كوب', slug: 'mug' },
    ],
    images: [{ id: 'i1', url: 'https://cdn.test/a.jpg' }],
    variants: [],
    ...(stories ? { stories } : {}),
  };
}

function props(overrides: Partial<SectionRenderProps> = {}): SectionRenderProps {
  return {
    settings: { ...PRODUCT_STORIES_DEFAULTS },
    content: {},
    locale: 'en',
    primaryLocale: 'en',
    storeSlug: 'demo',
    product: { id: 'p1' } as unknown as ProductContext,
    builderPreview: false,
    ...overrides,
  };
}

function tree(product: ProductData, ui: ReactNode, locale = 'en') {
  return (
    <ProductPageStateProvider product={product} locale={locale} primaryLocale="en" currency="EUR">
      {ui}
    </ProductPageStateProvider>
  );
}

const withState = (product: ProductData, ui: ReactNode, locale = 'en') => render(tree(product, ui, locale));
const settings = (s: Record<string, unknown>) => ({ ...PRODUCT_STORIES_DEFAULTS, ...s });

afterEach(() => {
  __clearConsentForTests('demo');
  clearExternalMediaConsent('demo');
  __resetAutoplayForTests();
  vi.restoreAllMocks();
});

describe('registration', () => {
  it('is a product block of the grouped chunk, product template only', () => {
    const def = productBlocksB3['product-stories']!;
    expect(def.schema.id).toBe('product-stories');
    expect(def.schema.category).toBe('product');
    expect(def.schema.pageTypes).toEqual(['PRODUCT_TEMPLATE']);
    expect(def.schema.icon).toBe('quote');
    expect(def.schema.translatable).toEqual(['heading', 'subheading']);
    expect(minimalTheme.sections['product-stories']).toBe(def);
    expect(PRODUCT_BLOCK_KEYS.has('product-stories')).toBe(true);
    expect(typeof group.ProductStoriesBlock).toBe('function');
  });

  it('schema keys and defaults equal the contract (7.2); no autoplay setting', () => {
    const def = productBlocksB3['product-stories']!;
    const keys = def.schema.schema.map((f) => f.key);
    expect(keys.sort()).toEqual(Object.keys(PRODUCT_STORIES_DEFAULTS).sort());
    for (const f of def.schema.schema) {
      expect(f.defaultValue, f.key).toEqual(PRODUCT_STORIES_DEFAULTS[f.key as keyof typeof PRODUCT_STORIES_DEFAULTS]);
      expect(f.label.en && f.label.ar, f.key).toBeTruthy();
    }
    expect(def.defaultSettings).toEqual(PRODUCT_STORIES_DEFAULTS);
    expect(keys.some((k) => /autoplay/.test(k))).toBe(false);
  });
});

describe('layouts', () => {
  const stories = [story('a'), story('b'), story('c')];

  it('slider: a scroll-snap row of cards, list markup, default heading', () => {
    const { container } = withState(makeProduct(stories), <ProductStoriesBlock {...props()} />);
    const section = container.querySelector('section[data-product-stories]')!;
    expect(section.getAttribute('data-layout')).toBe('slider');
    const heading = container.querySelector('h2')!;
    expect(heading.textContent).toBe('product.storiesHeading');
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
    const scroller = container.querySelector('[data-stories-scroller]')!;
    // jsdom has no layout: the row does not overflow, so it is no tab stop.
    expect(scroller.hasAttribute('tabindex')).toBe(false);
    expect(scroller.hasAttribute('role')).toBe(false);
    expect(scroller.className).toContain('snap-x');
    const list = scroller.querySelector('ul[role="list"]')!;
    expect(list.querySelectorAll(':scope > li > figure')).toHaveLength(3);
    expect(list.querySelector('li')!.className).toContain('snap-start');
    // Mobile peek: more stories than mobile columns -> the card is narrower than the row.
    expect((scroller as HTMLElement).style.getPropertyValue('--story-basis')).toBe('calc((100% - 1rem) / 1.15)');
    expect((scroller as HTMLElement).style.getPropertyValue('--story-basis-lg')).toBe('calc((100% - 3rem) / 4)');
  });

  it('grid: CSS grid with columns per breakpoint', () => {
    const { container } = withState(
      makeProduct(stories),
      <ProductStoriesBlock {...props({ settings: settings({ layout: 'grid', columns: 5, columns_tablet: 2, columns_mobile: 2 }) })} />,
    );
    const list = container.querySelector('ul[role="list"]')!;
    expect(list.className).toContain('grid-cols-2');
    expect(list.className).toContain('md:grid-cols-2');
    expect(list.className).toContain('lg:grid-cols-5');
    expect(container.querySelector('[data-stories-scroller]')).toBeNull();
    expect(list.querySelectorAll('figure')).toHaveLength(3);
    expect(container.querySelector('img')!.getAttribute('data-sizes')).toBe(
      '(min-width: 1024px) 20vw, (min-width: 768px) 50vw, 50vw',
    );
  });

  it('overlay: text over the media on a gradient, quote clamped, text_position ignored', () => {
    const { container } = withState(
      makeProduct(stories),
      <ProductStoriesBlock {...props({ settings: settings({ layout: 'overlay', text_position: 'below', card_aspect: 'square' }) })} />,
    );
    const fig = container.querySelector('figure')!;
    expect(fig.className).toContain('aspect-square');
    expect(fig.querySelector('.bg-linear-to-t')).not.toBeNull();
    // Square cards clamp the quote shorter than portrait ones (at most 6).
    expect(fig.querySelector('blockquote')!.className).toContain('line-clamp-4');
    expect(fig.querySelector('figcaption')!.className).toContain('relative');
    expect(fig.lastElementChild!.tagName).toBe('FIGCAPTION');
  });

  it('overlay: only the quote shrinks in a tight box; clamp follows the card shape', () => {
    const clampFor = (aspect: string) => {
      const r = withState(
        makeProduct([story('a')]),
        <ProductStoriesBlock {...props({ settings: settings({ layout: 'overlay', card_aspect: aspect }) })} />,
      );
      const fig = r.container.querySelector('figure')!;
      const q = fig.querySelector('blockquote')!.className;
      expect(q).toContain('min-h-0');
      expect(fig.querySelector('[role="img"]')!.parentElement!.className).toContain('shrink-0');
      expect(fig.querySelector('figcaption')!.className).toContain('shrink-0');
      const clamp = q.match(/line-clamp-(\d)/)![1];
      r.unmount();
      return clamp;
    };
    expect(clampFor('portrait')).toBe('6');
    expect(clampFor('square')).toBe('4');
    expect(clampFor('landscape')).toBe('3');
  });

  it('text_position overlay works for the slider; below keeps text under the media', () => {
    const over = withState(makeProduct(stories), <ProductStoriesBlock {...props({ settings: settings({ text_position: 'overlay' }) })} />);
    expect(over.container.querySelector('blockquote')!.className).toContain('line-clamp-6');
    over.unmount();
    const below = withState(makeProduct(stories), <ProductStoriesBlock {...props()} />);
    const q = below.container.querySelector('blockquote')!;
    expect(q.className).not.toContain('line-clamp-6');
    expect(q.className).toContain('whitespace-pre-line');
    expect(below.container.querySelector('figure > div')!.className).toContain('aspect-[9/16]');
  });

  it('card order: stars, quote, then figcaption with name + verified + subtitle', () => {
    const { container } = withState(makeProduct([story('a')]), <ProductStoriesBlock {...props()} />);
    const fig = container.querySelector('figure')!;
    const order = Array.from(fig.children).map((el) =>
      el.querySelector('[role="img"]') ? 'stars' : el.tagName.toLowerCase(),
    );
    expect(order).toEqual(['div', 'stars', 'blockquote', 'figcaption']);
    const cap = fig.querySelector('figcaption')!;
    expect(cap.textContent).toContain('Name a');
    expect(cap.textContent).toContain('Stockholm a');
  });

  it('heading, subheading and their tags come from content / settings; hidden heading labels the section', () => {
    const { container } = withState(
      makeProduct([story('a')]),
      <ProductStoriesBlock
        {...props({
          content: { heading: 'Loved by runners', subheading: 'Real buyers' },
          settings: settings({ heading_level: 'h3', subheading_tag: 'div' }),
        })}
      />,
    );
    expect(container.querySelector('h3')!.textContent).toBe('Loved by runners');
    expect(container.querySelector('h3 + div')!.textContent).toBe('Real buyers');
    const hidden = withState(makeProduct([story('a')]), <ProductStoriesBlock {...props({ settings: settings({ show_heading: false }) })} />);
    expect(hidden.container.querySelector('h2')).toBeNull();
    expect(hidden.container.querySelector('section')!.getAttribute('aria-label')).toBe('product.storiesHeading');
  });
});

describe('toggles', () => {
  it('rating: one labelled image with hidden stars; hidden when off or unrated', () => {
    const { container } = withState(makeProduct([story('a'), story('b', { rating: null })]), <ProductStoriesBlock {...props()} />);
    const ratings = container.querySelectorAll('[role="img"]');
    expect(ratings).toHaveLength(1);
    expect(ratings[0]!.getAttribute('aria-label')).toBe('product.storyRating {"rating":4}');
    expect(ratings[0]!.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(5);
    const off = withState(makeProduct([story('a')]), <ProductStoriesBlock {...props({ settings: settings({ show_rating: false }) })} />);
    expect(off.container.querySelector('[role="img"]')).toBeNull();
  });

  it('verified: hidden icon + screen-reader text + title; off by setting or when not verified', () => {
    const { container } = withState(makeProduct([story('a'), story('b', { verified: false })]), <ProductStoriesBlock {...props()} />);
    const badges = container.querySelectorAll('[data-story-verified]');
    expect(badges).toHaveLength(1);
    expect(badges[0]!.getAttribute('title')).toBe('product.storyVerified');
    expect(badges[0]!.querySelector('.sr-only')!.textContent).toBe('product.storyVerified');
    expect(badges[0]!.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    const off = withState(makeProduct([story('a')]), <ProductStoriesBlock {...props({ settings: settings({ show_verified: false }) })} />);
    expect(off.container.querySelector('[data-story-verified]')).toBeNull();
  });

  it('subtitle: shown by default, hidden when off', () => {
    const on = withState(makeProduct([story('a')]), <ProductStoriesBlock {...props()} />);
    expect(on.container.querySelector('figcaption')!.textContent).toContain('Stockholm a');
    on.unmount();
    const off = withState(makeProduct([story('a')]), <ProductStoriesBlock {...props({ settings: settings({ show_subtitle: false }) })} />);
    expect(off.container.querySelector('figcaption')!.textContent).not.toContain('Stockholm');
  });
});

describe('text safety and locale', () => {
  it('renders HTML-looking texts as plain text', () => {
    const evil = story('x', {
      name: '<img src=x onerror=alert(1)>',
      translations: [{ locale: 'en', quote: '<script>alert(1)</script>', subtitle: '<b>bold</b>' }],
    });
    const { container } = withState(makeProduct([evil]), <ProductStoriesBlock {...props()} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(container.querySelector('blockquote')!.textContent).toBe('<script>alert(1)</script>');
    expect(container.querySelector('figcaption')!.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('visitor locale, then the primary locale, then the first translation', () => {
    const ar = withState(makeProduct([story('a')]), <ProductStoriesBlock {...props({ locale: 'ar' })} />, 'ar');
    expect(ar.container.querySelector('blockquote')!.textContent).toBe('اقتباس a');
    ar.unmount();
    const de = withState(makeProduct([story('a')]), <ProductStoriesBlock {...props({ locale: 'de' })} />, 'de');
    expect(de.container.querySelector('blockquote')!.textContent).toBe('Quote a\nsecond line');
    de.unmount();
    const onlySv = story('s', { translations: [{ locale: 'sv', quote: 'Toppen', subtitle: null }] });
    const fr = withState(makeProduct([onlySv]), <ProductStoriesBlock {...props({ locale: 'fr' })} />, 'fr');
    expect(fr.container.querySelector('blockquote')!.textContent).toBe('Toppen');
  });
});

describe('media', () => {
  it('images and posters are lazy, never priority, with sizes from the columns', () => {
    const html = renderToString(tree(makeProduct([story('a'), videoStory('v')]), <ProductStoriesBlock {...props()} />));
    expect(html).not.toContain('<video');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('data-priority="true"');
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    expect(imgs).toHaveLength(2);
    for (const img of imgs) {
      expect(img).toContain('data-loading="lazy"');
      expect(img).toContain('data-sizes="(min-width: 1024px) 25vw, (min-width: 768px) 34vw, 87vw"');
    }
    expect(loads.count).toBe(0);
  });

  it('video card: poster + named Play + ltr duration; Play mounts the shared player, one at a time', async () => {
    const { container } = withState(makeProduct([videoStory('v1'), videoStory('v2'), story('i')]), <ProductStoriesBlock {...props()} />);
    expect(screen.queryByTestId('shared-player')).toBeNull();
    expect(container.querySelector('video, iframe')).toBeNull();
    const chip = container.querySelector('[data-story-poster] [dir="ltr"]')!;
    expect(chip.textContent).toBe('1:05');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'product.storyPlayNamed {"name":"Name v1"}' }));
    });
    let players = await screen.findAllByTestId('shared-player');
    expect(players).toHaveLength(1);
    expect(players[0]!.getAttribute('data-id')).toBe('v1');
    expect(players[0]!.getAttribute('data-source')).toBe('file');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'product.storyPlayNamed {"name":"Name v2"}' }));
    });
    players = await screen.findAllByTestId('shared-player');
    expect(players).toHaveLength(1);
    expect(players[0]!.getAttribute('data-id')).toBe('v2');
    // The first card is back to its poster with a Play button.
    expect(screen.getByRole('button', { name: 'product.storyPlayNamed {"name":"Name v1"}' })).toBeTruthy();
  });

  it('overlay text hides while the card video is open', async () => {
    const { container } = withState(
      makeProduct([videoStory('v1')]),
      <ProductStoriesBlock {...props({ settings: settings({ layout: 'overlay' }) })} />,
    );
    expect(container.querySelector('blockquote')).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /storyPlayNamed/ }));
    });
    await screen.findByTestId('shared-player');
    expect(container.querySelector('blockquote')).toBeNull();
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('overlay text stays hidden while the player is mounted (also paused); an ended video goes back to its poster', async () => {
    const { container } = withState(
      makeProduct([videoStory('v1')]),
      <ProductStoriesBlock {...props({ settings: settings({ layout: 'overlay' }) })} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /storyPlayNamed/ }));
    });
    const video = await screen.findByTestId('shared-player');
    expect(container.querySelector('figcaption')).toBeNull();

    // QA 2026-11-14 #20: the text no longer returns over a paused video's
    // controls.
    fireEvent.pause(video);
    expect(container.querySelector('figcaption')).toBeNull();
    expect(container.querySelector('.bg-linear-to-t')).toBeNull();
    // The player is still mounted (the visitor can resume).
    expect(screen.getByTestId('shared-player')).toBe(video);

    fireEvent.play(video);
    expect(container.querySelector('figcaption')).toBeNull();

    // Focus was in the card (the player) when it ended: it returns to Play.
    (container.querySelector('[data-story-card] > [tabindex="-1"]') as HTMLElement).focus();
    await act(async () => {
      fireEvent.ended(video);
    });
    expect(screen.queryByTestId('shared-player')).toBeNull();
    expect(container.querySelector('figcaption')!.textContent).toContain('Name v1');
    const play = screen.getByRole('button', { name: /storyPlayNamed/ });
    expect(document.activeElement).toBe(play);
  });

  it('a file story without a poster: neutral tile + its first frame, not a black box (QA #17)', () => {
    const { container } = withState(
      makeProduct([videoStory('v1', { poster_url: null })]),
      <ProductStoriesBlock {...props()} />,
    );
    const poster = container.querySelector('[data-story-poster]')!;
    expect(poster.className).not.toContain('bg-neutral-900');
    expect(poster.className).toContain('from-neutral-200');
    const frame = poster.querySelector('[data-video-first-frame] video')!;
    expect(frame.getAttribute('src')).toMatch(/v1\.mp4#t=0\.1$/);
    expect(frame.getAttribute('preload')).toBe('metadata');
    // Play is still there; the player chunk is not requested.
    expect(screen.getByRole('button', { name: /storyPlayNamed/ })).toBeTruthy();
    expect(screen.queryByTestId('shared-player')).toBeNull();
  });

  it('overlay text on a video card reserves the space of the centred Play button', () => {
    const { container } = withState(
      makeProduct([videoStory('v1'), story('i1')]),
      <ProductStoriesBlock {...props({ settings: settings({ layout: 'overlay' }) })} />,
    );
    const cards = container.querySelectorAll('[data-story-card]');
    const video = Array.from(cards).find((c) => c.getAttribute('data-story-kind') === 'video')!;
    const image = Array.from(cards).find((c) => c.getAttribute('data-story-kind') === 'image')!;
    const spacer = video.querySelector('[data-story-play-space]');
    expect(spacer).not.toBeNull();
    // The spacer sits before the text, so the text stays in the lower half.
    expect(spacer!.compareDocumentPosition(video.querySelector('figcaption')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(image.querySelector('[data-story-play-space]')).toBeNull();
  });

  it('Play keeps keyboard focus in the card while the player loads', async () => {
    const { container } = withState(makeProduct([videoStory('v1')]), <ProductStoriesBlock {...props()} />);
    const play = screen.getByRole('button', { name: /storyPlayNamed/ });
    play.focus();
    await act(async () => {
      fireEvent.click(play);
    });
    const media = container.querySelector('[data-story-card] > [tabindex="-1"]')!;
    expect(document.activeElement).toBe(media);
    expect(media.contains(screen.getByTestId('shared-player'))).toBe(true);
  });

  it('image stories use an empty alt (the figcaption names the person); posters too', () => {
    const { container } = withState(makeProduct([story('a'), videoStory('v')]), <ProductStoriesBlock {...props()} />);
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(2);
    for (const img of imgs) expect(img.getAttribute('alt')).toBe('');
  });

  it('YouTube without the external grant: focus stays in the card; overlay text yields to the facade', async () => {
    const yt = story('y', { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', poster_url: null });
    const { container } = withState(makeProduct([yt]), <ProductStoriesBlock {...props({ settings: settings({ layout: 'overlay' }) })} />);
    const play = screen.getByRole('button', { name: /storyPlayNamed/ });
    play.focus();
    await act(async () => {
      fireEvent.click(play);
    });
    await screen.findByText(/product\.externalVideoNotice/);
    const media = container.querySelector('[data-story-card] > [tabindex="-1"]')!;
    expect(document.activeElement).toBe(media);
    // The notice and its link are the next stops inside the focused card.
    expect(media.querySelector('a[href^="https://www.youtube.com/"]')).not.toBeNull();
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('below text is never hidden by a playing video', async () => {
    const { container } = withState(makeProduct([videoStory('v1')]), <ProductStoriesBlock {...props()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /storyPlayNamed/ }));
    });
    await screen.findByTestId('shared-player');
    expect(container.querySelector('figcaption')!.textContent).toContain('Name v1');
  });

  it('YouTube without the external grant: no player, two-click facade + link out', async () => {
    const yt = story('y', { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', poster_url: null });
    const { container } = withState(makeProduct([yt]), <ProductStoriesBlock {...props()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /storyPlayNamed/ }));
    });
    expect(screen.queryByTestId('shared-player')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).toContain('product.externalVideoNotice');
    expect(screen.getByRole('button', { name: 'product.externalVideoPlay' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'product.externalVideoAlwaysAllow' })).toBeTruthy();
    const link = container.querySelector('a[href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"]')!;
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
  });
});

describe('empty states', () => {
  it('live: renders nothing without stories (no heading, no wrapper)', () => {
    const none = withState(makeProduct(), <ProductStoriesBlock {...props()} />);
    expect(none.container.innerHTML).toBe('');
    none.unmount();
    const invalid = withState(makeProduct([story('b', { kind: 'youtube', url: 'https://evil.com/x' })]), <ProductStoriesBlock {...props()} />);
    expect(invalid.container.innerHTML).toBe('');
  });

  it('builder: placeholder with the hint', () => {
    withState(makeProduct(), <ProductStoriesBlock {...props({ builderPreview: true })} />);
    expect(screen.getByText('This product has no customer stories.')).toBeTruthy();
  });

  it('builder in Arabic: Arabic hint; without product state: label only', () => {
    withState(makeProduct([]), <ProductStoriesBlock {...props({ builderPreview: true, locale: 'ar' })} />, 'ar');
    expect(screen.getByText('لا توجد قصص عملاء لهذا المنتج.')).toBeTruthy();
    const { container } = render(<ProductStoriesBlock {...props({ builderPreview: true, product: undefined })} />);
    expect(container.querySelector('[data-product-block-placeholder]')!.textContent).toBe('Customer stories');
  });
});

describe('slider navigation and RTL', () => {
  function mockOverflow() {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(2000);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    const scrollBy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', { value: scrollBy, configurable: true, writable: true });
    return scrollBy;
  }

  it('no arrows when everything fits', () => {
    const { container } = withState(makeProduct([story('a')]), <ProductStoriesBlock {...props()} />);
    expect(container.querySelector('[data-stories-nav]')).toBeNull();
  });

  it('no layout shift: arrows are server-rendered where the row overflows, the row reserves no space where it fits', () => {
    const five = [story('a'), story('b'), story('c'), story('d'), story('e')];
    const html = renderToString(tree(makeProduct(five), <ProductStoriesBlock {...props()} />));
    expect(html).toContain('data-stories-nav');
    expect(html).toContain('product.storiesPrevious');
    expect(html).toContain('product.storiesNext');

    // Hidden heading + 4 stories: overflow on tablet (3 cols) but not desktop (4).
    const four = renderToString(
      tree(makeProduct(five.slice(0, 4)), <ProductStoriesBlock {...props({ settings: settings({ show_heading: false }) })} />),
    );
    const doc = new DOMParser().parseFromString(four, 'text/html');
    const nav = doc.querySelector('[data-stories-nav]')!;
    expect(nav.className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'md:flex', 'lg:hidden']));
    // Without a heading the row follows the arrows (no empty row on mobile).
    expect(nav.parentElement!.className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'md:flex', 'lg:hidden']));

    // Hidden heading and everything fits: no row at all.
    const two = renderToString(
      tree(makeProduct(five.slice(0, 2)), <ProductStoriesBlock {...props({ settings: settings({ show_heading: false }) })} />),
    );
    expect(two).not.toContain('data-stories-nav');
    expect(two).not.toContain('mb-4');
  });

  it('the scroller is a named focusable region only when it overflows', () => {
    mockOverflow();
    const { container } = withState(makeProduct([story('a'), story('b'), story('c'), story('d'), story('e')]), <ProductStoriesBlock {...props()} />);
    const scroller = container.querySelector('[data-stories-scroller]')!;
    expect(scroller.getAttribute('tabindex')).toBe('0');
    expect(scroller.getAttribute('role')).toBe('region');
    expect(scroller.getAttribute('aria-labelledby')).toBe(container.querySelector('h2')!.id);
  });

  it('arrows appear on overflow (desktop only), previous disabled at the start, next scrolls forward', () => {
    const scrollBy = mockOverflow();
    const { container } = withState(makeProduct([story('a'), story('b'), story('c'), story('d'), story('e')]), <ProductStoriesBlock {...props()} />);
    const nav = container.querySelector('[data-stories-nav]')!;
    expect(nav.className).toContain('hidden');
    expect(nav.className).toContain('md:flex');
    const prev = screen.getByRole('button', { name: 'product.storiesPrevious' }) as HTMLButtonElement;
    const next = screen.getByRole('button', { name: 'product.storiesNext' }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(scrollBy).toHaveBeenCalledWith({ left: 900, behavior: 'smooth' });
  });

  it('RTL: Arabic texts, mirrored chevrons, next scrolls towards the left', () => {
    const scrollBy = mockOverflow();
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      const style = real(el);
      return el instanceof HTMLElement && el.hasAttribute('data-stories-scroller')
        ? ({ ...style, direction: 'rtl' } as CSSStyleDeclaration)
        : style;
    });
    const { container } = render(
      <div dir="rtl">
        {tree(makeProduct([story('a'), story('b'), story('c'), story('d'), story('e')]), <ProductStoriesBlock {...props({ locale: 'ar' })} />, 'ar')}
      </div>,
    );
    expect(container.querySelector('blockquote')!.textContent).toBe('اقتباس a');
    for (const svg of container.querySelectorAll('[data-stories-nav] svg')) {
      expect(svg.getAttribute('class')).toContain('rtl:-scale-x-100');
    }
    fireEvent.click(screen.getByRole('button', { name: 'product.storiesNext' }));
    expect(scrollBy).toHaveBeenCalledWith({ left: -900, behavior: 'smooth' });
    // Logical classes only (no physical left/right) in the block markup.
    expect(container.innerHTML).not.toMatch(/\b(?:ml|mr|pl|pr|left|right)-\d/);
  });
});

describe('muted autoplay of story videos (CONTRACT-AUTOPLAY 6.7)', () => {
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
  function showAll() {
    act(() => {
      ioCallback?.(observed.map((target) => ({ target, isIntersecting: true, intersectionRatio: 1 })));
    });
  }
  function useIO() {
    __resetAutoplayForTests();
    ioCallback = null;
    observed.length = 0;
    vi.stubGlobal('IntersectionObserver', FakeIO);
  }

  it('an autoplay=false card renders exactly the pre-autoplay markup; SSR is identical with autoplay', () => {
    const product = (extra: Partial<StorefrontProductStory>) =>
      makeProduct([videoStory('v1', extra), story('i')]);
    const base = renderToString(tree(makeProduct([videoStory('v1'), story('i')]), <ProductStoriesBlock {...props()} />));
    const off = renderToString(tree(product({ autoplay: false, loop: false }), <ProductStoriesBlock {...props()} />));
    const on = renderToString(tree(product({ autoplay: true, loop: true }), <ProductStoriesBlock {...props()} />));
    expect(off).toBe(base);
    expect(on).toBe(base);
    expect(on).not.toContain('<video');
  });

  it('autoplay=false cards never register for autoplay after hydration', () => {
    useIO();
    const { container } = withState(makeProduct([videoStory('v1')]), <ProductStoriesBlock {...props()} />);
    expect(observed).toHaveLength(0);
    expect(container.querySelector('[data-video-autoplay]')).toBeNull();
  });

  it('a visible autoplay card plays muted; the overlay text stays; a tap opens the player and hides it', async () => {
    useIO();
    const { container } = withState(
      makeProduct([videoStory('v1', { autoplay: true })]),
      <ProductStoriesBlock {...props({ settings: settings({ layout: 'overlay' }) })} />,
    );
    await screen.findByRole('button', { name: /playVideoNamed/ });
    showAll();
    const auto = await screen.findByTestId('shared-player');
    expect(auto.getAttribute('data-mode')).toBe('autoplay');
    expect(container.querySelector('figcaption')!.textContent).toContain('Name v1');
    expect(screen.getByRole('button', { name: 'product.videoPause' })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /playVideoNamed/ }));
    });
    const player = await screen.findByTestId('shared-player');
    expect(player.getAttribute('data-mode')).toBe('user');
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('autoplay story layers keep every poster lazy (no eager download of off-screen cards)', async () => {
    useIO();
    const { container } = withState(
      makeProduct([videoStory('v1', { autoplay: true }), videoStory('v2', { autoplay: true })]),
      <ProductStoriesBlock {...props()} />,
    );
    await screen.findAllByRole('button', { name: /playVideoNamed/ });
    const posters = Array.from(container.querySelectorAll('img')).filter((img) =>
      img.getAttribute('src')!.includes('/uploads/video-posters/'),
    );
    // StoryVideoPoster + the autoplay slide's own poster for each card.
    expect(posters).toHaveLength(4);
    for (const img of posters) expect(img.getAttribute('data-loading')).toBe('lazy');
  });

  it('a YouTube autoplay story without the external grant keeps the click-to-play card', () => {
    useIO();
    const yt = story('y', {
      kind: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      poster_url: '/uploads/video-posters/y.webp',
      autoplay: true,
    });
    const { container } = withState(makeProduct([yt]), <ProductStoriesBlock {...props()} />);
    expect(observed).toHaveLength(0);
    expect(container.querySelector('[data-video-autoplay]')).toBeNull();
    expect(screen.getByRole('button', { name: /storyPlayNamed/ })).toBeTruthy();
  });
});
