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

  it('locks page scroll while open (body pinned at the offset) and restores the position on close (QA #10)', () => {
    const y = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(900);
    const scrollTo = vi.spyOn(window, 'scrollTo');
    render(<ProductGallery images={images} />);
    fireEvent.click(screen.getByLabelText('product.viewFullScreen'));
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-900px');
    expect(document.documentElement.style.overflow).toBe('hidden');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.position).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
    expect(scrollTo).toHaveBeenCalledWith(0, 900);
    y.mockRestore();
    scrollTo.mockRestore();
  });

  it('shows the gallery rendition and a spinner until the full image loads (no black screen)', () => {
    const { container } = render(<ProductGallery images={images} />);
    // jsdom never decodes: mark the gallery's main image A as loaded.
    for (const img of Array.from(container.querySelectorAll<HTMLImageElement>('img[src="/uploads/a.jpg"]'))) {
      Object.defineProperty(img, 'complete', { value: true, configurable: true });
      Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
    }
    fireEvent.click(screen.getByLabelText('product.viewFullScreen'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('[data-lightbox-placeholder] img')!.getAttribute('src')).toContain('/uploads/a.jpg');
    expect(screen.getByRole('status')).toHaveTextContent('common.loading');
    const full = dialog.querySelector('img[alt="A"]') as HTMLImageElement;
    fireEvent.load(full);
    expect(dialog.querySelector('[data-lightbox-placeholder]')).toBeNull();
    // The next image (never loaded on the page) starts with the spinner only:
    // no gallery-size rendition is requested next to the full image.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(dialog.querySelector('[data-lightbox-placeholder]')).not.toBeNull();
    expect(dialog.querySelector('[data-lightbox-placeholder] img')).toBeNull();
  });
});
