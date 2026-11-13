import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/i18n/messages/en.json';
import {
  CONSENT_MAX_AGE_S,
  CONSENT_VERSION,
  clearConsent,
  consentCookieName,
  consentStorageKey,
  getActiveTrackers,
  isMetaPixelActive,
  writeConsent,
} from '@/lib/consent';
import { reloadPage } from './pageReload';
import { StoreTracking } from './StoreTracking';

// Cookie consent (3.9): the banner shows only for stores with a tracking id,
// "accept" persists the choice (cookie + localStorage) and mounts the vendor
// tags, "reject" persists the choice and mounts nothing.

const nav = vi.hoisted(() => ({ segments: [] as string[] }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSelectedLayoutSegments: () => nav.segments,
}));
vi.mock('./pageReload', () => ({ reloadPage: vi.fn() }));
// next/script defers real loading; a plain <script> stand-in lets the test
// assert on what would be mounted.
vi.mock('next/script', () => ({
  default: ({ id, src, children }: { id?: string; src?: string; children?: string }) => (
    <script data-testid="tracker" id={id} data-src={src} data-inline={children} />
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
    expect(document.cookie).toContain(`${COOKIE}=granted.${CONSENT_VERSION}`);
    const stored = JSON.parse(window.localStorage.getItem(consentStorageKey(SLUG)) ?? '{}');
    expect(stored.choice).toBe('granted');
    expect(typeof stored.at).toBe('number');
    expect(stored.v).toBe(CONSENT_VERSION);
    const trackers = screen.getAllByTestId('tracker');
    expect(trackers.map((s) => s.id)).toEqual(['ms-ga4-src', 'ms-ga4-init']);
    expect(trackers[0]).toHaveAttribute('data-src', 'https://www.googletagmanager.com/gtag/js?id=G-ABCD1234');
  });

  it('reject stores the choice and loads nothing', async () => {
    renderTracking();
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.cookie).toContain(`${COOKIE}=denied.${CONSENT_VERSION}`);
    expect(JSON.parse(window.localStorage.getItem(consentStorageKey(SLUG)) ?? '{}').choice).toBe('denied');
    expect(screen.queryAllByTestId('tracker')).toHaveLength(0);
  });

  it('honours a stored choice without showing the banner again', async () => {
    window.localStorage.setItem(consentStorageKey(SLUG), JSON.stringify({ choice: 'granted', at: Date.now(), v: CONSENT_VERSION }));
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
    window.localStorage.setItem(consentStorageKey(SLUG), JSON.stringify({ choice: 'granted', at, v: CONSENT_VERSION }));
    renderTracking();
    await screen.findByRole('dialog');
    expect(screen.queryAllByTestId('tracker')).toHaveLength(0);
  });

  it('mounts the tags immediately when the store does not require consent', async () => {
    renderTracking({ tracking: { ...tracking, consent_required: false } });
    await waitFor(() => expect(screen.getAllByTestId('tracker')).toHaveLength(2));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('flags the Meta pixel as active only while its tag is mounted', async () => {
    const withMeta = { ...tracking, meta_pixel_id: '1234567890' };
    renderTracking({ tracking: withMeta });
    await screen.findByRole('dialog');
    expect(isMetaPixelActive()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(isMetaPixelActive()).toBe(true));
    // Consent withdrawn: the tags unmount and the flag clears.
    clearConsent(SLUG);
    await screen.findByRole('dialog');
    expect(isMetaPixelActive()).toBe(false);
  });

  it('does not flag the Meta pixel for a store without a pixel id', async () => {
    renderTracking({ tracking: { ...tracking, consent_required: false } });
    await waitFor(() => expect(screen.getAllByTestId('tracker')).toHaveLength(2));
    expect(isMetaPixelActive()).toBe(false);
  });
});

// Microsoft Clarity (plans/clarity/PLAN.md, section 9 binding): always
// consent-gated, analytics-only consentv2 from an effect, revoke + reload on
// withdrawal, never on account / auth / confirmation routes.
describe('StoreTracking: Microsoft Clarity', () => {
  const withClarity = { ...tracking, clarity_project_id: 'sxtuobatm6' };
  let clarity: ReturnType<typeof vi.fn>;
  let gtag: ReturnType<typeof vi.fn>;

  const clarityTags = () => screen.queryAllByTestId('tracker').filter((s) => s.id === 'ms-clarity');
  const calls = (fn: ReturnType<typeof vi.fn>, method: string) => fn.mock.calls.filter((c) => c[0] === method);
  const seedGranted = () =>
    window.localStorage.setItem(
      consentStorageKey(SLUG),
      JSON.stringify({ choice: 'granted', at: Date.now(), v: CONSENT_VERSION }),
    );

  beforeEach(() => {
    window.localStorage.clear();
    clearCookie();
    nav.segments = [];
    vi.mocked(reloadPage).mockClear();
    // Stand-ins for the vendor globals (the real snippets never run in jsdom).
    clarity = vi.fn();
    gtag = vi.fn();
    window.clarity = clarity as unknown as typeof window.clarity;
    window.gtag = gtag;
  });
  afterEach(() => {
    delete window.clarity;
    delete window.gtag;
    window.localStorage.clear();
    clearCookie();
  });

  it('loads no Clarity tag and sends no signal before a choice', async () => {
    renderTracking({ tracking: withClarity });
    await screen.findByRole('dialog');
    expect(clarityTags()).toHaveLength(0);
    expect(clarity).not.toHaveBeenCalled();
    expect(getActiveTrackers().clarity).toBe(false);
  });

  it('names session recordings in the banner text when Clarity is configured', async () => {
    renderTracking({ tracking: withClarity });
    expect(await screen.findByText(/session recordings via Microsoft Clarity/)).toBeInTheDocument();
  });

  it('keeps the generic banner text for stores without Clarity', async () => {
    renderTracking();
    await screen.findByRole('dialog');
    expect(screen.queryByText(/Microsoft Clarity/)).toBeNull();
  });

  it('gives "Reject" the same visual weight as "Accept all"', async () => {
    renderTracking({ tracking: withClarity });
    const accept = await screen.findByRole('button', { name: 'Accept all' });
    const reject = screen.getByRole('button', { name: 'Reject' });
    expect(reject.className).toBe(accept.className);
    expect(reject.getAttribute('style')).toBe(accept.getAttribute('style'));
  });

  it('reject loads nothing', async () => {
    renderTracking({ tracking: withClarity });
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    await screen.findByRole('button', { name: 'Cookie settings' });
    expect(clarityTags()).toHaveLength(0);
    expect(clarity).not.toHaveBeenCalled();
  });

  it('accept mounts the loader and sends consentv2 (analytics granted, ads denied)', async () => {
    renderTracking({ tracking: withClarity });
    fireEvent.click(await screen.findByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    const inline = clarityTags()[0].getAttribute('data-inline') ?? '';
    expect(inline).toContain('"sxtuobatm6"');
    expect(inline).toContain('https://www.clarity.ms/tag/');
    expect(calls(clarity, 'consentv2')).toEqual([
      ['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }],
    ]);
    expect(getActiveTrackers().clarity).toBe(true);
    // GA4 keeps its own tags.
    expect(screen.getAllByTestId('tracker').map((s) => s.id)).toEqual(['ms-ga4-src', 'ms-ga4-init', 'ms-clarity']);
  });

  it('defines the command queue itself when the loader has not run yet', async () => {
    delete window.clarity;
    renderTracking({ tracking: withClarity });
    fireEvent.click(await screen.findByRole('button', { name: 'Accept all' }));
    await waitFor(() =>
      expect(window.clarity?.q).toEqual([['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }]]),
    );
  });

  it('stays gated when the store does not require consent (other tags load at once)', async () => {
    renderTracking({ tracking: { ...withClarity, consent_required: false } });
    await screen.findByRole('dialog');
    expect(screen.getAllByTestId('tracker').map((s) => s.id)).toEqual(['ms-ga4-src', 'ms-ga4-init']);
    expect(clarity).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
  });

  it('withdrawal sends denied + consent(false) to Clarity, denied to GA4, then reloads', async () => {
    seedGranted();
    renderTracking({ tracking: withClarity });
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }));
    await screen.findByRole('dialog');
    expect(calls(clarity, 'consentv2').at(-1)).toEqual([
      'consentv2',
      { ad_Storage: 'denied', analytics_Storage: 'denied' },
    ]);
    expect(calls(clarity, 'consent')).toEqual([['consent', false]]);
    expect(gtag).toHaveBeenCalledWith('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });
    expect(reloadPage).toHaveBeenCalledTimes(1);
    expect(clarityTags()).toHaveLength(0);
    expect(getActiveTrackers().clarity).toBe(false);
  });

  it('withdrawal on a store without consent_required leaves GA4 consent alone', async () => {
    seedGranted();
    renderTracking({ tracking: { ...withClarity, consent_required: false } });
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    gtag.mockClear();
    clearConsent(SLUG);
    await screen.findByRole('dialog');
    expect(calls(clarity, 'consent')).toEqual([['consent', false]]);
    expect(gtag).not.toHaveBeenCalled();
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('withdrawal on a GA4-only store updates GA4 and reloads (the tag ran in this document)', async () => {
    delete window.clarity;
    seedGranted();
    renderTracking();
    await waitFor(() => expect(screen.getAllByTestId('tracker')).toHaveLength(2));
    clearConsent(SLUG);
    await screen.findByRole('dialog');
    expect(gtag).toHaveBeenCalledWith('consent', 'update', expect.objectContaining({ analytics_storage: 'denied' }));
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('withdrawal revokes an executed Meta pixel and TikTok pixel and reloads, without Clarity', async () => {
    delete window.clarity;
    delete window.gtag;
    const fbq = vi.fn();
    const revokeConsent = vi.fn();
    window.fbq = fbq;
    window.ttq = { revokeConsent };
    try {
      seedGranted();
      renderTracking({ tracking: { ...tracking, ga4_measurement_id: null, meta_pixel_id: '1234567890', tiktok_pixel_id: 'C1234567890' } });
      await waitFor(() => expect(screen.getAllByTestId('tracker').length).toBeGreaterThan(0));
      clearConsent(SLUG);
      await screen.findByRole('dialog');
      expect(fbq).toHaveBeenCalledWith('consent', 'revoke');
      expect(revokeConsent).toHaveBeenCalled();
      expect(reloadPage).toHaveBeenCalledTimes(1);
    } finally {
      delete window.fbq;
      delete window.ttq;
    }
  });

  it('a withdrawal in another tab (storage event) stops this tab too', async () => {
    seedGranted();
    renderTracking({ tracking: withClarity });
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    // The other tab wrote "denied" to the shared localStorage.
    window.localStorage.setItem(consentStorageKey(SLUG), JSON.stringify({ choice: 'denied', at: Date.now(), v: CONSENT_VERSION }));
    window.dispatchEvent(new StorageEvent('storage', { key: consentStorageKey(SLUG) }));
    await waitFor(() => expect(calls(clarity, 'consent')).toEqual([['consent', false]]));
    expect(reloadPage).toHaveBeenCalledTimes(1);
    expect(clarityTags()).toHaveLength(0);
  });

  it('a client navigation onto an excluded route stops the running Clarity and reloads', async () => {
    seedGranted();
    const view = renderTracking({ tracking: withClarity });
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    expect(reloadPage).not.toHaveBeenCalled();
    nav.segments = ['account'];
    view.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <StoreTracking storeSlug={SLUG} tracking={withClarity} />
      </NextIntlClientProvider>,
    );
    await waitFor(() => expect(reloadPage).toHaveBeenCalledTimes(1));
    expect(calls(clarity, 'stop')).toEqual([['stop']]);
    expect(clarityTags()).toHaveLength(0);
  });

  it('turns a link to an excluded route into a full page load while Clarity runs', async () => {
    seedGranted();
    renderTracking({ tracking: withClarity });
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, href: original.href, origin: original.origin, assign } });
    try {
      const a = document.createElement('a');
      a.href = '/store/namez/account/orders';
      document.body.appendChild(a);
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      a.dispatchEvent(clickEvent);
      expect(clickEvent.defaultPrevented).toBe(true);
      expect(assign).toHaveBeenCalledWith(expect.stringContaining('/store/namez/account/orders'));
      // An allowed route stays a client navigation.
      const b = document.createElement('a');
      b.href = '/store/namez/products/mug';
      document.body.appendChild(b);
      const other = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      b.dispatchEvent(other);
      expect(other.defaultPrevented).toBe(false);
      a.remove();
      b.remove();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('a store without consent_required names only the recordings in the banner', async () => {
    renderTracking({ tracking: { ...withClarity, consent_required: false } });
    await screen.findByRole('dialog');
    expect(screen.getByText(/Clarity is loaded only if you accept/)).toBeInTheDocument();
    expect(screen.queryByText(/marketing/)).toBeNull();
  });

  it('a store without Clarity keeps honouring a choice made before v2 (no re-prompt)', async () => {
    delete window.clarity;
    window.localStorage.setItem(consentStorageKey(SLUG), JSON.stringify({ choice: 'granted', at: Date.now() }));
    renderTracking();
    await waitFor(() => expect(screen.getAllByTestId('tracker')).toHaveLength(2));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('re-accept in the same tab sends consentv2 + the GA4 update again', async () => {
    renderTracking({ tracking: withClarity });
    fireEvent.click(await screen.findByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    clearConsent(SLUG); // withdrawal (the reload is mocked, so the tab lives on)
    await screen.findByRole('dialog');
    gtag.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    expect(calls(clarity, 'consentv2').at(-1)).toEqual([
      'consentv2',
      { ad_Storage: 'denied', analytics_Storage: 'granted' },
    ]);
    expect(gtag).toHaveBeenCalledWith('consent', 'update', expect.objectContaining({ analytics_storage: 'granted' }));
  });

  it('"Reject -> Cookie settings -> Accept" loads Clarity exactly once, without a reload', async () => {
    renderTracking({ tracking: withClarity });
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cookie settings' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    expect(calls(clarity, 'consentv2')).toHaveLength(1);
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it.each([
    [['account']],
    [['account', 'orders']],
    [['auth', 'login']],
    [['(checkout)', 'checkout', 'confirmation']],
    [['(checkout)', 'checkout', 'kustom', 'confirmation']],
  ])('never loads on %j', async (segments) => {
    // A fresh document on the excluded route: no Clarity has run in it.
    delete window.clarity;
    nav.segments = segments;
    seedGranted();
    renderTracking({ tracking: withClarity });
    await waitFor(() => expect(screen.getAllByTestId('tracker').length).toBeGreaterThan(0));
    expect(clarityTags()).toHaveLength(0);
    expect(clarity).not.toHaveBeenCalled();
    expect(window.clarity).toBeUndefined();
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('loads on the checkout itself (masked by the checkout layout)', async () => {
    nav.segments = ['(checkout)', 'checkout'];
    seedGranted();
    renderTracking({ tracking: withClarity });
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
  });

  it('a choice saved before Clarity (no / older version) shows the banner again', async () => {
    window.localStorage.setItem(consentStorageKey(SLUG), JSON.stringify({ choice: 'granted', at: Date.now() }));
    document.cookie = `${COOKIE}=granted; path=/`;
    renderTracking({ tracking: withClarity });
    await screen.findByRole('dialog');
    expect(screen.queryAllByTestId('tracker')).toHaveLength(0);
    expect(clarity).not.toHaveBeenCalled();
  });

  it('writeConsent stores the current version (cookie + localStorage)', () => {
    writeConsent(SLUG, 'granted');
    expect(document.cookie).toContain(`${COOKIE}=granted.${CONSENT_VERSION}`);
  });
});
