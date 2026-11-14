import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/i18n/messages/en.json';
import {
  CONSENT_MAX_AGE_MS,
  __clearConsentForTests,
  getActiveTrackers,
  grantExternalMediaConsent,
  isMetaPixelActive,
  openConsentSettings,
  readConsentRecord,
  saveTrackingChoice,
  type StoreTracking as StoreTrackingIds,
} from '@/lib/consent';
import { logConsent } from '@/lib/consentLog';
import { reloadPage } from './pageReload';
import { StoreTracking } from './StoreTracking';

// Consent v2 manager (plans/consent-v2/CONTRACT.md §7.1, §9 web-core):
// categories, first-layer banner, settings dialog, re-open entry points,
// per-category vendor loading and withdrawal.

const nav = vi.hoisted(() => ({ segments: [] as string[] }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSelectedLayoutSegments: () => nav.segments,
}));
vi.mock('./pageReload', () => ({ reloadPage: vi.fn() }));
vi.mock('@/lib/consentLog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/consentLog')>();
  return { ...actual, logConsent: vi.fn() };
});
// next/script defers real loading; a plain <script> stand-in lets the test
// assert on what would be mounted.
vi.mock('next/script', () => ({
  default: ({ id, src, children }: { id?: string; src?: string; children?: string }) => (
    <script data-testid="tracker" id={id} data-src={src} data-inline={children} />
  ),
}));

const SLUG = 'namez';
const GA4_ONLY: StoreTrackingIds = {
  ga4_measurement_id: 'G-ABCD1234',
  meta_pixel_id: null,
  tiktok_pixel_id: null,
  consent_required: true,
};
const FULL: StoreTrackingIds = {
  ga4_measurement_id: 'G-ABCD1234',
  meta_pixel_id: '1234567890',
  tiktok_pixel_id: 'C1234567890',
  clarity_project_id: 'sxtuobatm6',
  consent_required: true,
};
const NONE: StoreTrackingIds = { ga4_measurement_id: null, meta_pixel_id: null, tiktok_pixel_id: null, consent_required: true };
const META = { action: 'save' as const, source: 'dialog' as const, textHash: 'unavailable', locale: 'en' };

type Props = Partial<React.ComponentProps<typeof StoreTracking>>;
function tree(props: Props = {}) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <StoreTracking storeSlug={SLUG} tracking={FULL} {...props} />
    </NextIntlClientProvider>
  );
}
const renderTracking = (props: Props = {}) => render(tree(props));

const trackerIds = () => screen.queryAllByTestId('tracker').map((s) => s.id);
const clarityTags = () => screen.queryAllByTestId('tracker').filter((s) => s.id === 'ms-clarity');
const banner = () => screen.queryByTestId('consent-banner');
const dialog = () => screen.queryByRole('dialog');
const seed = (choice: { analytics: boolean; marketing: boolean; external_media?: boolean }, t: StoreTrackingIds = FULL) =>
  saveTrackingChoice(SLUG, choice, t, META);

let clarity: ReturnType<typeof vi.fn>;
let gtag: ReturnType<typeof vi.fn>;
const calls = (fn: ReturnType<typeof vi.fn>, method: string) => fn.mock.calls.filter((c) => c[0] === method);

function resetAll() {
  __clearConsentForTests(SLUG);
  window.localStorage.clear();
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; max-age=0; path=/`;
  });
}

beforeEach(() => {
  resetAll();
  nav.segments = [];
  vi.mocked(reloadPage).mockClear();
  vi.mocked(logConsent).mockClear();
  // Stand-ins for the vendor globals (the real snippets never run in jsdom).
  clarity = vi.fn();
  gtag = vi.fn();
  window.clarity = clarity as unknown as typeof window.clarity;
  window.gtag = gtag;
});
afterEach(() => {
  delete window.clarity;
  delete window.gtag;
  delete window.fbq;
  delete window.ttq;
  resetAll();
  window.history.replaceState(null, '', '/');
});

describe('StoreTracking: banner', () => {
  it('shows no banner for a store without gated trackers', async () => {
    renderTracking({ tracking: NONE });
    await act(async () => {});
    expect(banner()).toBeNull();
    expect(trackerIds()).toEqual([]);
  });

  it('shows no banner when consent is not required and no Clarity (all ungated)', async () => {
    renderTracking({ tracking: { ...GA4_ONLY, consent_required: false } });
    await waitFor(() => expect(trackerIds()).toEqual(['ms-ga4-src', 'ms-ga4-init']));
    expect(banner()).toBeNull();
  });

  it('shows the banner with gated vendors and loads nothing before a choice', async () => {
    renderTracking({ cookiePolicyHref: '/om-cookies' });
    expect(await screen.findByTestId('consent-banner')).toBeInTheDocument();
    expect(trackerIds()).toEqual([]);
    expect(clarity).not.toHaveBeenCalled();
    expect(getActiveTrackers().clarity).toBe(false);
  });

  it('"Accept all" mounts GA4 + Meta + TikTok + Clarity and allows external media', async () => {
    renderTracking();
    fireEvent.click(await screen.findByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    expect(trackerIds()).toEqual(['ms-ga4-src', 'ms-ga4-init', 'ms-meta-pixel', 'ms-tiktok-pixel', 'ms-clarity']);
    expect(banner()).toBeNull();
    const rec = readConsentRecord(SLUG);
    expect(rec?.tracking).toMatchObject({ analytics: true, marketing: true });
    expect(rec?.external?.granted).toBe(true);
    expect(vi.mocked(logConsent).mock.calls.at(-1)?.[2]).toMatchObject({ action: 'accept_all', source: 'banner', locale: 'en' });
    expect(calls(clarity, 'consentv2')).toEqual([['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }]]);
    expect(isMetaPixelActive()).toBe(true);
    const init = screen.getAllByTestId('tracker').find((s) => s.id === 'ms-ga4-init')?.getAttribute('data-inline') ?? '';
    expect(init).toContain("gtag('set','ads_data_redaction',true)");
    expect(init).toContain('"ad_storage":"granted"');
  });

  it('"Reject all" stores the refusal and loads nothing', async () => {
    renderTracking();
    fireEvent.click(await screen.findByRole('button', { name: 'Reject all' }));
    await waitFor(() => expect(banner()).toBeNull());
    expect(trackerIds()).toEqual([]);
    expect(readConsentRecord(SLUG)?.tracking).toMatchObject({ analytics: false, marketing: false });
    expect(readConsentRecord(SLUG)?.external?.granted).toBe(false);
    expect(vi.mocked(logConsent).mock.calls.at(-1)?.[2]).toMatchObject({ action: 'reject_all', source: 'banner' });
  });

  it('honours a stored decision without showing the banner', async () => {
    seed({ analytics: true, marketing: false });
    renderTracking({ tracking: GA4_ONLY });
    await waitFor(() => expect(trackerIds()).toEqual(['ms-ga4-src', 'ms-ga4-init']));
    expect(banner()).toBeNull();
  });

  it('asks again after 12 months', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 0, 1));
    seed({ analytics: true, marketing: true });
    vi.mocked(Date.now).mockReturnValue(Date.UTC(2026, 0, 1) + CONSENT_MAX_AGE_MS + 1000);
    renderTracking();
    expect(await screen.findByTestId('consent-banner')).toBeInTheDocument();
    expect(trackerIds()).toEqual([]);
    vi.restoreAllMocks();
  });

  it('migrates a v2 "granted" choice without a banner (D7)', async () => {
    window.localStorage.setItem(`consent:${SLUG}`, JSON.stringify({ choice: 'granted', at: Date.now(), v: 2 }));
    renderTracking();
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    expect(banner()).toBeNull();
    expect(vi.mocked(logConsent).mock.calls.map((c) => c[2].action)).toEqual(['migrated']);
  });
});

describe('StoreTracking: categories', () => {
  it('analytics only: GA4 + Clarity, no Meta/TikTok, GA4 ad_* denied', async () => {
    seed({ analytics: true, marketing: false });
    renderTracking();
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    expect(trackerIds()).toEqual(['ms-ga4-src', 'ms-ga4-init', 'ms-clarity']);
    const init = screen.getAllByTestId('tracker').find((s) => s.id === 'ms-ga4-init')?.getAttribute('data-inline') ?? '';
    expect(init).toContain('"analytics_storage":"granted","ad_storage":"denied","ad_user_data":"denied","ad_personalization":"denied"');
    expect(isMetaPixelActive()).toBe(false);
  });

  it('marketing only: Meta/TikTok, no Google tag, no Clarity', async () => {
    seed({ analytics: false, marketing: true });
    renderTracking();
    await waitFor(() => expect(trackerIds()).toEqual(['ms-meta-pixel', 'ms-tiktok-pixel']));
    expect(clarity).not.toHaveBeenCalled();
  });

  it('consent_required=false: GA4/Meta load at once, Clarity stays gated behind analytics', async () => {
    renderTracking({ tracking: { ...FULL, consent_required: false } });
    await waitFor(() => expect(trackerIds()).toEqual(['ms-ga4-src', 'ms-ga4-init', 'ms-meta-pixel', 'ms-tiktok-pixel']));
    expect(await screen.findByTestId('consent-banner')).toBeInTheDocument();
    expect(clarity).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
  });

  it('settings dialog: Analytics only -> Save choices', async () => {
    renderTracking();
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    const d = await screen.findByRole('dialog');
    // The banner stays mounted under the dialog, invisible and inert.
    expect(banner()).toHaveAttribute('aria-hidden', 'true');
    expect(banner()!.hasAttribute('inert')).toBe(true);
    fireEvent.click(within(d).getByTestId('consent-switch-analytics'));
    fireEvent.click(within(d).getByRole('button', { name: 'Save choices' }));
    await waitFor(() => expect(dialog()).toBeNull());
    await waitFor(() => expect(banner()).toBeNull());
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    expect(trackerIds()).not.toContain('ms-meta-pixel');
    expect(vi.mocked(logConsent).mock.calls.at(-1)?.[2]).toMatchObject({ action: 'save', source: 'dialog' });
  });

  it('closing the dialog without saving returns focus to the banner Settings button (no remount)', async () => {
    renderTracking();
    const settings = await screen.findByRole('button', { name: 'Settings' });
    settings.focus();
    fireEvent.click(settings);
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(dialog()).toBeNull());
    expect(banner()).not.toHaveAttribute('aria-hidden');
    expect(document.activeElement).toBe(settings);
  });
});

describe('StoreTracking: withdrawal', () => {
  it('withdrawing marketing revokes the executed pixels, clears their cookies and reloads', async () => {
    const fbq = vi.fn();
    const revokeConsent = vi.fn();
    window.fbq = fbq;
    window.ttq = { revokeConsent };
    seed({ analytics: true, marketing: true });
    document.cookie = '_fbp=fb.1.2; path=/';
    renderTracking();
    await waitFor(() => expect(trackerIds()).toContain('ms-meta-pixel'));
    gtag.mockClear();
    act(() => seed({ analytics: true, marketing: false }));
    await waitFor(() => expect(fbq).toHaveBeenCalledWith('consent', 'revoke'));
    expect(revokeConsent).toHaveBeenCalled();
    expect(gtag).toHaveBeenCalledWith('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    expect(document.cookie).not.toContain('_fbp=');
    expect(reloadPage).toHaveBeenCalledTimes(1);
    expect(trackerIds()).not.toContain('ms-meta-pixel');
    // Analytics untouched.
    expect(calls(clarity, 'consent')).toEqual([]);
  });

  it('withdrawing marketing that never ran a pixel does not reload', async () => {
    seed({ analytics: true, marketing: true });
    renderTracking();
    await waitFor(() => expect(trackerIds()).toContain('ms-meta-pixel'));
    act(() => seed({ analytics: true, marketing: false }));
    await waitFor(() => expect(trackerIds()).not.toContain('ms-meta-pixel'));
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('withdrawing analytics sends Clarity consentv2 denied + consent(false), GA4 denied, and reloads', async () => {
    seed({ analytics: true, marketing: false });
    document.cookie = '_ga=GA1.1.1; path=/';
    renderTracking();
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    act(() => seed({ analytics: false, marketing: false }));
    await waitFor(() => expect(calls(clarity, 'consent')).toEqual([['consent', false]]));
    expect(calls(clarity, 'consentv2').at(-1)).toEqual(['consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' }]);
    expect(gtag).toHaveBeenCalledWith('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });
    expect(document.cookie).not.toContain('_ga=');
    expect(reloadPage).toHaveBeenCalledTimes(1);
    expect(clarityTags()).toHaveLength(0);
    expect(getActiveTrackers().clarity).toBe(false);
  });

  it('withdrawing analytics on a store without consent_required leaves the ungated GA4 alone', async () => {
    const t = { ...FULL, consent_required: false };
    seed({ analytics: true, marketing: false }, t);
    renderTracking({ tracking: t });
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    gtag.mockClear();
    act(() => seed({ analytics: false, marketing: false }, t));
    await waitFor(() => expect(calls(clarity, 'consent')).toEqual([['consent', false]]));
    expect(gtag).not.toHaveBeenCalledWith('consent', 'update', expect.objectContaining({ analytics_storage: 'denied' }));
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('a withdrawal in another tab (storage event) stops this tab too', async () => {
    seed({ analytics: true, marketing: false });
    renderTracking();
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    const rec = readConsentRecord(SLUG)!;
    window.localStorage.setItem(
      `consent:${SLUG}`,
      JSON.stringify({ ...rec, tracking: { ...rec.tracking!, analytics: false, at: Date.now() } }),
    );
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: `consent:${SLUG}` }));
    });
    await waitFor(() => expect(calls(clarity, 'consent')).toEqual([['consent', false]]));
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('re-accept in the same tab re-sends consentv2 and the GA4 update', async () => {
    seed({ analytics: true, marketing: true });
    renderTracking();
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    act(() => seed({ analytics: false, marketing: false })); // reload is mocked: the tab lives on
    await waitFor(() => expect(clarityTags()).toHaveLength(0));
    gtag.mockClear();
    act(() => seed({ analytics: true, marketing: false }));
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    expect(calls(clarity, 'consentv2').at(-1)).toEqual(['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }]);
    expect(gtag).toHaveBeenCalledWith('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });

  it('"Reject all -> Cookie settings -> Accept all" loads Clarity exactly once, without a reload', async () => {
    renderTracking();
    fireEvent.click(await screen.findByRole('button', { name: 'Reject all' }));
    fireEvent.click(await screen.findByTestId('consent-launcher'));
    const d = await screen.findByRole('dialog');
    fireEvent.click(within(d).getByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    expect(calls(clarity, 'consentv2')).toHaveLength(1);
    expect(reloadPage).not.toHaveBeenCalled();
  });
});

describe('StoreTracking: re-open', () => {
  it('the pill opens the dialog with the current choices and never clears', async () => {
    seed({ analytics: true, marketing: false });
    renderTracking();
    fireEvent.click(await screen.findByTestId('consent-launcher'));
    const d = await screen.findByRole('dialog');
    expect(within(d).getByTestId('consent-switch-analytics')).toHaveAttribute('aria-checked', 'true');
    expect(within(d).getByTestId('consent-switch-marketing')).toHaveAttribute('aria-checked', 'false');
    expect(readConsentRecord(SLUG)?.tracking?.analytics).toBe(true);
    expect(reloadPage).not.toHaveBeenCalled();
    expect(screen.queryByTestId('consent-launcher')).toBeNull();
  });

  it('openConsentSettings() (footer link) opens the dialog', async () => {
    renderTracking();
    await screen.findByTestId('consent-banner');
    act(() => openConsentSettings());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('a #cookie-settings link click opens the dialog', async () => {
    renderTracking();
    await screen.findByTestId('consent-banner');
    const a = document.createElement('a');
    a.href = '/om-cookies#cookie-settings';
    document.body.appendChild(a);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    act(() => {
      a.dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    a.remove();
  });

  it('a URL arriving with #cookie-settings opens the dialog and drops the hash', async () => {
    window.history.replaceState(null, '', '/products/mug#cookie-settings');
    renderTracking();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/products/mug');
  });

  it('the launcher is hidden on checkout routes', async () => {
    seed({ analytics: false, marketing: false });
    nav.segments = ['(checkout)', 'checkout'];
    renderTracking();
    await act(async () => {});
    expect(screen.queryByTestId('consent-launcher')).toBeNull();
    expect(banner()).toBeNull();
  });

  it('a store without trackers: no banner; the dialog only offers external media', async () => {
    renderTracking({ tracking: NONE });
    await act(async () => {});
    expect(banner()).toBeNull();
    expect(screen.queryByTestId('consent-launcher')).toBeNull();
    act(() => openConsentSettings());
    const d = await screen.findByRole('dialog');
    expect(within(d).queryByTestId('consent-switch-analytics')).toBeNull();
    expect(within(d).queryByTestId('consent-switch-marketing')).toBeNull();
    fireEvent.click(within(d).getByTestId('consent-switch-external_media'));
    fireEvent.click(within(d).getByRole('button', { name: 'Save choices' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(readConsentRecord(SLUG)?.external?.granted).toBe(true);
    expect(readConsentRecord(SLUG)?.tracking).toBeNull();
    expect(vi.mocked(logConsent).mock.calls.at(-1)?.[2]).toMatchObject({ action: 'external_media_grant', source: 'dialog' });
    // The external grant shows the desktop launcher.
    expect(await screen.findByTestId('consent-launcher')).toBeInTheDocument();
  });

  it('a facade grant on a store without trackers shows the launcher', async () => {
    renderTracking({ tracking: null });
    await act(async () => {});
    expect(screen.queryByTestId('consent-launcher')).toBeNull();
    act(() => grantExternalMediaConsent(SLUG));
    expect(await screen.findByTestId('consent-launcher')).toBeInTheDocument();
  });
});

describe('StoreTracking: Microsoft Clarity routes', () => {
  it('a client navigation onto an excluded route stops the running Clarity and reloads', async () => {
    seed({ analytics: true, marketing: false });
    const view = renderTracking();
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    expect(reloadPage).not.toHaveBeenCalled();
    nav.segments = ['account'];
    view.rerender(tree());
    await waitFor(() => expect(reloadPage).toHaveBeenCalledTimes(1));
    expect(calls(clarity, 'stop')).toEqual([['stop']]);
    expect(clarityTags()).toHaveLength(0);
  });

  it('turns a link to an excluded route into a full page load while Clarity runs', async () => {
    seed({ analytics: true, marketing: false });
    renderTracking();
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, href: original.href, origin: original.origin, hash: '', assign },
    });
    try {
      const a = document.createElement('a');
      a.href = '/store/namez/account/orders';
      document.body.appendChild(a);
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      a.dispatchEvent(clickEvent);
      expect(clickEvent.defaultPrevented).toBe(true);
      expect(assign).toHaveBeenCalledWith(expect.stringContaining('/store/namez/account/orders'));
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
    seed({ analytics: true, marketing: false });
    renderTracking();
    await waitFor(() => expect(trackerIds().length).toBeGreaterThan(0));
    expect(clarityTags()).toHaveLength(0);
    expect(window.clarity).toBeUndefined();
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('loads on the checkout itself (masked by the checkout layout)', async () => {
    nav.segments = ['(checkout)', 'checkout'];
    seed({ analytics: true, marketing: false });
    renderTracking();
    await waitFor(() => expect(clarityTags()).toHaveLength(1));
  });

  it('defines the command queue itself when the loader has not run yet', async () => {
    delete window.clarity;
    seed({ analytics: true, marketing: false });
    renderTracking();
    await waitFor(() =>
      expect(window.clarity?.q).toEqual([['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }]]),
    );
  });
});

describe('StoreTracking: bundle', () => {
  it('loads the banner and the dialog as lazy chunks, never as static imports', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/tracking/StoreTracking.tsx'), 'utf8');
    expect(src).not.toMatch(/^import \{[^}]*CookieBanner[^}]*\} from '\.\/CookieBanner';/m);
    expect(src).not.toMatch(/^import \{[^}]*CookieSettingsDialog[^}]*\} from '\.\/CookieSettingsDialog';/m);
    expect(src).toContain("lazy(() => import('./CookieBanner')");
    expect(src).toContain("import('./CookieSettingsDialog')");
  });
});
