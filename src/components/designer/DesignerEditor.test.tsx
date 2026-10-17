import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignerPayload, UploadPhotoResult } from '@/lib/designer/api';
import { fetchRouter, jsonResponse, makeView, memoryStorage, SPEC } from '@/test/designer-fixtures';

// Upload stub shared with the api mock below: it never resolves on its own,
// the test aborts it or lets it fail.
const h = vi.hoisted(() => ({
  uploads: [] as { signal?: AbortSignal; reject: (e: unknown) => void; resolve: (r: unknown) => void }[],
}));

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => false;
    return t;
  },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ token: null, loading: false }) }));
vi.mock('@/hooks/useCart', () => ({
  useCart: () => ({ items: [], refreshDesignLine: vi.fn(), replaceDesignLine: vi.fn() }),
}));
vi.mock('@/lib/designer/api', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/designer/api')>();
  return {
    ...orig,
    createDesignerClient: (o: Parameters<typeof orig.createDesignerClient>[0]) => {
      const router = fetchRouter({
        'POST /designs': ({ body }) =>
          jsonResponse(201, { data: { ...makeView({ state: (body as { state: never }).state, state_version: 1 }), token: 'tok' } }),
        'PATCH /designs/d1': () => jsonResponse(200, { data: makeView({ state_version: 2 }) }),
      });
      const client = orig.createDesignerClient({ ...o, fetchImpl: router.impl, storage: memoryStorage(), apiUrl: 'http://api.test/api' });
      client.uploadPhoto = (_id, _el, _file, _progress, signal) =>
        new Promise<UploadPhotoResult>((resolve, reject) => {
          h.uploads.push({ signal, reject, resolve: resolve as (r: unknown) => void });
          signal?.addEventListener('abort', () => reject(new orig.DesignerApiError(0, null)), { once: true });
        });
      return client;
    },
  };
});

import DesignerEditor from './DesignerEditor';

const payload: DesignerPayload = {
  template_id: 't1',
  template_version_id: 'v1',
  spec_public: SPEC,
  fonts: [],
  settings: { max_upload_mb: 25, min_effective_dpi_warning: 100 },
};

function renderEditor(onClose = vi.fn()) {
  const host = document.createElement('div');
  host.id = 'host';
  document.body.appendChild(host);
  const utils = render(
    <DesignerEditor
      payload={payload}
      productId="p1"
      storeSlug="shop"
      locale="en"
      productTitle="Sign"
      initialDesignId={null}
      onClose={onClose}
      onAddToCart={async () => undefined}
    />,
    { container: host },
  );
  return { ...utils, host };
}

describe('DesignerEditor dialog', () => {
  beforeEach(() => {
    h.uploads.length = 0;
    window.localStorage.clear();
  });
  afterEach(() => {
    document.getElementById('host')?.remove();
  });

  it('renders on document.body (portal) and locks the page scroll while open (D7, D15)', async () => {
    const { host, unmount } = renderEditor();
    const dialog = await screen.findByRole('dialog');
    expect(host.contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.className).toContain('overscroll-contain');
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.overflow).toBe('hidden');
    // Focus starts on the close button, inside the portal.
    expect(screen.getByRole('button', { name: 'close' })).toHaveFocus();
    unmount();
    expect(document.body.style.position).toBe('');
    expect(document.body.style.overflow).toBe('');
  });

  it('Escape closes and Tab wraps inside the dialog (D30)', async () => {
    const onClose = vi.fn();
    renderEditor(onClose);
    const dialog = await screen.findByRole('dialog');
    const first = screen.getByRole('button', { name: 'close' });
    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).not.toBe(first);
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cancels a running upload and offers "try again" with the same file after a failure (D14)', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByRole('dialog');
    const input = document.getElementById('designer-slot-photo-file') as HTMLInputElement;
    const file = new File(['abc'], 'me.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    await waitFor(() => expect(h.uploads).toHaveLength(1));
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    // Cancel: the signal aborts, the progress row goes away, no error is shown.
    await user.click(screen.getByRole('button', { name: /cancelUpload/ }));
    expect(h.uploads[0]!.signal?.aborted).toBe(true);
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: /tryAgain/ })).toBeNull();

    // A failing upload keeps the picked file for "try again".
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    await waitFor(() => expect(h.uploads).toHaveLength(2));
    const { DesignerApiError } = await import('@/lib/designer/api');
    await act(async () => {
      h.uploads[1]!.reject(new DesignerApiError(0, null));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('uploadFailed');
    await user.click(screen.getByRole('button', { name: /tryAgain/ }));
    await waitFor(() => expect(h.uploads).toHaveLength(3));
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
