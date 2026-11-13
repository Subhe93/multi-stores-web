import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SectionRenderer } from '../../../SectionRenderer';
import { minimalTheme } from '../../theme';
import type { SectionDefinition, SectionInstance, SectionRenderProps, Theme } from '../../../types';

// Designer app on: the gallery shows the featured thumbnail above the live
// canvas. The session and the page state are stubbed; only the markup the
// mobile ordering rules target is under test.
vi.mock('@/components/designer/DesignerSession', () => ({
  useDesignerSession: () => ({ session: null }),
  DesignerCanvasSlot: ({ className }: { className?: string }) => <div className={className} data-testid="canvas" />,
}));
vi.mock('./blocks/b1Shared', () => ({
  useBlockState: () => ({
    galleryImages: [{ url: '/uploads/a.jpg', alt: 'A' }],
    activeGalleryIndex: 0,
    setActiveGalleryIndex: () => undefined,
  }),
  isBlockPreview: () => false,
  B1Placeholder: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const { ProductGalleryMagic, DESIGNER_MOBILE_CSS, DESIGNER_ROW_SELECTOR } = await import('./ProductGalleryMagic.client');

const block = (id: string): SectionDefinition => ({
  schema: { id, label: { en: id }, category: 'product', translatable: [], schema: [] },
  Component: (props: SectionRenderProps) => <p data-block={id}>{String(props.settings.label ?? id)}</p>,
});

const theme: Theme = {
  ...minimalTheme,
  sections: {
    'layout-row': minimalTheme.sections['layout-row'],
    'layout-column': minimalTheme.sections['layout-column'],
    'product-gallery': {
      schema: { id: 'product-gallery', label: { en: 'Gallery' }, category: 'product', translatable: [], schema: [] },
      Component: ProductGalleryMagic,
    },
    'product-title': block('product-title'),
    'product-price': block('product-price'),
    'product-buy': block('product-buy'),
  },
};

const sec = (id: string, key: string, sort_order: number, parent_id: string | null, settings = {}): SectionInstance => ({
  id,
  section_key: key,
  sort_order,
  parent_id,
  settings,
  translations: [],
});

// The Classic tree's row (convert / preset): gallery | title, price, buy.
const classic = [
  sec('row', 'layout-row', 0, null, { stack_on: 'mobile', gap_px: 56, gap_tablet_px: 32 }),
  sec('gcol', 'layout-column', 0, 'row', { sticky_desktop: true, sticky_from: 'tablet' }),
  sec('icol', 'layout-column', 1, 'row', { gap_px: 20 }),
  sec('gallery', 'product-gallery', 0, 'gcol', { layout: 'classic' }),
  sec('title', 'product-title', 0, 'icol'),
  sec('price', 'product-price', 1, 'icol'),
  sec('buy', 'product-buy', 2, 'icol'),
];

describe('product gallery in designer mode (monolith mobile order)', () => {
  it('marks the thumbnail, the canvas and the gallery the mobile rules target', () => {
    const { container } = render(
      <SectionRenderer theme={theme} sections={classic} locale="sv" primaryLocale="sv" storeSlug="namez-se" />,
    );
    const gallery = container.querySelector('[data-designer-gallery]')!;
    expect(gallery).not.toBeNull();
    expect(gallery.querySelector('img[data-designer-thumb]')?.getAttribute('class')).toContain('md:mb-4');
    expect(gallery.querySelector('.designer-canvas-slot')).not.toBeNull();
    // The rules' row selector finds exactly the Classic row's flex element.
    const rows = container.querySelectorAll(DESIGNER_ROW_SELECTOR);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toBe(container.querySelector('.lc-row'));
    // Each collapsed level of the selector chain exists in the DOM.
    expect(container.querySelectorAll(`${DESIGNER_ROW_SELECTOR}>[data-section-id]`)).toHaveLength(2);
    expect(container.querySelectorAll(`${DESIGNER_ROW_SELECTOR}>[data-section-id]>div>[data-layout="column"]`)).toHaveLength(2);
    expect(
      Array.from(container.querySelectorAll(`${DESIGNER_ROW_SELECTOR} [data-layout="column"]>[data-section-key]`)).map((el) =>
        el.getAttribute('data-section-key'),
      ),
    ).toEqual(['product-gallery', 'product-title', 'product-price', 'product-buy']);
  });

  it('orders featured image, title / price, canvas, then the rest, 20px apart, below 768px only', () => {
    expect(DESIGNER_MOBILE_CSS.startsWith('@media (max-width: 767px){')).toBe(true);
    expect(DESIGNER_MOBILE_CSS).toContain(`${DESIGNER_ROW_SELECTOR}{gap:20px}`);
    expect(DESIGNER_MOBILE_CSS).toContain(`${DESIGNER_ROW_SELECTOR} [data-designer-thumb]{order:-3}`);
    expect(DESIGNER_MOBILE_CSS).toContain(
      `${DESIGNER_ROW_SELECTOR} [data-layout="column"]>[data-section-key="product-title"],${DESIGNER_ROW_SELECTOR} [data-layout="column"]>[data-section-key="product-price"]{order:-2}`,
    );
    expect(DESIGNER_MOBILE_CSS).toContain(`${DESIGNER_ROW_SELECTOR} .designer-canvas-slot{order:-1}`);
    expect(DESIGNER_MOBILE_CSS).toContain(`${DESIGNER_ROW_SELECTOR} [data-designer-gallery]{display:contents}`);
  });

  it('leaves a gallery outside the Classic row alone', () => {
    const { container } = render(
      <SectionRenderer
        theme={theme}
        sections={[sec('gallery', 'product-gallery', 0, null)]}
        locale="sv"
        primaryLocale="sv"
        storeSlug="namez-se"
      />,
    );
    expect(container.querySelector('[data-designer-gallery]')).not.toBeNull();
    expect(container.querySelectorAll(DESIGNER_ROW_SELECTOR)).toHaveLength(0);
  });
});
