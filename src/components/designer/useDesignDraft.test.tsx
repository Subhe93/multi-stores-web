import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignerApiError, type DesignerClient, type UploadPhotoResult } from '@/lib/designer/api';
import { fetchRouter, jsonResponse, makeClient, makeView, SPEC } from '@/test/designer-fixtures';
import { AUTOSAVE_DELAY_MS, useDesignDraft } from './useDesignDraft';

const PATCH = 'PATCH /designs/d1';
const GET = 'GET /designs/d1';
const CREATE = 'POST /designs';

function setup(client: DesignerClient | null, initialDesignId: string | null = 'd1') {
  return renderHook(
    ({ client: c }: { client: DesignerClient | null }) =>
      useDesignDraft({ client: c, productId: 'p1', templateVersionId: 'v1', spec: SPEC, initialDesignId }),
    { initialProps: { client } },
  );
}

async function tick(ms = AUTOSAVE_DELAY_MS) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Lets pending requests / effects settle (microtasks only, no timers). */
async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }
}

describe('useDesignDraft', () => {
  beforeEach(() => {
    // Only the autosave timer is faked; promises and microtasks run for real.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('M5.6: the back round-trips (resume → edit → PATCH `back` once → server answer kept; null clears)', async () => {
    const OTHER = { mode: 'other' as const, template_id: 't2', template_version_id: 'v2', state: { v: 1 as const, texts: { greeting: 'Hej' }, photos: {} } };
    // The server keeps the stored back and echoes it in every view.
    let stored: unknown = { mode: 'same' };
    const router = fetchRouter({
      [GET]: () => jsonResponse(200, { data: { ...makeView({ state_version: 3 }), back: stored } }),
      [PATCH]: ({ body }) => {
        const b = body as { state: never; back?: unknown };
        if (b.back !== undefined) stored = b.back;
        return jsonResponse(200, { data: { ...makeView({ state: b.state, state_version: 4 }), ...(stored ? { back: stored } : {}) } });
      },
    });
    const { result } = setup(makeClient(router.impl));
    await flush();
    expect(result.current.back).toEqual({ mode: 'same' });
    act(() => result.current.setBack(OTHER));
    expect(result.current.back).toEqual(OTHER);
    act(() => result.current.setBackText('greeting', 'Hej då'));
    await tick();
    await flush();
    const patches = router.calls.filter((c) => c.method === 'PATCH');
    expect(patches).toHaveLength(1);
    expect(patches[0]!.body).toEqual({
      state: { v: 1, texts: {}, photos: {} },
      state_version: 3,
      back: { ...OTHER, state: { v: 1, texts: { greeting: 'Hej då' }, photos: {} } },
    });
    expect(result.current.back).toEqual({ ...OTHER, state: { v: 1, texts: { greeting: 'Hej då' }, photos: {} } });
    // A text edit alone sends no `back` (unchanged = kept).
    act(() => result.current.setText('name', 'Anna'));
    await tick();
    await flush();
    expect((router.calls.filter((c) => c.method === 'PATCH')[1]!.body as { back?: unknown }).back).toBeUndefined();
    // Clearing sends `back: null`.
    act(() => result.current.setBack(null));
    await tick();
    await flush();
    expect((router.calls.filter((c) => c.method === 'PATCH')[2]!.body as { back?: unknown }).back).toBeNull();
    expect(result.current.back).toBeNull();
  });

  it('M5.6: "Annan mall" without a picked template is never sent; the pick goes out once made', async () => {
    let stored: unknown = { mode: 'same' };
    const router = fetchRouter({
      [GET]: () => jsonResponse(200, { data: { ...makeView({ state_version: 3 }), back: stored } }),
      [PATCH]: ({ body }) => {
        const b = body as { state: never; back?: unknown };
        if (b.back !== undefined) stored = b.back;
        return jsonResponse(200, { data: { ...makeView({ state: b.state, state_version: 4 }), ...(stored ? { back: stored } : {}) } });
      },
    });
    const { result } = setup(makeClient(router.impl));
    await flush();
    const PENDING = { mode: 'other' as const, template_id: '', template_version_id: '', state: { v: 1 as const, texts: {}, photos: {} } };
    act(() => result.current.setBack(PENDING));
    // Another edit flushes a PATCH: the pending pick is left out (the server
    // would answer 400) and the server's 'same' does not override the UI.
    act(() => result.current.setText('name', 'Anna'));
    await tick();
    await flush();
    const patches = router.calls.filter((c) => c.method === 'PATCH');
    expect(patches).toHaveLength(1);
    expect((patches[0]!.body as { back?: unknown }).back).toBeUndefined();
    expect(result.current.back).toEqual(PENDING);
    expect(result.current.saveError).toBeNull();
    // The pick is sent as soon as it is made.
    const PICKED = { ...PENDING, template_id: 't2', template_version_id: 'v2' };
    act(() => result.current.setBack(PICKED));
    await tick();
    await flush();
    expect((router.calls.filter((c) => c.method === 'PATCH')[1]!.body as { back?: unknown }).back).toEqual(PICKED);
    expect(result.current.back).toEqual(PICKED);
  });

  it('types then PATCHes after 800 ms with the resumed state_version', async () => {
    const router = fetchRouter({
      [GET]: () => jsonResponse(200, { data: makeView({ state_version: 3 }) }),
      [PATCH]: ({ body }) =>
        jsonResponse(200, { data: makeView({ state: (body as { state: never }).state, state_version: 4 }) }),
    });
    const { result } = setup(makeClient(router.impl));
    await flush();
    expect(result.current.loading).toBe(false);
    act(() => result.current.setText('name', 'Anna'));
    await tick(AUTOSAVE_DELAY_MS - 1);
    expect(router.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
    await tick(1);
    await flush();
    expect(router.calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
    const patch = router.calls.find((c) => c.method === 'PATCH')!;
    expect(patch.body).toEqual({ state: { v: 1, texts: { name: 'Anna' }, photos: {} }, state_version: 3 });
    expect(patch.init.keepalive).toBeUndefined();
    await flush();
    expect(result.current.design?.state_version).toBe(4);
    expect(result.current.state.texts.name).toBe('Anna');
  });

  it('409 DESIGNER_DESIGN_STALE reloads the server state and shows the notice', async () => {
    let gets = 0;
    const router = fetchRouter({
      [GET]: () => {
        gets += 1;
        return jsonResponse(200, {
          data: makeView(gets === 1 ? { state_version: 3 } : { state: { v: 1, texts: { name: 'Other' }, photos: {} }, state_version: 7 }),
        });
      },
      [PATCH]: () => jsonResponse(409, { code: 'DESIGNER_DESIGN_STALE', message: 'stale' }),
    });
    const { result } = setup(makeClient(router.impl));
    await flush();
    expect(result.current.loading).toBe(false);
    act(() => result.current.setText('name', 'Mine'));
    await tick();
    await flush();
    expect(result.current.notice).toBe('stale');
    expect(result.current.state.texts.name).toBe('Other');
    expect(result.current.design?.state_version).toBe(7);
    expect(result.current.saveError).toBeNull();
  });

  it('a locked design on resume starts fresh and remembers it as lockedFrom', async () => {
    const router = fetchRouter({
      [GET]: () => jsonResponse(409, { code: 'DESIGNER_DESIGN_LOCKED', message: 'ordered' }),
    });
    const { result } = setup(makeClient(router.impl));
    await flush();
    expect(result.current.loading).toBe(false);
    expect(result.current.notice).toBe('locked');
    expect(result.current.lockedFrom).toBe('d1');
    expect(result.current.design).toBeNull();
    expect(result.current.state).toEqual({ v: 1, texts: {}, photos: {} });
  });

  it('an upload waits for the pending save (PATCH lands before the upload starts)', async () => {
    const order: string[] = [];
    const router = fetchRouter({
      [GET]: () => jsonResponse(200, { data: makeView({ state_version: 3 }) }),
      [PATCH]: ({ body }) => {
        order.push('patch');
        return jsonResponse(200, { data: makeView({ state: (body as { state: never }).state, state_version: 4 }) });
      },
    });
    const client = makeClient(router.impl);
    const upload: UploadPhotoResult = {
      asset_id: 'a1',
      width: 800,
      height: 600,
      preview_url: null,
      effective_dpi_default: 200,
      low_res: false,
      design: makeView({
        state_version: 5,
        state: { v: 1, texts: { name: 'Anna' }, photos: { photo: { asset_id: 'a1', width: 800, height: 600, adj: { zoom: 1, rot: 0, panX: 0.5, panY: 0.5 } } } },
      }),
    };
    client.uploadPhoto = vi.fn(async () => {
      order.push('upload');
      return upload;
    });
    const { result } = setup(client);
    await flush();
    expect(result.current.loading).toBe(false);
    act(() => result.current.setText('name', 'Anna'));
    let done: Promise<UploadPhotoResult>;
    await act(async () => {
      done = result.current.uploadPhoto('photo', new Blob(['x']));
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await done!;
    });
    expect(order).toEqual(['patch', 'upload']);
    expect(client.uploadPhoto).toHaveBeenCalledWith('d1', 'photo', expect.any(Blob), expect.any(Function), undefined, 'front');
    expect(result.current.state.photos.photo?.asset_id).toBe('a1');
    expect(result.current.design?.state_version).toBe(5);
  });

  it('edits made while the client is null are saved once (create) when it appears', async () => {
    const router = fetchRouter({
      [CREATE]: ({ body }) =>
        jsonResponse(201, { data: { ...makeView({ state: (body as { state: never }).state, state_version: 1 }), token: 'tok' } }),
      [PATCH]: () => jsonResponse(200, { data: makeView({ state_version: 2 }) }),
    });
    const { result, rerender } = setup(null, null);
    expect(result.current.clientReady).toBe(false);
    act(() => result.current.setText('name', 'Early'));
    await tick();
    await tick();
    expect(router.calls).toHaveLength(0);
    expect(result.current.isDirty()).toBe(true);
    rerender({ client: makeClient(router.impl) });
    expect(result.current.clientReady).toBe(true);
    await tick();
    await flush();
    expect(result.current.design?.id).toBe('d1');
    await tick();
    expect(router.calls.map((c) => c.method)).toEqual(['POST']);
    expect(router.calls[0]!.body).toEqual({ product_id: 'p1', template_version_id: 'v1', state: { v: 1, texts: { name: 'Early' }, photos: {} } });
    expect(result.current.isDirty()).toBe(false);
  });

  it('ensureDesign / uploads wait for the client instead of failing', async () => {
    const router = fetchRouter({
      [CREATE]: ({ body }) =>
        jsonResponse(201, { data: { ...makeView({ state: (body as { state: never }).state, state_version: 1 }), token: 'tok' } }),
    });
    const { result, rerender } = setup(null, null);
    let created: Promise<unknown>;
    act(() => {
      created = result.current.ensureDesign();
    });
    await tick();
    expect(router.calls).toHaveLength(0);
    rerender({ client: makeClient(router.impl) });
    await act(async () => {
      await created!;
    });
    expect(router.calls.map((c) => c.method)).toEqual(['POST']);
    expect(result.current.design?.id).toBe('d1');
  });

  it('cancelling an upload aborts it and leaves the photos untouched', async () => {
    const router = fetchRouter({
      [GET]: () => jsonResponse(200, { data: makeView({ state_version: 3 }) }),
    });
    const client = makeClient(router.impl);
    let seen: AbortSignal | undefined;
    client.uploadPhoto = vi.fn(
      (_id, _el, _file, _progress, signal) =>
        new Promise<UploadPhotoResult>((_resolve, reject) => {
          seen = signal;
          signal?.addEventListener('abort', () => reject(new DesignerApiError(0, null)), { once: true });
        }),
    );
    const { result } = setup(client);
    await flush();
    expect(result.current.loading).toBe(false);
    const controller = new AbortController();
    let p: Promise<unknown>;
    await act(async () => {
      p = result.current.uploadPhoto('photo', new Blob(['x']), undefined, controller.signal);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(seen).toBe(controller.signal);
    controller.abort();
    const err = await p!.then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(DesignerApiError);
    expect((err as DesignerApiError).status).toBe(0);
    expect(result.current.state.photos).toEqual({});
    // An already-aborted signal never starts the upload.
    const aborted = new AbortController();
    aborted.abort();
    const err2 = await act(() => result.current.uploadPhoto('photo', new Blob(['x']), undefined, aborted.signal).catch((e) => e));
    expect((err2 as DesignerApiError).status).toBe(0);
    expect(client.uploadPhoto).toHaveBeenCalledTimes(1);
  });

  it('saves with keepalive when the tab is hidden', async () => {
    const router = fetchRouter({
      [GET]: () => jsonResponse(200, { data: makeView({ state_version: 3 }) }),
      [PATCH]: () => jsonResponse(200, { data: makeView({ state_version: 4 }) }),
    });
    const { result } = setup(makeClient(router.impl));
    await flush();
    expect(result.current.loading).toBe(false);
    act(() => result.current.setText('name', 'Anna'));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    await flush();
    expect(router.calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
    expect(router.calls.find((c) => c.method === 'PATCH')!.init.keepalive).toBe(true);
  });
});
