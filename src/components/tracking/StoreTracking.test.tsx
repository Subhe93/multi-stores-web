import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/i18n/messages/en.json';
import { CONSENT_MAX_AGE_S, clearConsent, consentCookieName, consentStorageKey } from '@/lib/consent';
import { StoreTracking } from './StoreTracking';

// Cookie consent (3.9): the banner shows only for stores with a tracking id,
// "accept" persists the choice (cookie + localStorage) and mounts the vendor
// tags, "reject" persists the choice and mounts nothing.

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
// next/script defers real loading; a plain <script> stand-in lets the test
// assert on what would be mounted.
vi.mock('next/script', () => ({
  default: ({ id, src }: { id?: string; src?: string }) => (
    <script data-testid="tracker" id={id} data-src={src} />
  ),
}));

const SLUG = 'namez';
const COOKIE = consentCookieName(SLUG);
const tracking = {
  ga4_measurement_id: 'G-ABCD1234',
  meta_pixel_id: null,
  tiktok_pixel_id: null,
  consent_required: true,
};

function renderTracking(props: Partial<React.ComponentProps<typeof StoreTracking>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <StoreTracking storeSlug={SLUG} tracking={tracking} {...props} />
    </NextIntlClientProvider>,
  );
}

function clearCookie() {
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}

describe('StoreTracking', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCookie();
  });
  afterEach(() => {
    window.localStorage.clear();
    clearCookie();
  });

  it('renders nothing for a store without tracking ids', () => {
    renderTracking({
      tracking: { ga4_measurement_id: null, meta_pixel_id: null, tiktok_pixel_id: null, consent_required: true },
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryAllByTestId('tracker')).toHaveLength(0);
  });

  it('shows an accessible banner with a policy link and no tags until a choice is made', async () => {
    renderTracking({ policyHref: '/om-cookies' });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('We use cookies');
    expect(screen.getByRole('link', { name: 'Read our cookie policy' })).toHaveAttribute('href', '/om-cookies');
    expect(screen.queryAllByTestId('tracker')).toHaveLength(0);
  });

  it('accept stores the choice in the cookie + localStorage and mounts the tags', async () => {
    renderTracking();
    fireEvent.click(await screen.findByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.cookie).toContain(`${COOKIE}=granted`);
    const stored = JSON.parse(window.localStorage.getItem(consentStorageKey(SLUG)) ?? '{}');
    expect(stored.choice).toBe('granted');
    expect(typeof stored.at).toBe('number');
    const trackers = screen.getAllByTestId('tracker');
    expect(trackers.map((s) => s.id)).toEqual(['ms-ga4-src', 'ms-ga4-init']);
    expect(trackers[0]).toHaveAttribute('data-src', 'https://www.googletagmanager.com/gtag/js?id=G-ABCD1234');
  });

  it('reject stores the choice and loads nothing', async () => {
    renderTracking();
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.cookie).toContain(`${COOKIE}=denied`);
    expect(JSON.parse(window.localStorage.getItem(consentStorageKey(SLUG)) ?? '{}').choice).toBe('denied');
    expect(screen.queryAllByTestId('tracker')).toHaveLength(0);
  });

  it('honours a stored choice without showing the banner again', async () => {
    window.localStorage.setItem(consentStorageKey(SLUG), JSON.stringify({ choice: 'granted', at: Date.now() }));
    renderTracking();
    await waitFor(() => expect(screen.getAllByTestId('tracker')).toHaveLength(2));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a "Cookie settings" link after a choice; clearConsent re-opens the banner', async () => {
    renderTracking();
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const manage = await screen.findByRole('button', { name: 'Cookie settings' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(manage);
    await screen.findByRole('dialog');
    expect(document.cookie).not.toContain(`${COOKIE}=`);
    expect(window.localStorage.getItem(consentStorageKey(SLUG))).toBeNull();
    // Programmatic clear (other code) works the same way.
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(screen.getAllByTestId('tracker')).toHaveLength(2));
    clearConsent(SLUG);
    await screen.findByRole('dialog');
    expect(screen.queryAllByTestId('tracker')).toHaveLength(0);
  });

  it('ignores a stored choice older than one year', async () => {
    const at = Date.now() - (CONSENT_MAX_AGE_S + 60) * 1000;
    window.localStorage.setItem(consentStorageKey(SLUG), JSON.stringify({ choice: 'granted', at }));
    renderTracking();
    await screen.findByRole('dialog');
    expect(screen.queryAllByTestId('tracker')).toHaveLength(0);
  });

  it('mounts the tags immediately when the store does not require consent', async () => {
    renderTracking({ tracking: { ...tracking, consent_required: false } });
    await waitFor(() => expect(screen.getAllByTestId('tracker')).toHaveLength(2));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
