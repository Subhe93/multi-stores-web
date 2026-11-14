import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SectionRenderProps } from '../../types';
import { MasonryGallery } from './MasonryGallery.client';

// The masonry lightbox is portalled to <body> (audit gap 9, same fix as the
// product gallery in M94), so no ancestor stacking context can cover it.

const props = (locale = 'en'): SectionRenderProps => ({
  settings: { columns: 3, enable_lightbox: true },
  content: {
    images: [
      { image: '/uploads/a.webp', caption: 'A' },
      { image: '/uploads/b.webp', caption: 'B' },
    ],
  },
  locale,
  primaryLocale: 'en',
  storeSlug: 'shop',
});

describe('MasonryGallery lightbox', () => {
  it('renders under <body>, outside a wrapper with its own stacking context', () => {
    const { container } = render(
      <div style={{ position: 'relative', zIndex: 1, transform: 'translateZ(0)' }}>
        <MasonryGallery {...props()} />
      </div>,
    );
    fireEvent.click(screen.getByLabelText('A'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.parentElement).toBe(document.body);
    expect(container.contains(dialog)).toBe(false);
    expect(dialog).toHaveAttribute('dir', 'ltr');
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('carries the RTL direction into the portal', () => {
    render(<MasonryGallery {...props('ar')} />);
    fireEvent.click(screen.getByLabelText('A'));
    expect(screen.getByRole('dialog')).toHaveAttribute('dir', 'rtl');
  });

  it('renders no lightbox markup on the server', () => {
    const html = renderToString(<MasonryGallery {...props()} />);
    expect(html).not.toContain('role="dialog"');
  });

  it('locks page scroll while the lightbox is open and releases it on close (QA #10)', () => {
    render(<MasonryGallery {...props()} />);
    fireEvent.click(screen.getByLabelText('A'));
    expect(document.body.style.position).toBe('fixed');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.position).toBe('');
  });
});
