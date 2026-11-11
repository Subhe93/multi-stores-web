import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AnnouncementBar } from './AnnouncementBar.client';

// Payment badge after a message ("Betala med [Klarna]"), as the store's old
// top bar had it.

const base = { locale: 'sv', primaryLocale: 'sv', storeSlug: 'demo' };

// jsdom has no matchMedia; the rotating layout reads prefers-reduced-motion.
beforeAll(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
});

function bar(messages: Record<string, unknown>[], settings: Record<string, unknown> = { layout: 'simple' }) {
  return render(<AnnouncementBar {...base} settings={settings} content={{ messages }} />);
}

describe('AnnouncementBar payment badge', () => {
  it('draws the Klarna badge after the text when the message asks for it', () => {
    bar([{ text: 'Betala med', badge: 'klarna' }]);
    const img = screen.getByAltText('Klarna');
    expect(img.getAttribute('src')).toBe('/payment-badges/klarna.svg');
    expect(img.getAttribute('height')).toBe('18');
    expect(screen.getByText('Betala med')).toBeTruthy();
  });

  it('draws nothing for "none", a missing value or an unknown badge', () => {
    for (const badge of ['none', undefined, 'bitcoin']) {
      const { unmount } = bar([{ text: 'Fri frakt', badge }]);
      expect(screen.queryByRole('img')).toBeNull();
      unmount();
    }
  });

  it('keeps the badge on the message it belongs to in the rotating layout', () => {
    bar(
      [{ text: 'Fri frakt' }, { text: 'Betala med', badge: 'klarna' }],
      { layout: 'rotating' },
    );
    // Second message only (the invisible spacer repeats the first message).
    expect(screen.getAllByAltText('Klarna')).toHaveLength(1);
  });
});
