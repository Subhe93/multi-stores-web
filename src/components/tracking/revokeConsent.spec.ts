// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { revokeConsentCategories } from './clarity';
import { reloadPage } from './pageReload';

// Withdrawal of a category (plans/consent-v2/CONTRACT.md §7.1): Google's ad
// cookies belong to the marketing purpose, so they go on a marketing
// withdrawal even while GA4 keeps running under analytics.

vi.mock('./pageReload', () => ({ reloadPage: vi.fn() }));

function cookieNames(): string[] {
  return document.cookie
    .split(';')
    .map((c) => c.split('=')[0]?.trim() ?? '')
    .filter(Boolean);
}

function clearAllCookies() {
  for (const name of cookieNames()) document.cookie = `${name}=; max-age=0; path=/`;
}

beforeEach(() => {
  clearAllCookies();
  document.cookie = '_ga=GA1.1.1; path=/';
  document.cookie = '_gcl_au=1.1.1; path=/';
  document.cookie = '_fbp=fb.1.1; path=/';
  window.gtag = vi.fn();
});

afterEach(() => {
  clearAllCookies();
  delete window.gtag;
  delete window.fbq;
  vi.mocked(reloadPage).mockClear();
});

describe('revokeConsentCategories', () => {
  it('marketing withdrawn, analytics kept: ad signals denied, _gcl_* cleared, _ga kept, no reload without a pixel', () => {
    const ran = revokeConsentCategories({ analytics: false, marketing: true, gated: ['ga4', 'meta'] });
    expect(window.gtag).toHaveBeenCalledWith('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    expect(cookieNames()).not.toContain('_gcl_au');
    expect(cookieNames()).not.toContain('_fbp');
    expect(cookieNames()).toContain('_ga');
    expect(ran).toBe(false);
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('analytics withdrawn: GA4 and its ad cookies go, and the page reloads', () => {
    const ran = revokeConsentCategories({ analytics: true, marketing: false, gated: ['ga4'] });
    expect(cookieNames()).not.toContain('_ga');
    expect(cookieNames()).not.toContain('_gcl_au');
    expect(ran).toBe(true);
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('an ungated GA4 (consent_required = false) keeps its cookies', () => {
    revokeConsentCategories({ analytics: false, marketing: true, gated: ['meta'] });
    expect(cookieNames()).toContain('_gcl_au');
    expect(window.gtag).not.toHaveBeenCalled();
  });
});
