import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProductContext, SectionRenderProps } from '../../types';

// Image sizing (`image_size`, plans/image-sizing/SPEC.md) in the single-image
// section and the layout-columns image block.
//
// The "legacy" snapshots were recorded BEFORE SingleImage.tsx / LayoutColumns.tsx
// were wired to the helper: saved sections without `image_size` must keep
// rendering byte-identical markup (live stores depend on it).

let leadImage: { url: string; alt: string } | null = null;
vi.mock('@/components/product/state/ProductPageState', () => ({
  useOptionalProductPageState: () => (leadImage ? { galleryImages: [{ id: 'lead', ...leadImage }] } : null),
}));
// next/dynamic does not resolve in renderToStaticMarkup: use the island itself.
vi.mock('./_shared/lazyDynamic', async () => import('./_shared/DynamicProductImage.client'));

import { singleImageSection } from './SingleImage';
import { layoutColumnsSection } from './LayoutColumns';

const SingleImage = singleImageSection.Component;
const LayoutColumns = layoutColumnsSection.Component;

const PRODUCT: ProductContext = {
  id: 'p1',
  base_price: 100,
  translations: [{ locale: 'sv', title: 'Mugg' }],
  images: [{ url: '/uploads/products/one.jpg', alt_text: 'Framsida' }],
};

function single(
  settings: Record<string, unknown>,
  extra: Partial<SectionRenderProps> = {},
  content: Record<string, unknown> = { alt: 'Bild' },
) {
  return renderToStaticMarkup(
    <SingleImage locale="sv" primaryLocale="sv" storeSlug="namez-se" settings={settings} content={content} {...extra} />,
  );
}

function columns(blocks: Record<string, unknown>[]) {
  return renderToStaticMarkup(
    <LayoutColumns
      settings={{}}
      content={{ cells: [{ col_span: 1, blocks }] }}
      locale="sv"
      primaryLocale="sv"
      storeSlug="namez-se"
    />,
  );
}

// ── Legacy output (no image_size) ─────────────────────────────────────

const SINGLE_LEGACY: Array<[string, Record<string, unknown>, Partial<SectionRenderProps>?]> = [
  ['defaults with an image', { ...singleImageSection.defaultSettings, image: '/uploads/pages/a.jpg' }],
  ['nothing set', {}],
  ['square cover, not rounded, link', { image: '/uploads/pages/a.jpg', aspect: 'square', rounded: false, link_url: '/products' }],
  ['portrait contain', { image: '/uploads/pages/a.jpg', aspect: 'portrait', fit: 'contain' }],
  ['landscape', { image: 'https://cdn.example.com/b.jpg', aspect: 'landscape' }],
  ['wide svg', { image: '/uploads/pages/logo.svg', aspect: 'wide' }],
  ['unknown aspect falls back to auto', { image: '/uploads/pages/a.jpg', aspect: 'bogus' }],
  ['builder placeholder', { aspect: 'square' }, { builderPreview: true }],
  ['product image source', { image_source: 'product_featured', aspect: 'square' }, { product: PRODUCT }],
  ['product image source, auto', { image_source: 'product_featured' }, { product: PRODUCT }],
  ['product image n, link', { image_source: 'product_image_n', image_index: 1, link_url: '/x' }, { product: PRODUCT }],
  ['variant image source', { image_source: 'variant_image', aspect: 'portrait' }, { product: PRODUCT }],
  ['variant image source, auto', { image_source: 'variant_image' }, { product: PRODUCT }],
  ['dynamic source hint in builder', { image_source: 'product_featured', aspect: 'wide' }, { builderPreview: true }],
  ['empty image_size object stays legacy', { image: '/uploads/pages/a.jpg', aspect: 'square', image_size: {} }],
  ['image_size with only empty values stays legacy', {
    image: '/uploads/pages/a.jpg', image_size: { width_mode: { desktop: '' }, fit: '' },
  }],
];

const COLUMNS_LEGACY: Array<[string, Record<string, unknown>]> = [
  ['image, column width', { type: 'image', image: '/uploads/pages/a.jpg', alt: 'A' }],
  ['image with width_px and link', { type: 'image', image: '/uploads/pages/logo.webp', alt: 'namez', width_px: 200, link: '/' }],
  ['image with width_px and external link', { type: 'image', image: '/uploads/pages/logo.webp', width_px: 120, link: 'https://x.se' }],
  ['image square, rounded', { type: 'image', image: '/uploads/pages/a.jpg', aspect: 'square', rounded: true }],
  ['image wide with width_px', { type: 'image', image: '/uploads/pages/a.jpg', aspect: 'wide', width_px: 300 }],
  ['image portrait svg with link', { type: 'image', image: '/uploads/pages/a.svg', aspect: 'portrait', link: '/om-oss' }],
  ['image without a source', { type: 'image', image: '' }],
  ['empty image_size stays legacy', { type: 'image', image: '/uploads/pages/logo.webp', width_px: 200, image_size: {} }],
];

describe('single-image legacy output (byte-identical)', () => {
  for (const [name, settings, extra] of SINGLE_LEGACY) {
    it(name, () => {
      leadImage = null;
      expect(single(settings, extra)).toMatchSnapshot();
    });
  }
});

describe('layout-columns image block legacy output (byte-identical)', () => {
  for (const [name, block] of COLUMNS_LEGACY) {
    it(name, () => {
      expect(columns([block])).toMatchSnapshot();
    });
  }
});

// ── image_size path ───────────────────────────────────────────────────

function parse(html: string) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const frame = Array.from(doc.querySelectorAll<HTMLElement>('[class^="isz-"]')).find((e) => !e.className.endsWith('-img')) || null;
  const scope = frame?.className || '';
  // The section may emit its own stylesheet too (layout-columns grid).
  const css = Array.from(doc.querySelectorAll('style')).map((s) => s.textContent || '').find((t) => scope && t.includes(`.${scope}{`)) || '';
  const img = scope ? (doc.querySelector(`.${scope}-img`) as HTMLImageElement | null) : null;
  return { doc, css, frame, scope, img };
}

/** The CSS with the generated scope replaced by a stable name. */
function stableCss(css: string, scope: string) {
  return css.split(scope).join('S');
}

describe('single-image with image_size', () => {
  it('px width per breakpoint: scoped CSS, sizes and explicit next/image dimensions', () => {
    const out = parse(
      single({
        image: '/uploads/pages/a.jpg',
        aspect: 'square', // legacy key is ignored on the new path
        image_size: { width_mode: 'px', width_px: { desktop: 600, mobile: 300 }, align: { desktop: 'center' } },
      }),
    );
    expect(out.scope).toMatch(/^isz-[a-zA-Z0-9_-]+$/);
    expect(stableCss(out.css, out.scope)).toBe(
      '.S{position:relative;width:600px;max-width:100%;margin-inline-start:auto;margin-inline-end:auto}' +
        '.S-img{display:block;max-width:100%;width:100%;height:auto;aspect-ratio:auto 1200/1200;object-fit:fill;object-position:center}' +
        '@media (max-width: 767px){.S{width:300px}}',
    );
    // Desktop slot is 50vw (512px at 1024px), so 600px is capped by the column.
    expect(out.img?.getAttribute('sizes')).toBe('(max-width: 767px) 300px, (max-width: 1023px) 600px, min(600px, 50vw)');
    expect(out.img?.getAttribute('width')).toBe('1200');
    expect(out.img?.getAttribute('height')).toBe('1200');
    expect(out.img?.getAttribute('data-nimg')).toBe('1'); // intrinsic, never fill
    expect(out.img?.getAttribute('srcset')).toContain('/_next/image');
    expect(out.frame?.getAttribute('style')).toBe('border-radius:var(--theme-radius-lg);overflow:hidden');
    expect(out.doc.querySelector('.aspect-square')).toBeNull();
  });

  it('percent width follows the 50vw / 100vw container slots', () => {
    const out = parse(single({ image: '/uploads/pages/a.jpg', image_size: { width_mode: 'percent', width_percent: 50 } }));
    expect(out.img?.getAttribute('sizes')).toBe('(max-width: 1023px) 50vw, 25vw');
    expect(stableCss(out.css, out.scope)).toContain('.S{position:relative;width:50%;');
  });

  it('full width with a ratio reserves the space via aspect-ratio and intrinsic dimensions', () => {
    const out = parse(
      single({
        image: '/uploads/pages/a.jpg',
        image_size: { width_mode: 'full', height_mode: 'ratio', ratio: { desktop: '16:9', mobile: '4:5' }, fit: 'contain' },
      }),
    );
    expect(out.img?.getAttribute('width')).toBe('1200');
    expect(out.img?.getAttribute('height')).toBe('675');
    expect(out.img?.getAttribute('sizes')).toBe('(max-width: 1023px) 100vw, 50vw');
    const css = stableCss(out.css, out.scope);
    expect(css).toContain('aspect-ratio:16/9;object-fit:contain');
    expect(css).toContain('@media (max-width: 767px){.S-img{aspect-ratio:4/5}}');
  });

  it('fixed px height with cover and a focal point', () => {
    const out = parse(
      single({
        image: '/uploads/pages/a.jpg',
        image_size: { height_mode: { desktop: 'px', mobile: 'auto' }, height_px: 320, position: 'top' },
      }),
    );
    const css = stableCss(out.css, out.scope);
    expect(css).toContain('height:320px;aspect-ratio:auto 1200/1200;object-fit:cover;object-position:center top');
    // Mobile goes back to an auto height but keeps the reserved ratio.
    expect(css).toContain('@media (max-width: 767px){.S-img{height:auto;object-fit:fill;object-position:center}}');
  });

  it('auto width renders one natural rendition without srcset', () => {
    const out = parse(
      single({ image: '/uploads/pages/logo.png', image_size: { width_mode: 'auto', height_mode: 'px', height_px: 60 } }),
    );
    expect(out.img?.tagName).toBe('IMG');
    expect(out.img?.hasAttribute('srcset')).toBe(false);
    expect(out.img?.hasAttribute('sizes')).toBe(false);
    expect(out.img?.getAttribute('src')).toContain('/_next/image?url=');
    expect(out.img?.getAttribute('src')).toContain('w=1920');
    expect(stableCss(out.css, out.scope)).toContain('.S{position:relative;width:fit-content;');
  });

  it('svg keeps the original file (unoptimized)', () => {
    const out = parse(single({ image: '/uploads/pages/logo.svg', image_size: { width_mode: 'px', width_px: 200 } }));
    expect(out.img?.getAttribute('src')).toBe('http://localhost:3001/uploads/pages/logo.svg');
  });

  it('max width caps the frame and the sizes slot', () => {
    const out = parse(single({ image: '/uploads/pages/a.jpg', image_size: { width_mode: 'px', width_px: 900, max_width_px: 500 } }));
    expect(stableCss(out.css, out.scope)).toContain('max-width:min(100%,500px)');
    // 50vw is >= 500px from 1024px up, so only phones need min().
    expect(out.img?.getAttribute('sizes')).toBe('(max-width: 767px) min(500px, 100vw), 500px');
  });

  it('a link becomes the frame itself', () => {
    const out = parse(
      single({ image: '/uploads/pages/a.jpg', link_url: '/products', rounded: false, image_size: { width_mode: 'px', width_px: 300 } }),
    );
    expect(out.frame?.tagName).toBe('A');
    expect(out.frame?.getAttribute('href')).toBe('/products');
    expect(out.frame?.getAttribute('style')).toBe('display:block;border-radius:0;overflow:hidden');
    expect(out.doc.querySelectorAll('a')).toHaveLength(1);
  });

  it('alignment is logical (RTL-safe): no physical margins, same CSS in ar', () => {
    const settings = {
      image: '/uploads/pages/a.jpg',
      image_size: { width_mode: 'px', width_px: 300, align: { desktop: 'end', tablet: 'center', mobile: 'start' } },
    };
    const sv = parse(single(settings));
    const ar = parse(single(settings, { locale: 'ar' }));
    const css = stableCss(sv.css, sv.scope);
    expect(css).not.toMatch(/margin-(left|right)/);
    expect(css).toContain('margin-inline-start:auto;margin-inline-end:0');
    expect(css).toContain('@media (max-width: 1023px){.S{margin-inline-end:auto}}');
    expect(css).toContain('@media (max-width: 767px){.S{margin-inline-start:0}}');
    expect(stableCss(ar.css, ar.scope)).toBe(css);
  });

  it('two sized images on one page get distinct scopes', () => {
    const html = renderToStaticMarkup(
      <>
        <SingleImage locale="sv" primaryLocale="sv" storeSlug="x" content={{}} settings={{ image: '/a.jpg', image_size: { width_mode: 'px' } }} />
        <SingleImage locale="sv" primaryLocale="sv" storeSlug="x" content={{}} settings={{ image: '/b.jpg', image_size: { width_mode: 'px' } }} />
      </>,
    );
    const scopes = [...html.matchAll(/class="(isz-[^"]+?)"/g)].map((m) => m[1]).filter((c) => !c.endsWith('-img'));
    expect(scopes).toHaveLength(2);
    expect(new Set(scopes).size).toBe(2);
  });

  it('builder placeholder uses the desktop ratio', () => {
    const html = single({ image_size: { height_mode: 'ratio', ratio: '3:2' } }, { builderPreview: true });
    expect(html).toContain('aspect-ratio:3/2');
    expect(html).toContain('Upload an image');
  });

  it('product image source uses the sized frame', () => {
    const out = parse(
      single({ image_source: 'product_featured', image_size: { width_mode: 'percent', width_percent: 80 } }, { product: PRODUCT }),
    );
    expect(out.frame?.getAttribute('data-dynamic-image')).toBe('product_featured');
    expect(out.img?.getAttribute('src')).toContain('one.jpg');
    expect(out.img?.getAttribute('sizes')).toBe('(max-width: 1023px) 80vw, 40vw');
  });

  it('variant image source passes the scope, dimensions and sizes to the island', () => {
    leadImage = null;
    const out = parse(
      single({ image_source: 'variant_image', image_size: { height_mode: 'ratio', ratio: '4:5' } }, { product: PRODUCT }),
    );
    expect(out.frame?.getAttribute('data-dynamic-image')).toBe('variant_image');
    expect(out.img?.getAttribute('width')).toBe('1200');
    expect(out.img?.getAttribute('height')).toBe('1500');
    expect(out.img?.getAttribute('sizes')).toBe('(max-width: 1023px) 100vw, 50vw');
    expect(out.css).toContain('aspect-ratio:4/5');
  });

  it('variant image source with a link makes the frame the link (same hit area as static)', () => {
    leadImage = null;
    const out = parse(
      single(
        { image_source: 'variant_image', link_url: '/p', image_size: { width_mode: 'px', width_px: 300, align: 'center' } },
        { product: PRODUCT },
      ),
    );
    expect(out.frame?.tagName).toBe('A');
    expect(out.frame?.getAttribute('href')).toBe('/p');
    expect(out.frame?.getAttribute('data-dynamic-image')).toBe('variant_image');
    expect(out.frame?.getAttribute('style')).toContain('display:block');
    expect(out.doc.querySelectorAll('a')).toHaveLength(1);
  });

  it('variant image source with auto width renders the natural rendition', () => {
    leadImage = null;
    const out = parse(single({ image_source: 'variant_image', image_size: { width_mode: 'auto' } }, { product: PRODUCT }));
    expect(out.img?.hasAttribute('srcset')).toBe(false);
    expect(out.img?.getAttribute('src')).toContain('w=1920');
  });

  it('declares the imageSize field and drops the legacy aspect / fit fields', () => {
    const keys = singleImageSection.schema.schema.map((f) => f.key);
    expect(keys).toContain('image_size');
    expect(keys).not.toContain('aspect');
    expect(keys).not.toContain('fit');
    expect(singleImageSection.schema.schema.find((f) => f.key === 'image_size')?.type).toBe('imageSize');
  });
});

describe('layout-columns image block with image_size', () => {
  it('image_size wins over the legacy width_px / aspect', () => {
    const out = parse(
      columns([
        { type: 'image', image: '/uploads/pages/logo.webp', alt: 'L', width_px: 200, aspect: 'wide', image_size: { width_mode: 'px', width_px: 140 } },
      ]),
    );
    expect(out.img?.getAttribute('sizes')).toBe('140px');
    expect(out.img?.getAttribute('alt')).toBe('L');
    expect(stableCss(out.css, out.scope)).toContain('.S{position:relative;width:140px;');
    expect(out.doc.querySelector('.aspect-\\[16\\/9\\]')).toBeNull();
  });

  it('full width follows the 50vw / 100vw column slots', () => {
    const out = parse(
      columns([{ type: 'image', image: '/uploads/pages/a.jpg', image_size: { width_mode: 'full', height_mode: 'ratio', ratio: '1:1' } }]),
    );
    expect(out.img?.getAttribute('sizes')).toBe('(max-width: 767px) 100vw, 50vw');
  });

  it('per-breakpoint width modes', () => {
    const out = parse(
      columns([
        {
          type: 'image',
          image: '/uploads/pages/a.jpg',
          image_size: { width_mode: { desktop: 'px', tablet: 'percent', mobile: 'full' }, width_px: 300, width_percent: 60 },
        },
      ]),
    );
    expect(out.img?.getAttribute('sizes')).toBe('(max-width: 767px) 100vw, (max-width: 1023px) 30vw, 300px');
    const css = stableCss(out.css, out.scope);
    expect(css).toContain('@media (max-width: 1023px){.S{width:60%}}');
    expect(css).toContain('@media (max-width: 767px){.S{width:100%}}');
  });

  it('rounded frame and an external link as the frame', () => {
    const out = parse(
      columns([{ type: 'image', image: '/uploads/pages/a.jpg', rounded: true, link: 'https://x.se', image_size: { align: 'center' } }]),
    );
    expect(out.frame?.tagName).toBe('A');
    expect(out.frame?.getAttribute('href')).toBe('https://x.se');
    expect(out.frame?.getAttribute('target')).toBe('_blank');
    expect(out.frame?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(out.frame?.getAttribute('style')).toBe('display:block;border-radius:var(--theme-radius-md);overflow:hidden');
  });

  it('declares the imageSize field and drops the legacy width_px / aspect fields', () => {
    type F = { key: string; fields?: F[]; showIf?: unknown };
    const cells = (layoutColumnsSection.schema.schema as F[]).find((f) => f.key === 'cells');
    const blockFields = cells?.fields?.find((f) => f.key === 'blocks')?.fields || [];
    const keys = blockFields.map((f) => f.key);
    expect(keys).toContain('image_size');
    expect(keys).not.toContain('width_px');
    expect(keys).not.toContain('aspect');
    expect(blockFields.find((f) => f.key === 'image_size')?.showIf).toEqual({ key: 'type', in: ['image'] });
  });
});
