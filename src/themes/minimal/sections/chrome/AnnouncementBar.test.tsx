import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnouncementBar } from './AnnouncementBar.client';

// next-intl: return the key so labels are assertable without a provider.
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

const base = { locale: 'sv', primaryLocale: 'sv', storeSlug: 'demo' };

// jsdom has no matchMedia; the rotating layout reads prefers-reduced-motion.
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

function bar(
  messages: Record<string, unknown>[],
  settings: Record<string, unknown> = { layout: 'simple' },
  props: Partial<typeof base> = {},
) {
  return render(<AnnouncementBar {...base} {...props} settings={settings} content={{ messages }} />);
}

// Payment badge after a message ("Betala med [Klarna]"), as the store's old
// top bar had it.
describe('AnnouncementBar payment badge', () => {
  it('draws the Klarna badge after the text when the message asks for it', () => {
    bar([{ text: 'Betala med', badge: 'klarna' }]);
    const img = screen.getByAltText('Klarna');
    expect(img.getAttribute('src')).toBe('/payment-badges/klarna.svg');
    expect(img.getAttribute('height')).toBe('18');
    expect(screen.getByText('Betala med')).toBeTruthy();
    // Inline with its text: same parent as the words, not a separate row.
    expect(img.parentElement).toBe(screen.getByText('Betala med').parentElement);
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
    // Messages share one grid cell; each is rendered exactly once.
    expect(screen.getAllByAltText('Klarna')).toHaveLength(1);
  });
});

describe('AnnouncementBar marquee', () => {
  it('hides the duplicated copy from assistive tech and the tab order', () => {
    const { container } = bar([{ text: 'Fri frakt', link_label: 'Handla', link_url: '/products' }], { layout: 'marquee' });
    const copy = container.querySelector('[aria-hidden="true"]');
    expect(copy).not.toBeNull();
    expect(copy!.hasAttribute('inert')).toBe(true);
    // Only the first copy's link is exposed.
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});

describe('AnnouncementBar links', () => {
  it('keeps a secondary-locale visitor on their locale', () => {
    bar([{ text: 'Sale', link_label: 'Shop', link_url: '/products' }], { layout: 'simple' }, { locale: 'ar' });
    expect(screen.getByRole('link', { name: 'Shop' }).getAttribute('href')).toBe('/ar/products');
  });

  it('leaves the primary locale untouched', () => {
    bar([{ text: 'Sale', link_label: 'Shop', link_url: '/products' }]);
    expect(screen.getByRole('link', { name: 'Shop' }).getAttribute('href')).toBe('/products');
  });
});

describe('AnnouncementBar dismissal', () => {
  const dismissible = { layout: 'simple', dismissible: true, dismiss_key: 'summer' };

  it('remembers the dismissal per store', () => {
    bar([{ text: 'Sale' }], dismissible);
    fireEvent.click(screen.getByRole('button', { name: 'dismissAnnouncement' }));
    expect(screen.queryByText('Sale')).toBeNull();
    expect(window.localStorage.getItem('msab-dismissed-demo-summer')).toBe('1');
  });

  it('does not hide another store bar', () => {
    window.localStorage.setItem('msab-dismissed-other-summer', '1');
    bar([{ text: 'Sale' }], dismissible);
    expect(screen.getByText('Sale')).toBeTruthy();
  });

  it('still honours an older un-scoped dismissal', () => {
    window.localStorage.setItem('msab-dismissed-summer', '1');
    bar([{ text: 'Sale' }], dismissible);
    expect(screen.queryByText('Sale')).toBeNull();
  });

  it('keeps working when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    bar([{ text: 'Sale' }], dismissible);
    fireEvent.click(screen.getByRole('button', { name: 'dismissAnnouncement' }));
    expect(screen.queryByText('Sale')).toBeNull();
  });
});
