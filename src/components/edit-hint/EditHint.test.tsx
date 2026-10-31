import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditHintBoot } from './EditHintBoot';
import { EDIT_HINT_DISMISSED_KEY, EDIT_HINT_STORAGE_KEY } from './editHintStorage';

// The owner "Edit" button: visitors (no stored token) get no request and no
// button; the owner gets a link to the dashboard page the API resolves; a
// 401 forgets the token.

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/store/namez-se/products/mug',
}));

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdG9yZV9pZCI6InMifQ.c2lnbmF0dXJl';

function okResponse(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), { status: 200 });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/products/mug');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('EditHintBoot', () => {
  it('a visitor without a token: no fetch, no button', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { container } = render(<EditHintBoot storeSlug="namez-se" />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('takes the hand-off token from the fragment and strips it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ edit_url: null, label_kind: null })));
    window.history.replaceState(null, '', `/products/mug?x=1#ms_edit=${JWT}`);
    render(<EditHintBoot storeSlug="namez-se" />);
    expect(window.localStorage.getItem(EDIT_HINT_STORAGE_KEY)).toBe(JWT);
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?x=1');
  });

  it('owner: shows the resolved edit link with the bearer token', async () => {
    window.localStorage.setItem(EDIT_HINT_STORAGE_KEY, JWT);
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(okResponse({ edit_url: 'https://dash.test/creator/products/own/p1', label_kind: 'product' }));
    vi.stubGlobal('fetch', fetchSpy);
    render(<EditHintBoot storeSlug="namez-se" />);
    const link = await screen.findByRole('link', { name: 'editHint.editProduct' });
    expect(link).toHaveAttribute('href', 'https://dash.test/creator/products/own/p1');
    expect(link).toHaveAttribute('target', '_blank');
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/storefront/namez-se/edit-target?path=%2Fproducts%2Fmug');
    expect(url).not.toContain(JWT);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${JWT}`);
  });

  it('a 401 forgets the token and shows nothing', async () => {
    // Another path: answers are cached per pathname for the page session.
    window.history.replaceState(null, '', '/collections/a');
    window.localStorage.setItem(EDIT_HINT_STORAGE_KEY, JWT);
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchSpy);
    const { container } = render(<EditHintBoot storeSlug="namez-se" />);
    await waitFor(() => expect(window.localStorage.getItem(EDIT_HINT_STORAGE_KEY)).toBeNull());
    expect(container).toBeEmptyDOMElement();
  });

  it('dismissed for the session: no request', async () => {
    window.localStorage.setItem(EDIT_HINT_STORAGE_KEY, JWT);
    window.sessionStorage.setItem(EDIT_HINT_DISMISSED_KEY, '1');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<EditHintBoot storeSlug="namez-se" />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
