'use client';

// ── Designer inline: session host, canvas and form (M5.5, NPP parity) ─────
// What namez.se's NPP plugin does on the product page, as React: the live
// canvas replaces the gallery, the form (photo slots → text fields → CTA)
// replaces the add-to-cart form, nothing is modal and nothing is reviewed in
// a second step. One click on the CTA validates (`requireComplete`), saves
// the draft, adds the line to the cart and asks the server for the proof in
// the background (the cart shows it when it lands). The draft resumes from
// `?design=<id>` (edit from the cart) or from the product's stored draft and
// autosaves while typing.
//
// This is the heavy chunk (renderer, draft hook, gestures). It is reached
// only through `./DesignerSession` (next/dynamic, ssr:false), so a product
// page without a design template never downloads it.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCart, type CartCustomFieldDisplay } from '@/hooks/useCart';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useApiError } from '@/lib/useApiError';
import {
  DEFAULT_ADJ,
  pickI18n,
  validateState,
  type DesignStateV1,
  type FontLookup,
  type ImageLookup,
  type ImageSlotElement,
  type PhotoAdj,
  type RenderReport,
  type TemplateSpecV1,
  type TextElement,
} from '@/lib/designer/design-renderer';
import {
  createDesignerClient,
  designerClientOptions,
  getDesignToken,
  getDraftFor,
  isUploadNetworkError,
  setDraftFor,
} from '@/lib/designer/api';
import { loadDesignerFonts, missingFontKeys, payloadFontLookup } from '@/lib/designer/fonts';
import { dropDesignParam, readDesignParam } from '@/lib/designer/storefront';
import { clearCartDesignCache } from './useCartDesign';
import { DesignerCanvas } from './DesignerCanvas';
import { PhotoSlotControl, ACCEPTED_TYPES, type PhotoSlotHandle } from './PhotoSlotControl';
import { TextFieldControl } from './TextFieldControl';
import { useDesignDraft, type DesignDraft } from './useDesignDraft';
import { downscaleForPreview, useDesignerImages } from './useDesignerImages';
import { CanvasSkeleton, FormSkeleton, useDesignerConfig, useDesignerHeading, useDesignerSession } from './DesignerSession';

/** What the host page adds to the cart: the saved design as the line. */
export interface DesignedLine {
  designId: string;
  /** Guest token (null for logged-in customers). */
  token: string | null;
  /** Signed proof path (relative); null until the background render landed. */
  proofUrl: string | null;
  /** Text values as cart display lines ("Name: Anna"). */
  display: CartCustomFieldDisplay[];
}

export interface SubmitOptions {
  /** Why the line cannot be added yet (e.g. no variant picked); null when it can. */
  blockedReason?: string | null;
  onAddToCart: (line: DesignedLine) => Promise<void>;
  /** After the line was added (or the changes of a cart line were saved). */
  onDone?: (kind: 'added' | 'saved') => void;
}

/** Everything the canvas and the form read from the shared session. */
export interface DesignerSession {
  spec: TemplateSpecV1;
  draft: DesignDraft;
  slots: ImageSlotElement[];
  texts: TextElement[];
  /** The draft state plus local previews of photos still uploading. */
  renderState: DesignStateV1;
  images: ImageLookup;
  fonts: FontLookup;
  renderKey: string;
  /** Fonts, template images, resume and session restored: the canvas can show. */
  ready: boolean;
  fontsMissing: boolean;
  fontsSlow: boolean;
  retryFonts: () => void;
  activeSlotId: string | null;
  setActiveSlotId: (id: string | null) => void;
  toggleActiveSlot: (id: string) => void;
  /** 0..1 per slot while uploading. */
  progress: Record<string, number>;
  slotErrors: Record<string, string>;
  hasRetry: (slotId: string) => boolean;
  pick: (slotId: string, file: File) => void;
  cancelUpload: (slotId: string) => void;
  retry: (slotId: string) => void;
  remove: (slotId: string) => void;
  adjust: (slotId: string, adj: PhotoAdj) => void;
  fitted: Record<string, number>;
  onReport: (r: RenderReport) => void;
  /** First failing rule per element (always-on rules: length, characters, asset). */
  errorFor: Record<string, string>;
  /** Required elements still empty, shown after a submit attempt. */
  missing: Set<string>;
  /** Number of `requireComplete` errors after a submit attempt (0 before). */
  errorCount: number;
  /** The customer dragged a photo on the canvas at least once (hides the hint). */
  dragged: boolean;
  markDragged: () => void;
  registerSlot: (id: string, handle: PhotoSlotHandle | null) => void;
  registerText: (id: string, el: HTMLInputElement | null) => void;
  openPicker: (slotId: string) => void;
  focusText: (id: string) => void;
  /** The design is a cart line: the CTA saves the changes instead of adding. */
  inCart: boolean;
  uploading: boolean;
  submitting: boolean;
  submitError: string;
  submit: (o: SubmitOptions) => Promise<void>;
  restarting: boolean;
  startAgain: () => Promise<void>;
}

function scrollAndFocus(el: HTMLElement | null | undefined): void {
  if (!el) return;
  if (typeof el.scrollIntoView === 'function') {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }
  el.focus({ preventScroll: true });
}

// ── Host: owns the session and publishes it to the context ────────────────

export function DesignerSessionHost() {
  const { payload, productId, locale, storeSlug, publish } = useDesignerConfig();
  const t = useTranslations('designer');
  const apiError = useApiError();
  const router = useRouter();
  const lp = useLocalePath();
  const { token: authToken, loading: authLoading } = useAuth();
  const { items: cartItems, refreshDesignLine, replaceDesignLine } = useCart();
  const spec = payload.spec_public;
  // No client until the session is restored: a claimed design answers to the JWT only.
  const client = useMemo(() => {
    const o = designerClientOptions(storeSlug, { token: authToken, loading: authLoading });
    return o ? createDesignerClient(o) : null;
  }, [storeSlug, authToken, authLoading]);

  // Deep link from the cart (`?design=<id>`), else the product's stored draft.
  // Read once on mount (this host only renders in the browser).
  const [initialDesignId] = useState<string | null>(() => readDesignParam() ?? getDraftFor(productId));
  useEffect(() => {
    dropDesignParam();
  }, []);

  const draft = useDesignDraft({ client, productId, templateVersionId: payload.template_version_id, spec, initialDesignId });
  const imgs = useDesignerImages(spec, draft.design?.photos);

  // ── Fonts ───────────────────────────────────────────────────────────────
  const [fontsReady, setFontsReady] = useState(payload.fonts.length === 0);
  const [fontsSlow, setFontsSlow] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const [fontAttempt, setFontAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    loadDesignerFonts(payload.fonts, { onLate: () => !cancelled && setFontTick((n) => n + 1) }).then((r) => {
      if (cancelled) return;
      setFontsReady(true);
      setFontsSlow(r.pending.length > 0);
      setFontTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [payload.fonts, fontAttempt]);
  // The renderer skips (and reports) text whose template face has not loaded
  // instead of fitting it with a fallback font.
  const fontLookup = useMemo(() => payloadFontLookup(payload.fonts), [payload.fonts]);
  const missingFonts = useMemo(
    () => missingFontKeys(payload.fonts),
    // fontTick bumps whenever a face finished loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payload.fonts, fontTick],
  );
  const fontsMissing = missingFonts.length > 0;
  const retryFonts = useCallback(() => {
    setFontsSlow(false);
    setFontAttempt((n) => n + 1);
  }, []);

  // ── Elements ────────────────────────────────────────────────────────────
  const elements = useMemo(() => (spec.surfaces || []).find((s) => s.key === 'front')?.elements ?? [], [spec]);
  const slots = useMemo(() => elements.filter((e): e is ImageSlotElement => e.type === 'image_slot'), [elements]);
  const texts = useMemo(() => elements.filter((e): e is TextElement => e.type === 'text' && e.editable), [elements]);

  // ── Photos: local previews while uploading, progress, errors ───────────
  const [pending, setPending] = useState<Record<string, { width: number; height: number }>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});
  // The picked file of a failed upload, so "Try again" needs no new pick (D14).
  const [retryFiles, setRetryFiles] = useState<Record<string, File>>({});
  const uploadAborts = useRef<Record<string, AbortController>>({});
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [dragged, setDragged] = useState(false);

  const renderState: DesignStateV1 = useMemo(() => {
    if (Object.keys(pending).length === 0) return draft.state;
    const photos = { ...draft.state.photos };
    for (const [slotId, p] of Object.entries(pending)) {
      const slot = slots.find((s) => s.id === slotId);
      photos[slotId] = { asset_id: `local:${slotId}`, width: p.width, height: p.height, adj: { ...(slot?.default_adj ?? DEFAULT_ADJ) } };
    }
    return { ...draft.state, photos };
  }, [draft.state, pending, slots]);

  const slotRefs = useRef<Record<string, PhotoSlotHandle | null>>({});
  const textRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const registerSlot = useCallback((id: string, h: PhotoSlotHandle | null) => {
    slotRefs.current[id] = h;
  }, []);
  const registerText = useCallback((id: string, el: HTMLInputElement | null) => {
    textRefs.current[id] = el;
  }, []);
  const openPicker = useCallback((id: string) => slotRefs.current[id]?.openPicker(), []);
  const focusText = useCallback((id: string) => textRefs.current[id]?.focus(), []);
  const focusElement = useCallback((id: string) => {
    if (slotRefs.current[id]) slotRefs.current[id]!.focus();
    else scrollAndFocus(textRefs.current[id]);
  }, []);

  const forgetRetry = useCallback((slotId: string) => {
    setRetryFiles((r) => {
      if (!(slotId in r)) return r;
      const n = { ...r };
      delete n[slotId];
      return n;
    });
  }, []);

  const pick = useCallback(
    async (slotId: string, file: File) => {
      setSlotErrors((e) => ({ ...e, [slotId]: '' }));
      forgetRetry(slotId);
      if (file.type && !ACCEPTED_TYPES.split(',').includes(file.type)) {
        setSlotErrors((e) => ({ ...e, [slotId]: t('fileType') }));
        return;
      }
      if (file.size > payload.settings.max_upload_mb * 1024 * 1024) {
        setSlotErrors((e) => ({ ...e, [slotId]: t('fileTooLarge', { max: payload.settings.max_upload_mb }) }));
        return;
      }
      // A new pick replaces an upload still running for the slot.
      uploadAborts.current[slotId]?.abort();
      const controller = new AbortController();
      uploadAborts.current[slotId] = controller;
      setProgress((p) => ({ ...p, [slotId]: 0 }));
      let preview: Awaited<ReturnType<typeof downscaleForPreview>> | null = null;
      try {
        // Instant on-screen preview; the original file is what is uploaded.
        preview = await downscaleForPreview(file);
        imgs.setLocal(`local:${slotId}`, preview.bitmap);
        setPending((p) => ({ ...p, [slotId]: { width: preview!.width, height: preview!.height } }));
      } catch {
        preview = null; // undecodable here (e.g. HEIC): the server decides
      }
      try {
        const res = await draft.uploadPhoto(slotId, file, (f) => setProgress((p) => ({ ...p, [slotId]: f })), controller.signal);
        if (preview) imgs.setLocal(res.asset_id, preview.bitmap);
        setActiveSlotId(slotId);
      } catch (err) {
        // Cancelled by the customer (or superseded by a new pick): no error.
        if (!controller.signal.aborted) {
          // A network failure never reached the API: no API code.
          setSlotErrors((e) => ({ ...e, [slotId]: isUploadNetworkError(err) ? t('uploadFailed') : apiError(err) }));
          setRetryFiles((r) => ({ ...r, [slotId]: file }));
        }
      } finally {
        if (uploadAborts.current[slotId] === controller) delete uploadAborts.current[slotId];
        setPending((p) => {
          const n = { ...p };
          delete n[slotId];
          return n;
        });
        setProgress((p) => {
          const n = { ...p };
          delete n[slotId];
          return n;
        });
        imgs.setLocal(`local:${slotId}`, null);
      }
    },
    [draft, imgs, payload.settings.max_upload_mb, apiError, t, forgetRetry],
  );

  const cancelUpload = useCallback((slotId: string) => {
    uploadAborts.current[slotId]?.abort();
  }, []);

  const retry = useCallback(
    (slotId: string) => {
      const file = retryFiles[slotId];
      if (file) void pick(slotId, file);
    },
    [retryFiles, pick],
  );

  // Uploads still running when the page unmounts are dropped.
  useEffect(() => {
    const aborts = uploadAborts.current;
    return () => {
      for (const c of Object.values(aborts)) c.abort();
    };
  }, []);

  const remove = useCallback(
    async (slotId: string) => {
      setSlotErrors((e) => ({ ...e, [slotId]: '' }));
      try {
        await draft.removePhoto(slotId);
        setActiveSlotId((cur) => (cur === slotId ? null : cur));
      } catch (err) {
        setSlotErrors((e) => ({ ...e, [slotId]: apiError(err) }));
      }
    },
    [draft, apiError],
  );

  const adjust = useCallback(
    (slotId: string, adj: PhotoAdj) => {
      if (pending[slotId]) return; // adjust after the upload landed
      draft.setAdj(slotId, adj);
    },
    [draft, pending],
  );

  const toggleActiveSlot = useCallback((id: string) => setActiveSlotId((cur) => (cur === id ? null : id)), []);
  const markDragged = useCallback(() => setDragged(true), []);

  // ── Render report (text fitting hints) ─────────────────────────────────
  const [fitted, setFitted] = useState<Record<string, number>>({});
  const onReport = useCallback((r: RenderReport) => {
    setFitted((prev) => {
      const keys = Object.keys(r.fitted);
      if (keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === r.fitted[k])) return prev;
      return { ...r.fitted };
    });
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────
  const [showAll, setShowAll] = useState(false);
  const errorFor = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of draft.validation.errors) if (!map[e.element_id]) map[e.element_id] = e.rule;
    return map;
  }, [draft.validation]);
  const complete = useMemo(() => validateState(spec, draft.state, { requireComplete: true }), [spec, draft.state]);
  const missing = useMemo(() => {
    const m = new Set<string>();
    if (!showAll) return m;
    for (const s of slots) if (s.required && !renderState.photos[s.id]) m.add(s.id);
    for (const tx of texts) if (tx.required && !(draft.state.texts[tx.id] || '').trim()) m.add(tx.id);
    return m;
  }, [showAll, slots, texts, renderState.photos, draft.state.texts]);
  const errorCount = showAll ? complete.errors.length : 0;

  // ── Add to cart / save ─────────────────────────────────────────────────
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Same-tick re-entry guard (two clicks before the disabled button re-rendered).
  const submittingRef = useRef(false);
  const uploading = Object.keys(progress).length > 0;
  const designId = draft.design?.id ?? null;
  const inCart = Boolean(designId && (draft.design?.status === 'IN_CART' || cartItems.some((i) => i.designId === designId)));

  // Text values as cart display lines ("Name: Anna").
  const displayLines = useCallback(
    (): CartCustomFieldDisplay[] =>
      texts
        .map((el) => ({
          id: el.id,
          label: pickI18n(el.label, locale) || el.source_label || el.id,
          value: draft.state.texts[el.id] ?? '',
        }))
        .filter((l) => l.value !== ''),
    [texts, locale, draft.state.texts],
  );

  // The proof is rendered after the add, never before it (NPP blocked the
  // button meanwhile; here the cart shows the line at once and the proof
  // when it lands). A 503 (render engine busy) or a failure keeps the line's
  // own image; the cart re-reads the design later.
  const requestProof = useCallback(
    (id: string, display: CartCustomFieldDisplay[]) => {
      if (!client) return;
      client
        .proof(id)
        .then((res) => {
          clearCartDesignCache(id);
          return refreshDesignLine(id, { display, proofUrl: res.proof_url });
        })
        .catch(() => undefined);
    },
    [client, refreshDesignLine],
  );

  const submit = useCallback(
    async ({ blockedReason, onAddToCart, onDone }: SubmitOptions) => {
      if (submittingRef.current) return;
      setSubmitError('');
      const full = validateState(spec, draft.state, { requireComplete: true });
      if (!full.ok) {
        // Inline messages under the fields, a summary above the CTA, focus on the first.
        setShowAll(true);
        const first = full.errors[0]?.element_id;
        if (first) focusElement(first);
        return;
      }
      if (!inCart && blockedReason) {
        setSubmitError(blockedReason);
        return;
      }
      submittingRef.current = true;
      setSubmitting(true);
      try {
        // Pending edits (or an existing design) are flushed; a template
        // without required inputs can be added untouched, so the draft is
        // created then. A flush that resolves null failed (network, or the
        // design got locked / lost meanwhile and the hook started a fresh
        // state): stop here rather than create and add a blank design that
        // never passed the completeness check above.
        const saved =
          draft.design || draft.isDirty() ? await draft.flush() : await draft.ensureDesign().catch(() => null);
        if (!saved || draft.isDirty()) {
          setSubmitError(draft.saveError ? apiError(draft.saveError) : t('saveFailed'));
          return;
        }
        const display = displayLines();
        if (inCart) {
          clearCartDesignCache(saved.id);
          try {
            await refreshDesignLine(saved.id, { display });
          } catch {
            // The cart re-reads itself on the next visit.
          }
          requestProof(saved.id, display);
          onDone?.('saved');
          router.push(lp('/cart'));
          return;
        }
        await onAddToCart({ designId: saved.id, token: getDesignToken(saved.id), proofUrl: null, display });
        // The design lives in the cart now; a later visit starts a new one.
        setDraftFor(productId, null);
        requestProof(saved.id, display);
        onDone?.('added');
      } catch (err) {
        setSubmitError(apiError(err));
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [spec, draft, inCart, focusElement, apiError, t, displayLines, refreshDesignLine, requestProof, router, lp, productId],
  );

  // ── Start again from an ordered design ─────────────────────────────────
  const [restarting, setRestarting] = useState(false);
  const startAgain = useCallback(async () => {
    const source = draft.lockedFrom;
    if (!source || restarting) return;
    setRestarting(true);
    setSubmitError('');
    try {
      const view = await draft.duplicateFrom(source);
      // The ordered design's cart line (e.g. after a failed payment) moves to the copy.
      if (cartItems.some((i) => i.designId === source)) {
        await replaceDesignLine(source, {
          id: view.id,
          token: getDesignToken(view.id),
          proofUrl: view.proof_url,
          productSlug: view.product_slug ?? null,
        });
        clearCartDesignCache(source);
      }
    } catch (err) {
      setSubmitError(apiError(err));
    } finally {
      setRestarting(false);
    }
  }, [draft, restarting, cartItems, replaceDesignLine, apiError]);

  // Editing needs the session (D2): before it is restored, a PATCH or an
  // upload could not be sent, so the canvas stays a skeleton.
  const ready = fontsReady && !imgs.templatePending && !draft.loading && draft.clientReady;

  const session: DesignerSession = {
    spec,
    draft,
    slots,
    texts,
    renderState,
    images: imgs.images,
    fonts: fontLookup,
    renderKey: `${imgs.version}:${fontTick}:${fontsReady ? 1 : 0}`,
    ready,
    fontsMissing,
    fontsSlow,
    retryFonts,
    activeSlotId,
    setActiveSlotId,
    toggleActiveSlot,
    progress,
    slotErrors,
    hasRetry: (id) => Boolean(retryFiles[id]),
    pick: (id, file) => void pick(id, file),
    cancelUpload,
    retry,
    remove: (id) => void remove(id),
    adjust,
    fitted,
    onReport,
    errorFor,
    missing,
    errorCount,
    dragged,
    markDragged,
    registerSlot,
    registerText,
    openPicker,
    focusText,
    inCart,
    uploading,
    submitting,
    submitError,
    submit,
    restarting,
    startAgain,
  };

  // Published after every render (the host never reads the session context,
  // so this cannot loop); consumers in any section re-render with it.
  useLayoutEffect(() => {
    publish(session);
  });
  useEffect(() => () => publish(null), [publish]);

  return null;
}

// ── Canvas (gallery column) ───────────────────────────────────────────────

export function DesignerCanvasInline() {
  const ctx = useDesignerSession();
  const t = useTranslations('designer');
  const emptySlotText = useCallback(() => t('tapToUpload'), [t]);
  const s = ctx?.session;
  if (!ctx || !s) return <CanvasSkeleton />;
  const ratio = s.spec.width / s.spec.height;
  const hasPhoto = s.slots.some((sl) => Boolean(s.renderState.photos[sl.id]));
  return (
    <div data-designer-ui>
      <div className="relative w-full overflow-hidden rounded-xl bg-gray-100" style={{ aspectRatio: String(ratio) }}>
        <DesignerCanvas
          spec={s.spec}
          state={s.renderState}
          images={s.images}
          fonts={s.fonts}
          renderKey={s.renderKey}
          mode="edit"
          locale={ctx.locale}
          activeSlotId={s.activeSlotId}
          onActivate={s.setActiveSlotId}
          onAdjChange={s.adjust}
          onDragStart={s.markDragged}
          onEmptySlotTap={s.openPicker}
          onTextTap={s.focusText}
          onReport={s.onReport}
          emptySlotText={emptySlotText}
          label={t('canvasLabel')}
          keyboardHelp={t('keyboardHelp')}
          className={`absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none ${s.ready ? 'opacity-100' : 'opacity-0'}`}
        />
        {!s.ready && (
          <div className="absolute inset-0 flex items-center justify-center animate-pulse bg-gray-100 motion-reduce:animate-none" aria-live="polite">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400 motion-reduce:animate-none" aria-label={t('loading')} />
          </div>
        )}
      </div>
      {s.ready && hasPhoto && !s.dragged && (
        <p className="mt-2 text-center text-xs italic text-gray-400">{t('dragHint')}</p>
      )}
      {s.ready && s.fontsMissing && (
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-center text-xs text-gray-500" aria-live="polite">
          {s.fontsSlow ? (
            <>
              <span>{t('fontsSlow')}</span>
              <button type="button" onClick={s.retryFonts} className="inline-flex min-h-11 items-center px-2 font-medium underline">
                {t('retryFonts')}
              </button>
            </>
          ) : (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              <span>{t('loadingFonts')}</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}

// ── Form (summary column) ─────────────────────────────────────────────────

export interface DesignerFormProps {
  /** Formatted line total (unit × quantity) shown in the CTA label. */
  totalLabel: string;
  /** The page's quantity picker, placed next to the CTA. */
  quantitySelector?: ReactNode;
  /** Why the line cannot be added yet (e.g. no variant picked); null when it can. */
  blockedReason?: string | null;
  /** Replaces the CTA row while the page shows its "added" confirmation. */
  addedContent?: ReactNode;
  onAddToCart: (line: DesignedLine) => Promise<void>;
  onDone?: (kind: 'added' | 'saved') => void;
  buttonClassName?: string;
  buttonStyle?: CSSProperties;
}

export function DesignerFormInline({
  totalLabel,
  quantitySelector,
  blockedReason,
  addedContent,
  onAddToCart,
  onDone,
  buttonClassName,
  buttonStyle,
}: DesignerFormProps) {
  const ctx = useDesignerSession();
  const t = useTranslations('designer');
  const heading = useDesignerHeading(ctx?.locale ?? 'en');
  const s = ctx?.session;
  if (!ctx || !s) return <FormSkeleton />;
  const { draft } = s;
  const noticeText =
    draft.notice === 'stale'
      ? t('noticeStale')
      : draft.notice === 'locked'
        ? t('noticeLocked')
        : draft.notice === 'outdated'
          ? t('noticeOutdated')
          : draft.notice === 'notFound'
            ? t('noticeNotFound')
            : null;
  const blocked = !s.inCart && Boolean(blockedReason);
  const busy = s.submitting || s.uploading;
  const saveState = draft.saving ? t('saving') : draft.saveError ? t('saveFailed') : draft.design ? t('savedShort') : '';

  return (
    <div className="space-y-5" data-designer-form data-designer-ui>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <span className="h-4 w-1 rounded-full" style={{ backgroundColor: 'var(--store-primary, #2563eb)' }} aria-hidden="true" />
        {heading}
      </h3>

      {noticeText && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 rounded-lg bg-amber-50 px-3 py-1 text-xs text-amber-900" role="status">
          <span className="py-2">{noticeText}</span>
          <div className="flex shrink-0 items-center gap-1">
            {draft.notice === 'locked' && draft.lockedFrom && (
              <button
                type="button"
                onClick={() => void s.startAgain()}
                disabled={s.restarting}
                className="inline-flex min-h-11 items-center gap-1 px-2 font-semibold underline disabled:opacity-50"
              >
                {s.restarting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {t('startAgain')}
              </button>
            )}
            <button type="button" onClick={draft.clearNotice} className="inline-flex min-h-11 items-center px-2 underline">
              {t('dismiss')}
            </button>
          </div>
        </div>
      )}

      {s.inCart && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900" role="status">
          {t('editingCartLine')}
        </p>
      )}

      {s.slots.map((el) => (
        <PhotoSlotControl
          key={el.id}
          ref={(h) => s.registerSlot(el.id, h)}
          el={el}
          photo={draft.state.photos[el.id]}
          locale={ctx.locale}
          active={s.activeSlotId === el.id}
          progress={s.progress[el.id] ?? null}
          error={s.slotErrors[el.id] || (s.errorFor[el.id] && s.errorFor[el.id] !== 'photo_required' ? t('photoInvalid') : null)}
          missing={s.missing.has(el.id)}
          maxUploadMb={ctx.payload.settings.max_upload_mb}
          minDpi={ctx.payload.settings.min_effective_dpi_warning}
          onPick={(f) => s.pick(el.id, f)}
          onCancelUpload={() => s.cancelUpload(el.id)}
          onRetry={s.hasRetry(el.id) ? () => s.retry(el.id) : undefined}
          onAdj={(adj) => s.adjust(el.id, adj)}
          onRemove={() => s.remove(el.id)}
          onActivate={() => s.toggleActiveSlot(el.id)}
        />
      ))}

      {s.texts.length > 0 && (
        <div className="space-y-3">
          {s.slots.length > 0 && <h4 className="text-sm font-semibold text-gray-900">{t('fillDetails')}</h4>}
          {s.texts.map((el) => (
            <TextFieldControl
              key={el.id}
              ref={(node) => s.registerText(el.id, node)}
              el={el}
              value={draft.state.texts[el.id] ?? ''}
              locale={ctx.locale}
              fitted={s.fitted[el.id]}
              error={s.missing.has(el.id) ? 'required' : (s.errorFor[el.id] ?? null)}
              onChange={(v) => draft.setText(el.id, v)}
            />
          ))}
        </div>
      )}

      <div className="space-y-3">
        {s.errorCount > 0 && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {t('errorsSummary', { count: s.errorCount })}
          </p>
        )}
        {s.submitError && (
          <p className="text-sm text-red-600" role="alert">
            {s.submitError}
          </p>
        )}
        {addedContent ?? (
          <div className="flex flex-wrap items-center gap-3">
            {quantitySelector}
            <button
              type="button"
              onClick={() => void s.submit({ blockedReason, onAddToCart, onDone })}
              disabled={!s.ready || busy || s.fontsMissing || blocked}
              aria-busy={busy || undefined}
              className={
                buttonClassName ??
                'flex min-h-11 min-w-48 flex-1 items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:opacity-90 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none'
              }
              style={buttonStyle ?? { backgroundColor: 'var(--store-primary, #2563eb)' }}
              data-designer-cta
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="tabular-nums">{s.inCart ? t('saveChanges') : t('addToCartWithPrice', { price: totalLabel })}</span>
            </button>
          </div>
        )}
        <p className="min-h-4 text-xs text-gray-400" aria-live="polite">
          {saveState}
        </p>
      </div>
    </div>
  );
}
