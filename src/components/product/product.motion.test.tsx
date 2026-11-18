import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductContext, SectionDefinition, SectionInstance, SectionRenderProps, Theme } from '@/themes/types';

// Store motion style on the product page (builder S5). Without the section's
// `motion` prop every product part renders exactly today's markup; with it
// the parts only gain data attributes (and one inline box inside the "added"
// label), the title, the price and the buy button never get an entrance, and
// the feedback motion follows state the page already has.

const addItem = vi.fn(() => Promise.resolve());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/en/products/x',
  useParams: () => ({ storeSlug: 'demo' }),
  useSearchParams: () => new URLSearchParams(),
  useSelectedLayoutSegment: () => null,
}));
vi.mock('next-intl', () => {
  const t = Object.assign(
    (k: string, values?: Record<string, unknown>) => (values ? `${k}:${JSON.stringify(values)}` : k),
    { rich: (k: string) => k, markup: (k: string) => k, raw: (k: string) => k, has: () => true },
  );
  return { useLocale: () => 'en', useTranslations: () => t };
});
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem }) }));
// Keeps what the gallery adds for the cross-fade: the load handler and the hook attribute.
vi.mock('@/components/StoreImage', () => ({
  StoreImage: (props: { src: string; alt: string; onLoad?: () => void; 'data-cx-pd'?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} onLoad={props.onLoad} data-cx-pd={props['data-cx-pd']} />
  ),
}));

import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import { ProductLightbox } from '@/components/product/ProductLightbox';
import { ProductPageStateProvider } from '@/components/product/state/ProductPageState';
import { ProductMotionScope } from '@/components/product/productMotion';
import { ProductPageMagic } from '@/themes/minimal/sections/product/ProductPageMagic.client';
import * as blocks from '@/themes/minimal/sections/product/blocks/productBlocks.client';
import { ProductFaqBlock as RawFaqBlock } from '@/themes/minimal/sections/product/blocks/ProductFaqBlock.client';
import { SectionRenderer } from '@/themes/SectionRenderer';
import { minimalTheme } from '@/themes/minimal/theme';
import { G, G_RTL } from '@/themes/creative/css/base.css';
import { PRODUCT_CSS } from '@/themes/creative/css/product.css';
import type { MotionProp } from '@/themes/creative/recipes';

const PRODUCT: ProductData = {
  id: 'p1',
  base_price: 100,
  translations: [{ locale: 'en', title: 'Mug', slug: 'mug', description: '<p>Stoneware mug.</p>' }],
  images: [
    { id: 'i1', url: '/uploads/a.jpg', alt: 'Front' },
    { id: 'i2', url: '/uploads/b.jpg', alt: 'Back' },
    { id: 'i3', url: '/uploads/c.jpg', alt: 'Side' },
  ],
  variants: [
    { id: 'v1', price: 100, stock: 5, options: { Size: 'S' } },
    { id: 'v2', price: 100, stock: 5, options: { Size: 'M' } },
  ],
  faqs: [
    { id: 'f1', sort_order: 0, translations: [{ locale: 'en', question: 'Dishwasher safe?', answer: '<p>Yes.</p>' }] },
    { id: 'f2', sort_order: 1, translations: [{ locale: 'en', question: 'Where is it made?', answer: '<p>Here.</p>' }] },
  ],
};

const SIMPLE: ProductData = { ...PRODUCT, variants: [], track_inventory: false };

function Monolith({ motion, product = PRODUCT }: { motion?: MotionProp; product?: ProductData }) {
  return (
    <ProductDetailClient
      product={product}
      locale="en"
      primaryLocale="en"
      currency="EUR"
      options={{ trustBadges: [{ label: 'Free returns' }], showShipping: true, showTabs: true }}
      motion={motion}
    />
  );
}

function blockProps(motion?: MotionProp, settings: Record<string, unknown> = {}): SectionRenderProps {
  return {
    settings,
    content: {},
    locale: 'en',
    primaryLocale: 'en',
    storeSlug: 'demo',
    product: PRODUCT as unknown as ProductContext,
    currency: 'EUR',
    ...(motion ? { motion } : null),
  };
}

function Block({ name, motion, product = PRODUCT }: { name: keyof typeof blocks; motion?: MotionProp; product?: ProductData }) {
  const Component = blocks[name] as React.ComponentType<SectionRenderProps>;
  return (
    <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="EUR">
      <Component {...blockProps(motion)} product={product as unknown as ProductContext} />
    </ProductPageStateProvider>
  );
}

/** Removes every motion attribute, leaving the markup a store without the switch gets. */
const stripMotion = (html: string) => html.replace(/ data-cx-[a-z-]+="[^"]*"/g, '');
const text = (html: string) => html.replace(/<[^>]+>/g, '');
/** Path of an image (the media origin is resolved by the page state). */
const srcPath = (img: Element) => (img.getAttribute('src') || '').replace(/^https?:\/\/[^/]+/, '');

vi.setConfig({ testTimeout: 60_000 });

beforeAll(() => {
  // jsdom has no scrollIntoView (the gallery keeps its active thumbnail in view).
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  addItem.mockClear();
  vi.useRealTimers();
});

describe('product page without the motion style', () => {
  it('the monolith carries no motion attribute', () => {
    const html = renderToStaticMarkup(<Monolith />);
    expect(html).not.toContain('data-cx-');
    expect(html).toBe(renderToStaticMarkup(<Monolith motion={undefined} />));
  });

  it('the blocks carry no motion attribute', () => {
    for (const name of ['ProductBuyBlock', 'ProductVariantsBlock', 'ProductFaqBlock', 'ProductTabsMagic', 'ProductDescriptionBlock', 'ProductGalleryMagic', 'AddToCartMagic'] as const) {
      expect(renderToStaticMarkup(<Block name={name} />), name).not.toContain('data-cx-');
    }
  });

  it('a block wrapped for motion renders the same markup as the block itself', () => {
    const wrapped = renderToStaticMarkup(<Block name="ProductFaqBlock" />);
    const raw = renderToStaticMarkup(
      <ProductPageStateProvider product={PRODUCT} locale="en" primaryLocale="en" currency="EUR">
        <RawFaqBlock {...blockProps()} />
      </ProductPageStateProvider>,
    );
    expect(wrapped).toBe(raw);
  });
});

describe('product page with the motion style', () => {
  for (const phase of ['scroll', 'intro'] as const) {
    it(`${phase}: only attributes are added, text and structure stay`, () => {
      const plain = renderToStaticMarkup(<Monolith />);
      const moved = renderToStaticMarkup(<Monolith motion={phase} />);
      expect(stripMotion(moved)).toBe(plain);
      expect(text(moved)).toBe(text(plain));
    });

    it(`${phase}: commerce comes first`, () => {
      const { container, unmount } = render(<Monolith motion={phase} />);
      // The product page never uses the page-intro kind (it would hide content on load).
      expect(container.querySelector('[data-cx-intro]')).toBeNull();
      const h1 = container.querySelector('h1')!;
      const buy = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('common.addToCart'))!;
      const price = h1.nextElementSibling!;
      for (const el of [h1, price, buy]) {
        expect(el.closest('[data-cx-reveal]')).toBeNull();
        expect(el.closest('[data-cx-magnetic]')).toBeNull();
      }
      expect(container.querySelector('[data-cx-magnetic]')).toBeNull();
      // Buy button: press response only.
      expect(buy.getAttribute('data-cx-hover')).toBe('press');
      expect(buy.getAttribute('data-cx-pd')).toBe('buy');
      // Variant chips and quantity steps: press response.
      const chips = container.querySelectorAll('[data-variant-option] button');
      expect(chips.length).toBe(2);
      chips.forEach((c) => expect(c.getAttribute('data-cx-pd')).toBe('chip'));
      expect(container.querySelectorAll('[data-cx-pd="step"][data-cx-hover="press"]').length).toBe(2);
      // Thumbnails: a stagger group with one item per image.
      const strip = container.querySelector('[data-cx-pd="thumbs"]')!;
      expect(strip.getAttribute('data-cx-reveal')).toBe('stagger');
      expect(strip.querySelectorAll('[data-cx-item]').length).toBe(3);
      // The main image has no entrance (LCP).
      const main = container.querySelector('.cursor-crosshair > img')!;
      expect(main.getAttribute('data-cx-pd')).toBeNull();
      expect(main.closest('[data-cx-reveal]')).toBeNull();
      // Blocks below the buy box rise when they scroll into view.
      const rises = Array.from(container.querySelectorAll('[data-cx-reveal="rise"]'));
      expect(rises.length).toBe(2); // trust badges, tabs (no shipping profile here)
      expect(rises.some((el) => el.textContent?.includes('Free returns'))).toBe(true);
      expect(rises.some((el) => el.textContent?.includes('Stoneware mug.'))).toBe(true);
      unmount();
    });
  }

  it('tabs: the tab shown on load does not animate, a picked one does', () => {
    const { container, unmount } = render(<Monolith motion="scroll" />);
    expect(container.querySelector('[data-cx-pd="panel"]')).toBeNull();
    expect(container.querySelector('[data-cx-pd="tab-line"]')).toBeNull();
    const faqTab = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('product.faq'))!;
    fireEvent.click(faqTab);
    const panel = container.querySelector('[data-cx-pd="panel"]')!;
    expect(panel.textContent).toContain('Dishwasher safe?');
    expect(faqTab.querySelector('[data-cx-pd="tab-line"]')).not.toBeNull();
    expect(panel.querySelector('[data-cx-pd="details"] details')).not.toBeNull();
    unmount();
  });

  it('gallery: the image cross-fades when it changes, the first one is left alone', () => {
    vi.useFakeTimers();
    const { container, unmount } = render(<Monolith motion="scroll" />);
    const frame = () => Array.from(container.querySelectorAll<HTMLImageElement>('.cursor-crosshair > img'));
    expect(frame().length).toBe(1);
    const thumbs = container.querySelectorAll<HTMLButtonElement>('[data-cx-pd="thumbs"] > button');
    fireEvent.click(thumbs[1]);
    // Outgoing image underneath (decorative), incoming one waits for its load.
    expect(frame().map((img) => `${srcPath(img)}|${img.getAttribute('data-cx-pd')}`)).toEqual([
      '/uploads/a.jpg|null',
      '/uploads/b.jpg|wait',
    ]);
    expect(frame()[0].getAttribute('alt')).toBe('');
    fireEvent.load(frame()[1]);
    expect(frame()[1].getAttribute('data-cx-pd')).toBe('in');
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(frame().map((img) => `${srcPath(img)}|${img.getAttribute('data-cx-pd')}`)).toEqual(['/uploads/b.jpg|null']);
    // An image that never loads does not keep the outgoing one.
    fireEvent.click(thumbs[2]);
    expect(frame().length).toBe(2);
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(frame().map(srcPath)).toEqual(['/uploads/c.jpg']);
    unmount();
  });

  it('gallery without the motion style: one image, no hook', () => {
    const { container, unmount } = render(<Monolith />);
    const thumbs = container.querySelectorAll<HTMLButtonElement>('.scroll-smooth > button');
    fireEvent.click(thumbs[1]);
    const imgs = container.querySelectorAll('.cursor-crosshair > img');
    expect(imgs.length).toBe(1);
    expect(srcPath(imgs[0])).toBe('/uploads/b.jpg');
    expect(container.innerHTML).not.toContain('data-cx-');
    unmount();
  });

  it('add to cart: the "added" label is one box that fades in, only with the motion style', async () => {
    for (const motion of ['scroll', undefined] as const) {
      const { container, unmount } = render(<Monolith motion={motion} product={SIMPLE} />);
      // Past the hydration guard (the button is natively disabled until then).
      await act(async () => {});
      const buy = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('common.addToCart'))!;
      expect(buy.disabled).toBe(false);
      await act(async () => {
        fireEvent.click(buy);
      });
      // The request is sent at once: the feedback never waits for motion.
      expect(addItem).toHaveBeenCalledTimes(1);
      expect(buy.textContent).toContain('cart.itemAdded');
      const added = buy.querySelector('[data-cx-pd="added"]');
      if (motion) {
        expect(added).not.toBeNull();
        expect(added!.querySelector('svg')).not.toBeNull();
        expect(added!.textContent).toBe('cart.itemAdded');
      } else {
        expect(added).toBeNull();
        expect(container.innerHTML).not.toContain('data-cx-');
      }
      addItem.mockClear();
      unmount();
    }
  });

  it('lightbox: the viewer is marked only inside a motion scope', () => {
    const items = [{ kind: 'image' as const, id: 'i1', url: '/uploads/a.jpg', alt: 'Front' }];
    const view = (motion?: MotionProp) =>
      render(
        <ProductMotionScope motion={motion}>
          <ProductLightbox items={items} index={0} onIndexChange={() => {}} onClose={() => {}} />
        </ProductMotionScope>,
      );
    const on = view('scroll');
    expect(document.querySelector('[role="dialog"]')!.getAttribute('data-cx-pd')).toBe('lightbox');
    on.unmount();
    const off = view();
    expect(document.querySelector('[role="dialog"]')!.hasAttribute('data-cx-pd')).toBe(false);
    off.unmount();
  });
});

describe('product blocks with the motion style', () => {
  it('buy block: press on the button and the steps, nothing else', () => {
    const { container, unmount } = render(<Block name="ProductBuyBlock" motion="scroll" product={SIMPLE} />);
    expect(container.querySelector('[data-cx-reveal],[data-cx-intro],[data-cx-magnetic]')).toBeNull();
    expect(container.querySelectorAll('[data-cx-pd="buy"][data-cx-hover="press"]').length).toBe(1);
    expect(container.querySelectorAll('[data-cx-pd="step"]').length).toBe(2);
    unmount();
  });

  it('title, price and variants blocks get no entrance', () => {
    for (const name of ['ProductTitleBlock', 'ProductPriceBlock', 'ProductVariantsBlock'] as const) {
      const html = renderToStaticMarkup(<Block name={name} motion="intro" />);
      expect(html, name).not.toContain('data-cx-reveal');
      expect(html, name).not.toContain('data-cx-intro');
    }
    expect(renderToStaticMarkup(<Block name="ProductVariantsBlock" motion="scroll" />)).toContain('data-cx-pd="chip"');
  });

  it('description, FAQ and tabs blocks rise; the FAQ accordion is marked', () => {
    for (const name of ['ProductDescriptionBlock', 'ProductFaqBlock', 'ProductTabsMagic'] as const) {
      for (const phase of ['scroll', 'intro'] as const) {
        const plain = renderToStaticMarkup(<Block name={name} />);
        const moved = renderToStaticMarkup(<Block name={name} motion={phase} />);
        expect(moved, name).toMatch(/^<div[^>]*data-cx-reveal="rise"/);
        expect(moved, name).not.toContain('data-cx-intro');
        expect(stripMotion(moved), name).toBe(plain);
      }
    }
    expect(renderToStaticMarkup(<Block name="ProductFaqBlock" motion="scroll" />)).toMatch(/^<div[^>]*data-cx-pd="acc"/);
  });

  it('tabs block: only a picked tab animates', () => {
    const { container, unmount } = render(<Block name="ProductTabsMagic" motion="scroll" />);
    expect(container.querySelector('[data-cx-pd="panel"]')).toBeNull();
    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    fireEvent.click(tabs[tabs.length - 1]);
    expect(container.querySelector('[role="tabpanel"]')!.getAttribute('data-cx-pd')).toBe('panel');
    expect(container.querySelector('[role="tab"][aria-selected="true"] [data-cx-pd="tab-line"]')).not.toBeNull();
    unmount();
  });

  it('gallery block: thumbnails are a stagger group', () => {
    const { container, unmount } = render(<Block name="ProductGalleryMagic" motion="scroll" />);
    const group = container.querySelector('[data-cx-reveal="stagger"]')!;
    expect(group.querySelectorAll('[data-cx-item]').length).toBe(3);
    unmount();
  });
});

describe('section override', () => {
  const def: SectionDefinition = {
    schema: { id: 'product-page', label: { en: 'Product', ar: 'Product' }, schema: [], translatable: [] } as never,
    Component: ProductPageMagic,
    defaultSettings: {},
    defaultContent: {},
  };
  const theme: Theme = { ...minimalTheme, sections: { ...minimalTheme.sections, 'product-page': def } };
  const page = (settings: Record<string, unknown>): SectionInstance[] => [
    { id: 's1', section_key: 'product-page', settings, sort_order: 0, translations: [{ locale: 'en', content: {} }] },
  ];
  const html = (settings: Record<string, unknown>, motion: boolean) =>
    renderToStaticMarkup(
      <SectionRenderer
        theme={theme}
        sections={page(settings)}
        locale="en"
        primaryLocale="en"
        storeSlug="demo"
        motion={motion}
        product={PRODUCT as unknown as ProductContext}
        currency="EUR"
      />,
    );

  it('the product-page section is a fast surface with the product recipes', () => {
    const out = html({}, true);
    expect(out).toMatch(/data-cx-section="product-page"[^>]*data-cx-tier="fast"/);
    expect(out).toContain('data-cx-pd="buy"');
    expect(out).not.toContain('data-cx-intro');
  });

  it('_style.motion = "none" switches the section off, like a store without the switch', () => {
    const none = html({ _style: { motion: 'none' } }, true);
    expect(none).not.toContain('data-cx-');
    expect(text(none)).toBe(text(html({}, true)));
    expect(html({}, false)).not.toContain('data-cx-');
  });
});

describe('product stylesheet', () => {
  it('every rule sits behind the motion gate', () => {
    // Split into top-level rules (the at-rules here contain one block each).
    const rules = PRODUCT_CSS.match(/@(?:keyframes|starting-style)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}|[^{}]+\{[^{}]*\}/g) || [];
    expect(rules.length).toBeGreaterThan(15);
    const lightboxGate = 'html[data-cx-motion]:has(.store-root:not([data-motion-reveal="off"]):not([data-cx-builder]))';
    for (const rule of rules) {
      if (rule.startsWith('@keyframes')) continue;
      const body = rule.startsWith('@starting-style') ? rule.slice(rule.indexOf('{') + 1) : rule;
      expect(body.startsWith(G) || body.startsWith(G_RTL) || body.startsWith(lightboxGate), rule.slice(0, 80)).toBe(true);
    }
  });

  it('hides nothing but the incoming gallery image and closed accordion panels', () => {
    const hiding = (PRODUCT_CSS.match(/[^{}]+\{[^{}]*opacity:0[^{}]*\}/g) || []).map((r) => r.slice(0, r.indexOf('{')));
    for (const selector of hiding) {
      expect(selector).toMatch(/data-cx-pd="(wait|details|acc)"|^from$/);
    }
    expect(PRODUCT_CSS).not.toContain('clip-path');
    expect(PRODUCT_CSS).not.toMatch(/data-cx-pd="buy"[^{]*\{[^}]*opacity:0/);
  });
});
