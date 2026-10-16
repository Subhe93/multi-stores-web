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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  validateState,
  type DesignPhoto,
  type DesignStateV1,
  type PhotoAdj,
  type TemplateSpecV1,
} from '@/lib/designer/design-renderer';
import {
  designerErrorCode,
  forgetDesign,
  getDraftFor,
  setDesignPath,
  setDraftFor,
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  const createRef = useRef<Promise<DesignView> | null>(null);

  const applyDesign = useCallback((view: DesignView | null) => {
    designRef.current = view;
    setDesign(view);
  }, []);

  const applyLocal = useCallback((next: DesignStateV1) => {
    localRef.current = next;
    setLocalState(next);
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
      dirtyRef.current = Object.keys(next.texts).length > 0;
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
      });
    return () => {
      cancelled = true;
    };
    // Resume once per editor mount / design id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, initialDesignId]);

  // ── Create ──────────────────────────────────────────────────────────────
  const ensureDesign = useCallback(async (): Promise<DesignView> => {
    if (designRef.current) return designRef.current;
    if (!client) throw new Error('DESIGNER_CLIENT_MISSING');
    if (!createRef.current) {
      const texts = validateState(spec, { v: 1, texts: localRef.current.texts, photos: {} }).normalized.texts;
      const sentTexts = JSON.stringify(texts);
      createRef.current = client
        .create({ product_id: productId, template_version_id: templateVersionId, state: { v: 1, texts, photos: {} } })
        .then((view) => {
          applyDesign(view);
          try {
            setDesignPath(view.id, window.location.pathname);
          } catch {
            // No window (tests): the cart simply shows no edit link.
          }
          setDraftFor(productId, view.id);
          // Edits made while creating stay dirty and are saved next.
          dirtyRef.current = JSON.stringify(localRef.current.texts) !== sentTexts || Object.keys(localRef.current.photos).length > 0;
          return view;
        })
        .catch((err) => {
          createRef.current = null;
          throw err;
        });
    }
    return createRef.current;
  }, [client, spec, productId, templateVersionId, applyDesign]);

  // ── Save ────────────────────────────────────────────────────────────────
  const saveNow = useCallback(
    (): Promise<DesignView | null> =>
      exclusive(async () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (!dirtyRef.current) return designRef.current;
        if (!client) return designRef.current;
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
        setSaving(true);
        try {
          const view = await client.update(d.id, check.normalized, d.state_version);
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
          setSaveError(err);
          return null;
        } finally {
          setSaving(false);
        }
      }),
    [client, spec, exclusive, ensureDesign, applyDesign, applyLocal, startFresh],
  );

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void saveNow();
    }, AUTOSAVE_DELAY_MS);
  }, [saveNow]);

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

  const setAdj = useCallback(
    (slotId: string, adj: PhotoAdj) =>
      updateLocal((s) => {
        const p = s.photos[slotId];
        if (p) s.photos[slotId] = { ...p, adj: { ...adj } };
        return s;
      }),
    [updateLocal],
  );

  /** Uploads a photo for a slot (after pending edits are saved). */
  const uploadPhoto = useCallback(
    (
      slotId: string,
      file: Blob,
      onProgress?: (fraction: number) => void,
      signal?: AbortSignal,
    ): Promise<UploadPhotoResult> =>
      saveNow().then(() =>
        exclusive(async () => {
          if (!client) throw new Error('DESIGNER_CLIENT_MISSING');
          const d = await ensureDesign();
          const res = await client.uploadPhoto(
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
    [client, saveNow, exclusive, ensureDesign, applyDesign, applyLocal],
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
        if (!client) throw new Error('DESIGNER_CLIENT_MISSING');
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        const view = await client.duplicate(sourceId);
        createRef.current = null;
        applyDesign(view);
        applyLocal(cloneState(view.state ?? EMPTY_STATE));
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
    [client, exclusive, applyDesign, applyLocal, productId],
  );

  // Save what is pending when the tab is hidden (mobile app switch) and on unmount.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) void saveNow();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (dirtyRef.current) void saveNow();
    };
  }, [saveNow]);

  const validation = useMemo(() => validateState(spec, local), [spec, local]);

  return {
    design,
    state: local,
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
    setText,
    setAdj,
    uploadPhoto,
    removePhoto,
    ensureDesign,
    /** Saves now and resolves with the saved design (null when saving failed). */
    flush: saveNow,
  };
}

export type DesignDraft = ReturnType<typeof useDesignDraft>;
