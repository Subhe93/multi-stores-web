import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorePreviewUnlock } from './StorePreviewUnlock';
import { EDIT_HINT_STORAGE_KEY } from '@/components/edit-hint/editHintStorage';
import { STORE_PREVIEW_COOKIE } from '@/lib/storeGate';

// The gate page ("Coming soon") unlock: the dashboard's "visit store" link
// lands here with `#ms_edit=<token>` for a DRAFT store, where the Edit
// button (which normally consumes the fragment) is not mounted. The unlock
// must take the token itself, try it on the preview endpoint and, when
// accepted, bind it to the slug in the preview cookie and reload.

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdG9yZV9pZCI6InMifQ.c2lnbmF0dXJl';

const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.cookie = `${STORE_PREVIEW_COOKIE}=; Max-Age=0; Path=/`;
  window.history.replaceState(null, '', '/');
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: vi.fn(), href: window.location.href, protocol: 'http:' },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('StorePreviewUnlock', () => {
  it('a visitor without a token: no request, no cookie', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<StorePreviewUnlock storeSlug="namez-se" />);
    await settle();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain(STORE_PREVIEW_COOKIE);
  });

  it('consumes the dashboard hand-off fragment and unlocks with that token', async () => {
    window.history.replaceState(null, '', `/#ms_edit=${JWT}`);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: vi.fn(), href: `http://shop.test/#ms_edit=${JWT}`, protocol: 'http:' },
    });
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    render(<StorePreviewUnlock storeSlug="namez-se" />);
    await settle();
    // Fragment moved to localStorage, then tried on the preview endpoint.
    expect(window.localStorage.getItem(EDIT_HINT_STORAGE_KEY)).toBe(JWT);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/storefront\/namez-se\/preview$/);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${JWT}`);
    expect(document.cookie).toContain(`${STORE_PREVIEW_COOKIE}=${encodeURIComponent(`namez-se:${JWT}`)}`);
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('a refused token sets no cookie and does not reload', async () => {
    window.localStorage.setItem(EDIT_HINT_STORAGE_KEY, JWT);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
    render(<StorePreviewUnlock storeSlug="namez-se" />);
    await settle();
    expect(document.cookie).not.toContain(STORE_PREVIEW_COOKIE);
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});
