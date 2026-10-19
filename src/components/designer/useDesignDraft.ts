'use client';

// ── Designer editor: draft state + autosave (M4.2 §7.1) ───────────────────
// Keeps the customer's state locally and mirrors it to the server draft:
// - the draft is created on the first edit (or the first photo upload);
// - edits are PATCHed 800 ms after the last change with `state_version`;
// - 409 DESIGNER_DESIGN_STALE (another tab saved) reloads the server state;
// - a locked (ordered), missing or foreign design starts a fresh draft; a
//   locked one is remembered (`lockedFrom`) so the customer can start again
//   from a copy of it (`duplicateFrom`, photos included).
// Saves, uploads and photo removals run one at a time (`exclusive`), so a
// PATCH never races an upload that bumps the version.
// The client may be null while the customer session is restoring (M5 D2):
// edits made meanwhile stay dirty and are saved once it exists, and creates /
// uploads wait for it instead of failing.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  validateState,
  type DesignPhoto,
  type DesignStateV1,
  type PhotoAdj,
  type TemplateSpecV1,
} from '@multi-stores/core/designer';
import {
  DesignerApiError,
  designerErrorCode,
  forgetDesign,
  getDraftFor,
  setDesignPath,
  setDraftFor,
  type AddonSelection,
  type DesignerClient,
  type DesignView,
  type UploadPhotoResult,
} from '@/lib/designer/api';

export const AUTOSAVE_DELAY_MS = 800;

export type DraftNotice = 'stale' | 'locked' | 'outdated' | 'notFound' | null;

const EMPTY_STATE: DesignStateV1 = { v: 1, texts: {}, photos: {} };

interface Options {
  client: DesignerClient | null;
  productId: string;
  templateVersionId: string;
  spec: TemplateSpecV1;
  /** Design to resume (`?design=` from the cart, or the stored draft). */
  initialDesignId: string | null;
}

function cloneState(s: DesignStateV1): DesignStateV1 {
  const photos: Record<string, DesignPhoto> = {};
  for (const [k, p] of Object.entries(s.photos || {})) photos[k] = { ...p, adj: { ...p.adj } };
  return { v: 1, texts: { ...(s.texts || {}) }, photos };
}

export function useDesignDraft({ client, productId, templateVersionId, spec, initialDesignId }: Options) {
  const [design, setDesign] = useState<DesignView | null>(null);
  const [local, setLocalState] = useState<DesignStateV1>(EMPTY_STATE);
  const [loading, setLoading] = useState<boolean>(Boolean(initialDesignId));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [notice, setNotice] = useState<DraftNotice>(null);
  // Id of the ordered design this editor was opened on (or that got ordered
  // while editing): the "start again from this design" source.
  const [lockedFrom, setLockedFrom] = useState<string | null>(null);

  const designRef = useRef<DesignView | null>(null);
  const localRef = useRef<DesignStateV1>(EMPTY_STATE);
  const dirtyRef = useRef(false);
  // M5.5 add-on selection: saved with the draft (`addons` on create / PATCH),
  // sent only when it changed since the last save.
  const [addons, setAddonsState] = useState<AddonSelection>({});
  const addonsRef = useRef<AddonSelection>({});
  const addonsDirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  const createRef = useRef<Promise<DesignView> | null>(null);
  // Settles when the resume of `initialDesignId` finished (at once without one).
  const resumeRef = useRef<Promise<void>>(Promise.resolve());

  // ── Client availability (D2) ────────────────────────────────────────────
  const clientRef = useRef<DesignerClient | null>(client);
  const clientWaitersRef = useRef<((c: DesignerClient) => void)[]>([]);
  /** Resolves with the client, now or once the session is restored. */
  const awaitClient = useCallback((): Promise<DesignerClient> => {
    const c = clientRef.current;
    if (c) return Promise.resolve(c);
    return new Promise((resolve) => clientWaitersRef.current.push(resolve));
  }, []);

  const applyDesign = useCallback((view: DesignView | null) => {
    designRef.current = view;
    setDesign(view);
  }, []);

  const applyLocal = useCallback((next: DesignStateV1) => {
    localRef.current = next;
    setLocalState(next);
  }, []);

  const applyAddons = useCallback((next: AddonSelection | undefined) => {
    const v = { ...(next ?? {}) };
    addonsRef.current = v;
    addonsDirtyRef.current = false;
    setAddonsState(v);
  }, []);

  /** Runs `fn` after every earlier save/upload finished. */
  const exclusive = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const run = chainRef.current.then(fn, fn);
    chainRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const startFresh = useCallback(
    (carryTexts?: Record<string, string>) => {
      const old = designRef.current;
      if (old) setDraftFor(productId, null);
      applyDesign(null);
      createRef.current = null;
      const next: DesignStateV1 = { v: 1, texts: carryTexts ? { ...carryTexts } : {}, photos: {} };
      applyLocal(next);
      // The add-on choice survives like the texts (saved with the new draft).
      const keepAddons = Object.keys(addonsRef.current).length > 0;
      addonsDirtyRef.current = keepAddons;
      dirtyRef.current = Object.keys(next.texts).length > 0 || keepAddons;
    },
    [productId, applyDesign, applyLocal],
  );

  // ── Resume ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!initialDesignId) {
      setLoading(false);
      return;
    }
    // No client yet (customer session still restoring): stay in the loading
    // state and resume once it exists, never with a token-only request.
    if (!client) return;
    let cancelled = false;
    setLoading(true);
    let settle: () => void = () => undefined;
    resumeRef.current = new Promise<void>((resolve) => {
      settle = resolve;
    });
    client
      .get(initialDesignId)
      .then((view) => {
        if (cancelled) return;
        if (view.product_id !== productId) {
          startFresh();
          return;
        }
        if (view.template_version_id !== templateVersionId) {
          // The template was republished: keep the texts that still fit.
          const carried = validateState(spec, { v: 1, texts: view.state?.texts ?? {}, photos: {} }).normalized.texts;
          setNotice('outdated');
          if (view.status === 'DRAFT') setDraftFor(productId, null);
          startFresh(carried);
          return;
        }
        applyDesign(view);
        applyLocal(cloneState(view.state ?? EMPTY_STATE));
        applyAddons(view.addons);
        dirtyRef.current = false;
        if (view.status === 'DRAFT') setDraftFor(productId, view.id);
      })
      .catch((err) => {
        if (cancelled) return;
        const code = designerErrorCode(err);
        if (code === 'DESIGNER_DESIGN_LOCKED') {
          // Keep its token: duplicating the ordered design needs it.
          setNotice('locked');
          setLockedFrom(initialDesignId);
          if (getDraftFor(productId) === initialDesignId) setDraftFor(productId, null);
        } else {
          setNotice('notFound');
          forgetDesign(initialDesignId);
        }
        startFresh();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
        settle();
      });
    return () => {
      cancelled = true;
      settle();
    };
    // Resume once per editor mount / design id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, initialDesignId]);

  // ── Create ──────────────────────────────────────────────────────────────
  const ensureDesign = useCallback(async (): Promise<DesignView> => {
    if (designRef.current) return designRef.current;
    // No session yet: wait for it (and for the resume it triggers) rather
    // than creating a draft the resumed design would then shadow.
    const c = await awaitClient();
    await resumeRef.current;
    if (designRef.current) return designRef.current;
    if (!createRef.current) {
      const texts = validateState(spec, { v: 1, texts: localRef.current.texts, photos: {} }).normalized.texts;
      const sentTexts = JSON.stringify(texts);
      const sentAddons = { ...addonsRef.current };
      const hasAddons = Object.keys(sentAddons).length > 0;
      createRef.current = c
        .create({
          product_id: productId,
          template_version_id: templateVersionId,
          state: { v: 1, texts, photos: {} },
          ...(hasAddons ? { addons: sentAddons } : {}),
        })
        .then((view) => {
          applyDesign(view);
          try {
            setDesignPath(view.id, window.location.pathname);
          } catch {
            // No window (tests): the cart simply shows no edit link.
          }
          setDraftFor(productId, view.id);
          // Edits made while creating stay dirty and are saved next.
          addonsDirtyRef.current = JSON.stringify(addonsRef.current) !== JSON.stringify(sentAddons);
          dirtyRef.current =
            JSON.stringify(localRef.current.texts) !== sentTexts ||
            Object.keys(localRef.current.photos).length > 0 ||
            addonsDirtyRef.current;
          return view;
        })
        .catch((err) => {
          createRef.current = null;
          throw err;
        });
    }
    return createRef.current;
  }, [awaitClient, spec, productId, templateVersionId, applyDesign]);

  // ── Save ────────────────────────────────────────────────────────────────
  /**
   * Saves pending edits (after earlier saves/uploads). `keepalive` lets the
   * PATCH outlive the page (tab hidden / closed).
   */
  const saveNow = useCallback(
    (opts?: { keepalive?: boolean }): Promise<DesignView | null> =>
      exclusive(async () => {
        if (!dirtyRef.current) return designRef.current;
        // Session still restoring: the edits stay dirty and are saved once
        // the client exists (see the client effect below); an armed timer is
        // left alone so that save still happens.
        if (!client) return designRef.current;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        const check = validateState(spec, localRef.current);
        // Out-of-rule input (too long, forbidden characters) is shown inline
        // and never sent: the server would reject the whole PATCH.
        if (!check.ok) return designRef.current;
        let d: DesignView;
        try {
          d = await ensureDesign();
        } catch (err) {
          setSaveError(err);
          return null;
        }
        if (!dirtyRef.current) return designRef.current;
        dirtyRef.current = false;
        const sendAddons = addonsDirtyRef.current ? { ...addonsRef.current } : null;
        addonsDirtyRef.current = false;
        setSaving(true);
        try {
          const init = {
            ...(opts?.keepalive ? { keepalive: true } : {}),
            ...(sendAddons ? { addons: sendAddons } : {}),
          };
          const view = await client.update(
            d.id,
            check.normalized,
            d.state_version,
            Object.keys(init).length ? init : undefined,
          );
          // Keep local edits made during the request; take the server's version and photo views.
          applyDesign(view);
          setSaveError(null);
          return view;
        } catch (err) {
          const code = designerErrorCode(err);
          if (code === 'DESIGNER_DESIGN_STALE') {
            // Saved elsewhere (another tab): the server state wins.
            try {
              const fresh = await client.get(d.id);
              applyDesign(fresh);
              applyLocal(cloneState(fresh.state ?? EMPTY_STATE));
              applyAddons(fresh.addons);
              setNotice('stale');
              setSaveError(null);
              return fresh;
            } catch (e2) {
              setSaveError(e2);
              return null;
            }
          }
          if (code === 'DESIGNER_DESIGN_LOCKED' || code === 'DESIGNER_DESIGN_NOT_FOUND') {
            if (code === 'DESIGNER_DESIGN_LOCKED') {
              setNotice('locked');
              setLockedFrom(d.id);
            } else {
              setNotice('notFound');
              forgetDesign(d.id);
            }
            // Texts survive; photos belonged to the old design.
            startFresh(check.normalized.texts);
            return null;
          }
          dirtyRef.current = true;
          if (sendAddons) addonsDirtyRef.current = true;
          setSaveError(err);
          return null;
        } finally {
          setSaving(false);
        }
      }),
    [client, spec, exclusive, ensureDesign, applyDesign, applyLocal, applyAddons, startFresh],
  );

  // The autosave timer always runs the latest `saveNow` (the one that knows
  // the current client), whichever render armed it.
  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;
  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void saveNowRef.current();
    }, AUTOSAVE_DELAY_MS);
  }, []);

  // The client appeared (session restored): release whoever waits for it and
  // save the edits made meanwhile.
  useEffect(() => {
    clientRef.current = client;
    if (!client) return;
    const waiters = clientWaitersRef.current;
    clientWaitersRef.current = [];
    for (const resolve of waiters) resolve(client);
    if (dirtyRef.current) scheduleSave();
  }, [client, scheduleSave]);

  const updateLocal = useCallback(
    (fn: (s: DesignStateV1) => DesignStateV1) => {
      applyLocal(fn(cloneState(localRef.current)));
      dirtyRef.current = true;
      scheduleSave();
    },
    [applyLocal, scheduleSave],
  );

  const setText = useCallback(
    (id: string, value: string) =>
      updateLocal((s) => {
        if (value === '') delete s.texts[id];
        else s.texts[id] = value;
        return s;
      }),
    [updateLocal],
  );

  /** Sets one add-on's quantity (0 removes it; toggles use 1) and autosaves. */
  const setAddon = useCallback(
    (key: string, qty: number) => {
      const next = { ...addonsRef.current };
      if (qty > 0) next[key] = qty;
      else delete next[key];
      addonsRef.current = next;
      setAddonsState(next);
      addonsDirtyRef.current = true;
      dirtyRef.current = true;
      scheduleSave();
    },
    [scheduleSave],
  );

  const setAdj = useCallback(
    (slotId: string, adj: PhotoAdj) =>
      updateLocal((s) => {
        const p = s.photos[slotId];
        if (p) s.photos[slotId] = { ...p, adj: { ...adj } };
        return s;
      }),
    [updateLocal],
  );

  /**
   * Uploads a photo for a slot (after pending edits are saved). Aborting
   * `signal` rejects with a status-0 DesignerApiError, also while the upload
   * still waits for the session or an earlier save.
   */
  const uploadPhoto = useCallback(
    (
      slotId: string,
      file: Blob,
      onProgress?: (fraction: number) => void,
      signal?: AbortSignal,
    ): Promise<UploadPhotoResult> =>
      saveNow().then(() =>
        exclusive(async () => {
          if (signal?.aborted) throw new DesignerApiError(0, null);
          const c = await awaitClient();
          const d = await ensureDesign();
          if (signal?.aborted) throw new DesignerApiError(0, null);
          const res = await c.uploadPhoto(
            d.id,
            slotId,
            file,
            (p) => onProgress?.(p.total > 0 ? p.loaded / p.total : 0),
            signal,
          );
          applyDesign(res.design);
          const serverPhoto = res.design?.state?.photos?.[slotId];
          const next = cloneState(localRef.current);
          next.photos[slotId] = serverPhoto
            ? { ...serverPhoto, adj: { ...serverPhoto.adj } }
            : {
                asset_id: res.asset_id,
                width: res.width,
                height: res.height,
                adj: { zoom: 1, rot: 0, panX: 0.5, panY: 0.5 },
              };
          applyLocal(next);
          return res;
        }),
      ),
    [awaitClient, saveNow, exclusive, ensureDesign, applyDesign, applyLocal],
  );

  const removePhoto = useCallback(
    (slotId: string): Promise<void> =>
      saveNow().then(() =>
        exclusive(async () => {
          const d = designRef.current;
          const p = localRef.current.photos[slotId];
          if (!client || !d || !p) return;
          const view = await client.deletePhoto(d.id, p.asset_id);
          applyDesign(view);
          const next = cloneState(localRef.current);
          delete next.photos[slotId];
          applyLocal(next);
        }),
      ),
    [client, saveNow, exclusive, applyDesign, applyLocal],
  );

  /**
   * Starts again from a copy of an ordered design (same texts and photos):
   * the copy becomes this editor's draft. Resolves with the new design.
   */
  const duplicateFrom = useCallback(
    (sourceId: string): Promise<DesignView> =>
      exclusive(async () => {
        const c = await awaitClient();
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        const view = await c.duplicate(sourceId);
        createRef.current = null;
        applyDesign(view);
        applyLocal(cloneState(view.state ?? EMPTY_STATE));
        applyAddons(view.addons);
        dirtyRef.current = false;
        try {
          setDesignPath(view.id, window.location.pathname);
        } catch {
          // No window (tests).
        }
        setDraftFor(productId, view.id);
        setLockedFrom(null);
        setNotice(null);
        setSaveError(null);
        return view;
      }),
    [awaitClient, exclusive, applyDesign, applyLocal, applyAddons, productId],
  );

  // Save what is pending when the tab is hidden (mobile app switch) and on
  // unmount. `keepalive` so the browser finishes the PATCH even when the page
  // is discarded right after (D29).
  // Mounted once (via the ref): re-subscribing on every client change would
  // run the old cleanup's save against the client-less closure.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) void saveNowRef.current({ keepalive: true });
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (dirtyRef.current) void saveNowRef.current({ keepalive: true });
    };
  }, []);

  const validation = useMemo(() => validateState(spec, local), [spec, local]);

  return {
    design,
    state: local,
    /** False while the customer session is restoring (no requests possible yet). */
    clientReady: client !== null,
    loading,
    saving,
    saveError,
    notice,
    clearNotice: () => setNotice(null),
    /** The ordered design a copy can be started from, or null. */
    lockedFrom,
    duplicateFrom,
    /** Local edits not yet saved. */
    isDirty: () => dirtyRef.current,
    validation,
    /** M5.5 add-on selection `{key: qty}` of the draft. */
    addons,
    setAddon,
    setText,
    setAdj,
    uploadPhoto,
    removePhoto,
    ensureDesign,
    /** Saves now and resolves with the saved design (null when saving failed). */
    flush: (): Promise<DesignView | null> => saveNow(),
  };
}

export type DesignDraft = ReturnType<typeof useDesignDraft>;
