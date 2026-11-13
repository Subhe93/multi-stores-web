import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductGallery } from './ProductGallery';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('@/components/StoreImage', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  StoreImage: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const images = [
  { id: 'a', url: '/uploads/a.jpg', alt: 'A' },
  { id: 'b', url: '/uploads/b.jpg', alt: 'B' },
];

// jsdom has no scrollIntoView (used to keep the active thumbnail visible).
Element.prototype.scrollIntoView = vi.fn();

describe('ProductGallery lightbox', () => {
  it('renders the lightbox directly under <body>, outside any stacking context of the gallery', () => {
    const { container } = render(
      // A wrapper that creates its own stacking context, like a sticky column.
      <div style={{ position: 'relative', zIndex: 1, transform: 'translateZ(0)' }}>
        <ProductGallery images={images} />
      </div>,
    );
    fireEvent.click(screen.getByLabelText('product.viewFullScreen'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.parentElement).toBe(document.body);
    expect(container.contains(dialog)).toBe(false);

    fireEvent.click(screen.getByLabelText('common.close'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
