import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSelectedLayoutSegment: () => null,
}));
// next/dynamic does not resolve in renderToStaticMarkup: use the islands.
vi.mock('./_shared/lazyDynamic', async () => import('./_shared/DynamicProductImage.client'));

import { SectionRenderer } from '../../SectionRenderer';
import { minimalTheme } from '../theme';
import type { SectionDefinition, SectionInstance, SectionRenderProps } from '../../types';
import { MEDIA_CSS } from '../../creative/css/media.css';
import { G } from '../../creative/css/base.css';
import { imageWithTextSection } from './ImageWithText';
import { singleImageSection } from './SingleImage';
import { imageGallerySection } from './ImageGallery';
import { GallerySlider } from './GallerySlider.client';
import { bentoGridSection } from './BentoGrid';
import { categoryTilesSection } from './CategoryTiles';
import { MasonryGallery } from './MasonryGallery.client';
import { BeforeAfter } from './BeforeAfter.client';
import { ImageHotspots } from './ImageHotspots.client';
import { VideoEmbed } from './VideoEmbed.client';
import { layoutColumnsSection } from './LayoutColumns';

// Store motion style on the media and editorial sections (builder S3):
// without the `motion` prop every section renders exactly today's markup;
// with it the recipes of plans/newroj/STORE-MOTION-CONTRACT.md (S3) appear
// and the text of the section does not change.

type Motion = SectionRenderProps['motion'];
type Case = {
  name: string;
  Component: SectionDefinition['Component'];
  settings: Record<string, unknown>;
  content: Record<string, unknown>;
  extra?: Partial<SectionRenderProps>;
};

const IMG = '/uploads/pages/a.jpg';
const TEXT = { eyebrow: 'Our story', heading: 'Made by hand', body: 'A short text.', cta_text: 'Read more', cta_secondary_text: 'Shop' };
const GALLERY = {
  heading: 'Gallery',
  subheading: 'Recent work',
  items: [
    { url: IMG, alt: 'One', caption: 'First', href: '/one' },
    { url: '/uploads/pages/b.jpg', alt: 'Two', caption: 'Second' },
    { url: '/uploads/pages/c.jpg', alt: 'Three' },
  ],
};
const TILES = {
  heading: 'Shop by\ncategory',
  subheading: 'Pick a range',
  items: [
    { image: IMG, title: 'Clothing', subtitle: 'Everyday', url: '/collections/clothing' },
    { image: '/uploads/pages/b.jpg', title: 'Jewellery', url: '/collections/jewellery' },
    { image: '/uploads/pages/c.jpg', title: 'No link' },
  ],
};

const CASES: Case[] = [
  {
    name: 'image-with-text (framed)',
    Component: imageWithTextSection.Component,
    settings: { image: IMG, image_position: 'left', aspect: 'portrait', cta_url: '/about' },
    content: TEXT,
  },
  {
    name: 'image-with-text (edge to edge)',
    Component: imageWithTextSection.Component,
    settings: { image: IMG, image_position: 'right', image_style: 'bleed', cta_url: '/about' },
    content: { ...TEXT, heading: 'Made\nby hand' },
  },
  {
    name: 'single-image (legacy, fixed aspect)',
    Component: singleImageSection.Component,
    settings: { image: IMG, aspect: 'landscape', link_url: '/x' },
    content: { alt: 'A table' },
  },
  {
    name: 'single-image (legacy, natural)',
    Component: singleImageSection.Component,
    settings: { image: IMG, aspect: 'auto' },
    content: { alt: 'A table' },
  },
  {
    name: 'single-image (image_size)',
    Component: singleImageSection.Component,
    settings: { image: IMG, image_size: { desktop: { width: { mode: 'percent', percent: 60 }, height: { mode: 'ratio', ratio: '4:3' } } } },
    content: { alt: 'A table' },
  },
  { name: 'image-gallery (grid)', Component: imageGallerySection.Component, settings: { layout: 'grid', columns: 3 }, content: GALLERY },
  { name: 'image-gallery (masonry)', Component: imageGallerySection.Component, settings: { layout: 'masonry' }, content: GALLERY },
  { name: 'image-gallery (carousel)', Component: imageGallerySection.Component, settings: { layout: 'carousel' }, content: GALLERY },
  { name: 'gallery-slider', Component: GallerySlider, settings: { slides_per_view: 3 }, content: GALLERY },
  {
    name: 'bento-grid',
    Component: bentoGridSection.Component,
    settings: {},
    content: {
      heading: 'Highlights',
      subheading: 'A few things',
      tiles: [
        { size: 'large', title: 'One', text: 'Text', image: IMG, url: '/one' },
        { size: 'small', title: 'Two', text: 'Text' },
        { size: 'wide', title: 'Three' },
      ],
    },
  },
  {
    name: 'category-tiles',
    Component: categoryTilesSection.Component,
    settings: { ...categoryTilesSection.defaultSettings, show_arrow: true },
    content: TILES,
    extra: { builderPreview: false },
  },
  {
    name: 'category-tiles (overlay, swipe row)',
    Component: categoryTilesSection.Component,
    settings: { ...categoryTilesSection.defaultSettings, card_style: 'overlay', mobile_scroll: true, show_arrow: true },
    content: TILES,
    extra: { builderPreview: false },
  },
  {
    name: 'masonry-gallery',
    Component: MasonryGallery,
    settings: { columns: 3, enable_lightbox: true },
    content: { heading: 'Moments', images: [{ image: IMG, caption: 'A' }, { image: '/uploads/b.webp', caption: 'B', url: '/b' }] },
  },
  {
    name: 'before-after',
    Component: BeforeAfter,
    settings: { image_before: IMG, image_after: '/uploads/pages/b.jpg' },
    content: { heading: 'Before and after', label_before: 'Before', label_after: 'After' },
  },
  {
    name: 'image-hotspots',
    Component: ImageHotspots,
    settings: { image: IMG },
    content: { heading: 'In the picture', hotspots: [{ x: 20, y: 30, title: 'Lamp', subtitle: 'Brass' }] },
  },
  {
    name: 'video-embed',
    Component: VideoEmbed,
    settings: { video_url: '/uploads/film.mp4', poster: IMG },
    content: { heading: 'The film', subheading: 'Two minutes' },
  },
  {
    name: 'layout-columns',
    Component: layoutColumnsSection.Component,
    settings: { mode: 'grid', columns: 2 },
    content: {
      cells: [
        { blocks: [{ type: 'heading', text: 'Left' }, { type: 'text', html: '<p>Body</p>' }] },
        { blocks: [{ type: 'image', image: IMG, aspect: 'square', alt: 'Square' }] },
      ],
    },
  },
];

function el(c: Case, motion?: Motion, extra?: Partial<SectionRenderProps>): ReactElement {
  const { Component } = c;
  return (
    <Component
      locale="en"
      primaryLocale="en"
      storeSlug="demo"
      settings={c.settings}
      content={c.content}
      {...c.extra}
      {...extra}
      {...(motion ? { motion } : null)}
    />
  );
}
const html = (c: Case, motion?: Motion, extra?: Partial<SectionRenderProps>) => renderToStaticMarkup(el(c, motion, extra));
const text = (markup: string) => {
  const host = document.createElement('div');
  host.innerHTML = markup.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
  return host.textContent;
};
const byName = (name: string) => CASES.find((c) => c.name === name)!;
const count = (markup: string, re: RegExp) => markup.match(re)?.length ?? 0;

describe('media sections without the motion prop', () => {
  it.each(CASES)('$name: no engine attribute, same markup as with motion undefined', (c) => {
    const plain = html(c);
    expect(plain).not.toContain('data-cx-');
    expect(plain).not.toMatch(/class="[^"]*\bcx-/);
    expect(plain).toBe(html(c, undefined, { motion: undefined }));
  });
});

describe('media sections with the motion prop', () => {
  it.each(CASES)('$name: recipes appear on scroll and on intro, the text is unchanged', (c) => {
    const plain = html(c);
    const scroll = html(c, 'scroll');
    const intro = html(c, 'intro');
    expect(scroll).toMatch(/data-cx-(reveal|item)/);
    expect(scroll).not.toContain('data-cx-intro');
    expect(intro).toContain('data-cx-intro');
    // Nothing scroll-armed on the first section of a page: it plays on load.
    expect(intro).not.toContain('data-cx-reveal');
    expect(text(scroll)).toBe(text(plain));
    expect(text(intro)).toBe(text(plain));
    // The generic reveal and stagger wrappers are gone: one entrance only.
    expect(scroll).not.toMatch(/data-reveal=|data-stagger-/);
    // Same images, same order.
    const srcs = (m: string) => [...m.matchAll(/<img\b[^>]*?\ssrc="([^"]*)"/g)].map((x) => x[1]);
    expect(srcs(scroll)).toEqual(srcs(plain));
  });

  it('image-with-text: the image opens from the text side, drifts with the scroll and the text rises in order', () => {
    const out = html(byName('image-with-text (framed)'), 'scroll');
    // Image at the start: the text is at the end.
    expect(out).toMatch(/class="cx-mask"[^>]*data-cx-reveal="mask"[^>]*data-cx-dir="end"/);
    expect(out).toMatch(/data-cx-behavior="scrub"[^>]*data-cx-y="-5"/);
    expect(out).toMatch(/<p[^>]*data-cx-reveal="rise"[^>]*>Our story/);
    expect(out).toContain('data-cx-reveal="words"');
    expect(count(out, /class="cx-wi"/g)).toBe(3);
    expect(out).toMatch(/data-cx-reveal="rise" data-cx-i="2"[^>]*>A short text\./);
    expect(out).toMatch(/data-cx-reveal="rise" data-cx-i="3"/);
    expect(count(out, /data-cx-hover="press"/g)).toBe(2);
    // Buttons are plain links: never magnetic here, never hidden on their own.
    expect(out).not.toContain('data-cx-magnetic');
  });

  it('image-with-text edge to edge: the mask fills the image half and opens from the text side', () => {
    const out = html(byName('image-with-text (edge to edge)'), 'scroll');
    // Image at the end: the text is at the start.
    expect(out).toMatch(/class="cx-mask"[^>]*data-cx-dir="start"[^>]*style="position:absolute;inset:0"/);
    const host = document.createElement('div');
    host.innerHTML = out;
    expect(host.querySelector('h2')?.textContent).toBe('Made\nby hand');
  });

  it('image-with-text first on the page: the image only settles (never clipped or transparent)', () => {
    const out = html(byName('image-with-text (framed)'), 'intro');
    expect(out).toMatch(/class="cx-mask" data-cx-intro="scale"/);
    expect(out).not.toContain('data-cx-reveal="mask"');
  });

  it('image-with-text on a product page or a listing gets no scroll-linked layer', () => {
    const c = byName('image-with-text (framed)');
    expect(html(c, 'scroll', { product: {} as never })).not.toContain('data-cx-behavior');
    expect(html(c, 'scroll', { listing: {} as never })).not.toContain('data-cx-behavior');
  });

  it('single-image: the mask sits inside the frame and opens upwards', () => {
    for (const name of ['single-image (legacy, fixed aspect)', 'single-image (legacy, natural)', 'single-image (image_size)']) {
      const out = html(byName(name), 'scroll');
      expect(out).toMatch(/class="cx-mask"[^>]*data-cx-reveal="mask"[^>]*data-cx-dir="up"/);
      expect(count(out, /data-cx-reveal=/g)).toBe(1);
      expect(html(byName(name), 'intro')).toMatch(/class="cx-mask" data-cx-intro="scale"/);
    }
    // The frame (and the link that is the frame) stays the outer element.
    expect(html(byName('single-image (legacy, fixed aspect)'), 'scroll')).toMatch(/^<a href="\/x" class="block"><div class="relative w-full aspect-\[4\/3\]"/);
  });

  it('galleries: tiles stagger as marked items and their frames answer the hover', () => {
    for (const name of ['image-gallery (grid)', 'image-gallery (masonry)']) {
      const out = html(byName(name), 'scroll');
      expect(count(out, /data-cx-reveal="stagger"/g)).toBe(1);
      expect(count(out, /data-cx-item=""/g)).toBe(3);
      expect(count(out, /data-cx-hover="media"/g)).toBe(3);
      // The mark is on the tile box, never on the (inline) link.
      expect(out).not.toMatch(/<a\b[^>]*data-cx-item/);
    }
    const bento = html(byName('bento-grid'), 'scroll');
    expect(count(bento, /data-cx-reveal="stagger"/g)).toBe(1);
    expect(count(bento, /data-cx-item=""/g)).toBe(3);
    // Only the tile with a photo zooms.
    expect(count(bento, /data-cx-hover="media"/g)).toBe(1);
    const masonry = html(byName('masonry-gallery'), 'scroll');
    expect(count(masonry, /data-cx-reveal="stagger"/g)).toBe(1);
    expect(count(masonry, /data-cx-item=""/g)).toBe(2);
    expect(count(masonry, /data-cx-hover="media"/g)).toBe(2);
  });

  it('swipe rows and sliders enter as one block, without a per-item stagger', () => {
    const carousel = html(byName('image-gallery (carousel)'), 'scroll');
    expect(carousel).not.toContain('data-cx-item');
    expect(carousel).not.toContain('data-cx-reveal="stagger"');
    expect(carousel).toMatch(/overflow-x-auto[^>]*data-cx-reveal="rise"/);
    const slider = html(byName('gallery-slider'), 'scroll');
    expect(slider).not.toContain('data-cx-item');
    expect(count(slider, /data-cx-reveal="rise"/g)).toBe(2);
  });

  it('category-tiles: heading by lines, tiles stagger, linked tiles zoom, underline and move their arrow', () => {
    const out = html(byName('category-tiles'), 'scroll');
    expect(out).toContain('data-cx-reveal="words"');
    expect(count(out, /data-cx-reveal="stagger"/g)).toBe(1);
    expect(count(out, /data-cx-item=""/g)).toBe(3);
    // Two linked tiles with a photo; the tile without a link stays still.
    expect(count(out, /data-cx-hover="media"/g)).toBe(2);
    expect(count(out, /class="cx-tt"/g)).toBe(2);
    expect(count(out, /data-cx-arrow=""/g)).toBe(2);
    expect(out).not.toContain('data-cx-swipe');
    const host = document.createElement('div');
    host.innerHTML = out;
    expect(host.querySelector('h2')?.textContent).toBe('Shop by\ncategory');
    expect([...host.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Clothing', 'Jewellery', 'No link']);
  });

  it('category-tiles swipe row: one wrapper carries the row entrance, the grid keeps the stagger for wide screens', () => {
    const c = byName('category-tiles (overlay, swipe row)');
    const out = html(c, 'scroll');
    expect(out).toMatch(/<div data-cx-swipe-row="" data-cx-reveal="rise" data-cx-i="1"><div[^>]*data-cx-reveal="stagger" data-cx-swipe=""/);
    expect(count(out, /data-cx-item=""/g)).toBe(3);
    // No wrapper without the switch.
    expect(html(c)).not.toContain('data-cx-swipe');
    expect(html(c, 'intro')).toMatch(/data-cx-swipe-row="" data-cx-intro="rise"/);
  });

  it('before-after, hotspots and video: the container rises as one block, controls untouched', () => {
    for (const name of ['before-after', 'image-hotspots', 'video-embed']) {
      const out = html(byName(name), 'scroll');
      expect(count(out, /data-cx-reveal="rise" data-cx-i="1"/g)).toBe(1);
      expect(out).not.toContain('data-cx-reveal="mask"');
      expect(out).not.toContain('data-cx-hover');
      expect(out).not.toContain('data-cx-behavior');
    }
    // The comparison itself (handle, labels, images) is byte for byte the same.
    const from = '<div class="relative mx-auto w-full max-w-4xl select-none';
    const inner = (m: string) => m.slice(m.indexOf(from), m.lastIndexOf('</div></section>'));
    const plain = html(byName('before-after'));
    expect(plain).toContain(from);
    expect(inner(html(byName('before-after'), 'scroll'))).toBe(inner(plain));
  });

  it('layout-columns: the columns rise as a group, the blocks inside never move on their own', () => {
    const out = html(byName('layout-columns'), 'scroll');
    expect(count(out, /data-cx-reveal="stagger"/g)).toBe(1);
    expect(count(out, /data-cx-item=""/g)).toBe(2);
    expect(count(out, /data-cx-reveal=/g)).toBe(1);
    expect(out).not.toContain('cx-mask');
  });
});

describe('media sections through the section renderer', () => {
  const section = (id: string, key: string, c: Case, style?: Record<string, unknown>): SectionInstance => ({
    id,
    section_key: key,
    settings: { ...c.settings, ...(style ? { _style: style } : null) },
    sort_order: Number(id.replace(/\D/g, '')),
    translations: [{ locale: 'en', content: c.content }],
  });
  const page = (style?: Record<string, unknown>) => [
    section('s1', 'rich-text', { name: '', Component: () => null, settings: {}, content: { heading: 'Top' } }),
    section('s2', 'image-with-text', byName('image-with-text (framed)'), style),
    section('s3', 'category-tiles', byName('category-tiles'), style),
  ];
  const render = (sections: SectionInstance[], motion?: boolean) =>
    renderToStaticMarkup(
      <SectionRenderer theme={minimalTheme} locale="en" primaryLocale="en" storeSlug="demo" sections={sections} motion={motion} />,
    );
  const part = (markup: string, id: string) => {
    const host = document.createElement('div');
    host.innerHTML = markup;
    return host.querySelector(`[data-section-id="${id}"]`)!;
  };

  it('with the store switch the sections carry their recipes; "_style.motion: none" renders them still', () => {
    const on = render(page(), true);
    for (const id of ['s2', 's3']) {
      expect(part(on, id).getAttribute('data-cx-section')).toBeTruthy();
      expect(part(on, id).querySelector('[data-cx-reveal]')).not.toBeNull();
    }
    const none = render(page({ motion: 'none' }), true);
    for (const id of ['s2', 's3']) {
      expect(part(none, id).outerHTML).not.toContain('data-cx-');
      expect(part(none, id).querySelector('[class*="cx-"]')).toBeNull();
      expect(part(none, id).textContent).toBe(part(on, id).textContent);
    }
  });

  it('without the store switch nothing of the engine reaches the markup', () => {
    const off = render(page());
    expect(off).not.toContain('data-cx-');
    expect(off).toBe(render(page(), false));
  });
});

describe('media stylesheet slot', () => {
  it('every rule that moves or animates sits behind the gate', () => {
    // The one ungated rule is the typography reset of the tile title span.
    const rules = MEDIA_CSS.replace(/@media[^{]+\{/g, '').split('}').map((r) => r.trim()).filter(Boolean);
    for (const rule of rules) {
      const [selector, body = ''] = rule.split('{');
      const gated = selector.split(',').every((s) => s.trim().startsWith('html[data-cx-motion] .store-root'));
      if (!gated) {
        expect(selector).toBe('.store-root .cx-tt');
        expect(body).not.toMatch(/transition|animation|transform|translate|scale|opacity/);
      }
    }
    expect(MEDIA_CSS).toContain(`${G} a:hover [data-cx-arrow]`);
  });

  it('uses no physical property and no reduced-motion query', () => {
    expect(MEDIA_CSS).not.toMatch(/\b(margin|padding)-(left|right)\b|\bleft:|\bright:/);
    expect(MEDIA_CSS).not.toContain('prefers-reduced-motion');
  });

  it('the swipe row swaps its entrance at 768 px', () => {
    expect(MEDIA_CSS).toContain('@media (max-width:767.98px){');
    expect(MEDIA_CSS).toContain('[data-cx-swipe]>[data-cx-reveal][data-cx-state="pending"]{opacity:1;transform:none}');
    expect(MEDIA_CSS).toContain('[data-cx-swipe-row][data-cx-reveal][data-cx-state="pending"]{opacity:1;transform:none}');
  });
});
