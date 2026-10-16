'use client';

// ── Designer editor (M4.2 §7) ─────────────────────────────────────────────
// Full-screen, mobile-first dialog: the live canvas (web scale) above the
// panel on phones, side by side on desktop. Photo slots first, then texts
// (NPP order). "Add to cart" validates the design (validateState with
// requireComplete), saves it, asks the server for the proof and shows it for
// approval; when the render engine is unavailable (503) the live preview is
// shown instead and the order still goes through (§7.4).
//
// Loaded with next/dynamic (ssr:false) by DesignerLauncher, so the editor
// code only ships to designer products.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Check, Loader2, RefreshCw, ShoppingCart, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useApiError } from '@/lib/useApiError';
import {
  DEFAULT_ADJ,
  pickI18n,
  validateState,
  type DesignStateV1,
  type ImageSlotElement,
  type PhotoAdj,
  type RenderReport,
  type TextElement,
} from '@/lib/designer/design-renderer';
import {
  absoluteUrl,
  createDesignerClient,
  designerClientOptions,
  designerErrorCode,
  getDesignToken,
  isUploadNetworkError,
  setDraftFor,
  type DesignerPayload,
} from '@/lib/designer/api';
import { loadDesignerFonts, missingFontKeys, payloadFontLookup } from '@/lib/designer/fonts';
import { clearCartDesignCache } from './useCartDesign';
import { DesignerCanvas } from './DesignerCanvas';
import { PhotoSlotControl, ACCEPTED_TYPES, type PhotoSlotHandle } from './PhotoSlotControl';
import { TextFieldControl } from './TextFieldControl';
import { useDesignDraft } from './useDesignDraft';
import { downscaleForPreview, useDesignerImages } from './useDesignerImages';

/** What the host page adds to the cart once the customer approved the proof. */
export interface DesignedLine {
  designId: string;
  /** Guest token (null for logged-in customers). */
  token: string | null;
  /** Signed proof path (relative), null when the render engine was unavailable. */
  proofUrl: string | null;
  /** Text values as cart display lines ("Name: Anna"). */
  display: { id: string; label: string; value: string }[];
}

export interface DesignerEditorProps {
  payload: DesignerPayload;
  productId: string;
  storeSlug: string;
  locale: string;
  productTitle: string;
  priceLabel?: string;
  initialDesignId: string | null;
  /** Why the line cannot be added yet (e.g. no variant picked); null when it can. */
  blockedReason?: string | null;
  /**
   * Inline option picker shown on the review step while `blockedReason` is a
   * missing variant (the page's own picker is hidden under the dialog).
   */
  variantPicker?: ReactNode;
  onClose: () => void;
  onAddToCart: (line: DesignedLine) => Promise<void>;
  /** After "add to cart" succeeded (or the changes of a cart line were saved). */
  onDone?: (kind: 'added' | 'saved') => void;
}

type Step = 'edit' | 'review';

export default function DesignerEditor({
  payload,
  productId,
  storeSlug,
  locale,
  productTitle,
  priceLabel,
  initialDesignId,
  blockedReason,
  variantPicker,
  onClose,
  onAddToCart,
  onDone,
}: DesignerEditorProps) {
  const t = useTranslations('designer');
  const apiError = useApiError();
  const { token: authToken, loading: authLoading } = useAuth();
  const { items: cartItems, refreshDesignLine, replaceDesignLine } = useCart();
  const spec = payload.spec_public;
  // No client until the session is restored: a claimed design answers to the JWT only.
  const client = useMemo(() => {
    const o = designerClientOptions(storeSlug, { token: authToken, loading: authLoading });
    return o ? createDesignerClient(o) : null;
  }, [storeSlug, authToken, authLoading]);

  const draft = useDesignDraft({
    client,
    productId,
    templateVersionId: payload.template_version_id,
    spec,
    initialDesignId,
  });
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
  // instead of fitting it with a fallback font; the preview is blocked until
  // every face is there.
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

  // ── Local photo previews while uploading ───────────────────────────────
  const [pending, setPending] = useState<Record<string, { width: number; height: number }>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

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

  const handlePick = useCallback(
    async (slotId: string, file: File) => {
      setSlotErrors((e) => ({ ...e, [slotId]: '' }));
      if (file.type && !ACCEPTED_TYPES.split(',').includes(file.type)) {
        setSlotErrors((e) => ({ ...e, [slotId]: t('fileType') }));
        return;
      }
      if (file.size > payload.settings.max_upload_mb * 1024 * 1024) {
        setSlotErrors((e) => ({ ...e, [slotId]: t('fileTooLarge', { max: payload.settings.max_upload_mb }) }));
        return;
      }
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
        const res = await draft.uploadPhoto(slotId, file, (f) => setProgress((p) => ({ ...p, [slotId]: f })));
        if (preview) imgs.setLocal(res.asset_id, preview.bitmap);
        setActiveSlotId(slotId);
      } catch (err) {
        // A network failure / abort never reached the API: no API code.
        setSlotErrors((e) => ({ ...e, [slotId]: isUploadNetworkError(err) ? t('uploadFailed') : apiError(err) }));
      } finally {
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
    [draft, imgs, payload.settings.max_upload_mb, apiError, t],
  );

  const handleRemove = useCallback(
    async (slotId: string) => {
      setSlotErrors((e) => ({ ...e, [slotId]: '' }));
      try {
        await draft.removePhoto(slotId);
        if (activeSlotId === slotId) setActiveSlotId(null);
      } catch (err) {
        setSlotErrors((e) => ({ ...e, [slotId]: apiError(err) }));
      }
    },
    [draft, activeSlotId, apiError],
  );

  const handleAdj = useCallback(
    (slotId: string, adj: PhotoAdj) => {
      if (pending[slotId]) return; // adjust after the upload landed
      draft.setAdj(slotId, adj);
    },
    [draft, pending],
  );

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
  const missing = useMemo(() => {
    const m = new Set<string>();
    if (!showAll) return m;
    for (const s of slots) if (s.required && !renderState.photos[s.id]) m.add(s.id);
    for (const tx of texts) if (tx.required && !(draft.state.texts[tx.id] || '').trim()) m.add(tx.id);
    return m;
  }, [showAll, slots, texts, renderState.photos, draft.state.texts]);

  // ── Review / add to cart ───────────────────────────────────────────────
  const [step, setStep] = useState<Step>('edit');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const uploading = Object.keys(progress).length > 0;

  const designId = draft.design?.id ?? null;
  const inCart = Boolean(
    designId && (draft.design?.status === 'IN_CART' || cartItems.some((i) => i.designId === designId)),
  );

  const focusElement = useCallback((id: string) => {
    if (slotRefs.current[id]) slotRefs.current[id]!.focus();
    else textRefs.current[id]?.focus();
  }, []);

  const startReview = useCallback(async () => {
    setSubmitError('');
    const full = validateState(spec, draft.state, { requireComplete: true });
    if (!full.ok) {
      setShowAll(true);
      setSubmitError(t('fixErrors'));
      const first = full.errors[0]?.element_id;
      if (first) focusElement(first);
      return;
    }
    setStep('review');
    setProofUrl(null);
    setProofLoading(true);
    // A template without required inputs can be reviewed untouched: create the draft then.
    const saved = (await draft.flush()) ?? (await draft.ensureDesign().catch(() => null));
    if (!saved || draft.isDirty()) {
      setProofLoading(false);
      setStep('edit');
      setSubmitError(draft.saveError ? apiError(draft.saveError) : t('saveFailed'));
      return;
    }
    if (!client) {
      setProofLoading(false);
      return;
    }
    try {
      const res = await client.proof(saved.id);
      setProofUrl(res.proof_url);
    } catch {
      // 503 DESIGNER_RENDER_UNAVAILABLE or any failure: the live preview stands in.
      setProofUrl(null);
    } finally {
      setProofLoading(false);
    }
  }, [spec, draft, client, focusElement, apiError, t]);

  // Text values as cart display lines ("Name: Anna").
  const displayLines = useCallback(
    () =>
      texts
        .map((el) => ({
          id: el.id,
          label: pickI18n(el.label, locale) || el.source_label || el.id,
          value: draft.state.texts[el.id] ?? '',
        }))
        .filter((l) => l.value !== ''),
    [texts, locale, draft.state.texts],
  );

  // A design that is in the cart: show its new texts / proof on the line.
  const refreshCartLine = useCallback(
    async (id: string, proof?: string | null) => {
      clearCartDesignCache(id);
      try {
        await refreshDesignLine(id, { display: displayLines(), ...(proof !== undefined ? { proofUrl: proof } : {}) });
      } catch {
        // The cart re-reads itself on the next visit.
      }
    },
    [refreshDesignLine, displayLines],
  );

  // ── Dialog close (declared early: "Save changes" closes too) ────────────
  const [closeWarning, setCloseWarning] = useState(false);
  const finishClose = useCallback(() => {
    const id = draft.design?.id;
    void draft.flush().then((saved) => {
      if (inCart && id) void refreshCartLine(saved?.id ?? id);
    });
    onClose();
  }, [draft, inCart, refreshCartLine, onClose]);

  const confirm = useCallback(async () => {
    const d = draft.design;
    if (!d || submitting) return;
    setSubmitError('');
    if (inCart) {
      setSubmitting(true);
      await refreshCartLine(d.id, proofUrl);
      setSubmitting(false);
      onDone?.('saved');
      onClose();
      return;
    }
    if (blockedReason) {
      setSubmitError(blockedReason);
      return;
    }
    setSubmitting(true);
    try {
      const display = displayLines();
      await onAddToCart({ designId: d.id, token: getDesignToken(d.id), proofUrl, display });
      // The next "Design" click starts a new design; this one lives in the cart.
      setDraftFor(productId, null);
      onDone?.('added');
      onClose();
    } catch (err) {
      const code = designerErrorCode(err);
      setSubmitError(apiError(err));
      if (code === 'DESIGNER_STATE_INVALID') setStep('edit');
    } finally {
      setSubmitting(false);
    }
  }, [draft, submitting, inCart, blockedReason, displayLines, refreshCartLine, proofUrl, onAddToCart, productId, onDone, onClose, apiError]);

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

  // ── Dialog behaviour: scroll lock, Escape, focus ───────────────────────
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    // A design in the cart must stay orderable: warn when it is incomplete.
    if (inCart && !closeWarning && !validateState(spec, draft.state, { requireComplete: true }).ok) {
      setCloseWarning(true);
      return;
    }
    finishClose();
  }, [inCart, closeWarning, spec, draft.state, finishClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onDialogKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (closeWarning) setCloseWarning(false);
      else if (step === 'review') setStep('edit');
      else close();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    // Keep focus inside the dialog.
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), canvas[tabindex="0"], [href], [tabindex="0"]',
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const ready = fontsReady && !imgs.templatePending && !draft.loading;
  const ratio = spec.width / spec.height;
  const emptySlotText = useCallback(() => t('tapToUpload'), [t]);
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

  const canvas = (mode: 'edit' | 'proof') => (
    <DesignerCanvas
      spec={spec}
      state={renderState}
      images={imgs.images}
      fonts={fontLookup}
      renderKey={`${imgs.version}:${fontTick}:${fontsReady ? 1 : 0}`}
      mode={mode}
      locale={locale}
      interactive={mode === 'edit'}
      activeSlotId={mode === 'edit' ? activeSlotId : null}
      onActivate={setActiveSlotId}
      onAdjChange={handleAdj}
      onEmptySlotTap={(id) => slotRefs.current[id]?.openPicker()}
      onTextTap={(id) => textRefs.current[id]?.focus()}
      onReport={mode === 'edit' ? onReport : undefined}
      emptySlotText={emptySlotText}
      label={mode === 'edit' ? t('canvasLabel') : t('reviewTitle')}
      keyboardHelp={t('keyboardHelp')}
      className="mx-auto w-full max-w-[calc(var(--dz-h)*var(--dz-r))]"
    />
  );

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="designer-title"
      onKeyDown={onDialogKeyDown}
      className="fixed inset-0 z-[100] flex flex-col bg-white text-start"
      style={{ ['--dz-r' as string]: String(ratio) }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        {step === 'review' ? (
          <button
            type="button"
            onClick={() => setStep('edit')}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
            aria-label={t('backToEdit')}
          >
            <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 id="designer-title" className="truncate text-base font-semibold text-gray-900">
            {step === 'review' ? t('reviewTitle') : productTitle}
          </h2>
          {step === 'edit' && (
            <p className="text-xs text-gray-500" aria-live="polite">
              {draft.saving ? t('saving') : draft.saveError ? t('saveFailed') : draft.design ? t('saved') : t('fillDetails')}
            </p>
          )}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
          aria-label={t('close')}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {noticeText && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 bg-amber-50 px-4 py-1 text-xs text-amber-900" role="status">
          <span className="py-2">{noticeText}</span>
          <div className="flex shrink-0 items-center gap-1">
            {draft.notice === 'locked' && draft.lockedFrom && (
              <button
                type="button"
                onClick={() => void startAgain()}
                disabled={restarting}
                className="inline-flex min-h-11 items-center gap-1 px-2 font-semibold underline disabled:opacity-50"
              >
                {restarting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
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

      {closeWarning && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 bg-red-50 px-4 py-1 text-xs text-red-800" role="alert">
          <span className="py-2">{t('incompleteInCart')}</span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setCloseWarning(false);
                setShowAll(true);
                const first = validateState(spec, draft.state, { requireComplete: true }).errors[0]?.element_id;
                if (first) focusElement(first);
              }}
              className="inline-flex min-h-11 items-center px-2 font-semibold underline"
            >
              {t('keepEditing')}
            </button>
            <button type="button" onClick={finishClose} className="inline-flex min-h-11 items-center px-2 underline">
              {t('closeAnyway')}
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      {step === 'edit' ? (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="shrink-0 bg-gray-100 px-4 py-3 [--dz-h:40vh] md:flex md:min-w-0 md:flex-1 md:items-center md:justify-center md:p-6 md:[--dz-h:calc(100dvh-10rem)]">
            {ready ? (
              canvas('edit')
            ) : (
              <div
                className="mx-auto flex w-full max-w-[calc(var(--dz-h)*var(--dz-r))] items-center justify-center rounded-md bg-gray-200 animate-pulse"
                style={{ aspectRatio: String(ratio) }}
              >
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" aria-label={t('loading')} />
              </div>
            )}
            {ready && fontsMissing && (
              <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-center text-xs text-gray-500" aria-live="polite">
                {fontsSlow ? (
                  <>
                    <span>{t('fontsSlow')}</span>
                    <button type="button" onClick={retryFonts} className="inline-flex min-h-11 items-center px-2 font-medium underline">
                      {t('retryFonts')}
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>{t('loadingFonts')}</span>
                  </>
                )}
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:w-[26rem] md:flex-none md:border-s md:border-gray-100">
            <div className="space-y-4">
              {slots.map((el) => (
                <PhotoSlotControl
                  key={el.id}
                  ref={(h) => {
                    slotRefs.current[el.id] = h;
                  }}
                  el={el}
                  photo={draft.state.photos[el.id]}
                  locale={locale}
                  active={activeSlotId === el.id}
                  progress={progress[el.id] ?? null}
                  error={slotErrors[el.id] || (errorFor[el.id] && errorFor[el.id] !== 'photo_required' ? t('photoInvalid') : null)}
                  missing={missing.has(el.id)}
                  maxUploadMb={payload.settings.max_upload_mb}
                  minDpi={payload.settings.min_effective_dpi_warning}
                  onPick={(f) => void handlePick(el.id, f)}
                  onAdj={(adj) => handleAdj(el.id, adj)}
                  onRemove={() => void handleRemove(el.id)}
                  onActivate={() => setActiveSlotId((cur) => (cur === el.id ? null : el.id))}
                />
              ))}
              {texts.length > 0 && (
                <div className="space-y-3">
                  {slots.length > 0 && <h3 className="text-sm font-semibold text-gray-900">{t('fillDetails')}</h3>}
                  {texts.map((el) => (
                    <TextFieldControl
                      key={el.id}
                      ref={(node) => {
                        textRefs.current[el.id] = node;
                      }}
                      el={el}
                      value={draft.state.texts[el.id] ?? ''}
                      locale={locale}
                      fitted={fitted[el.id]}
                      error={missing.has(el.id) ? 'required' : errorFor[el.id] ?? null}
                      onChange={(v) => draft.setText(el.id, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-gray-100 px-4 py-4 [--dz-h:60vh] md:[--dz-h:calc(100dvh-12rem)]">
          <p className="mb-3 max-w-xl text-center text-sm text-gray-600">{t('reviewHint')}</p>
          {proofLoading ? (
            <div
              className="flex w-full max-w-[calc(var(--dz-h)*var(--dz-r))] flex-col items-center justify-center gap-2 rounded-md bg-gray-200"
              style={{ aspectRatio: String(ratio) }}
              aria-live="polite"
            >
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" aria-hidden="true" />
              <span className="text-xs text-gray-600">{t('preparingPreview')}</span>
            </div>
          ) : proofUrl ? (
            // Signed, short-lived proof from the API (not optimizable by next/image).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={absoluteUrl(proofUrl)}
              alt={t('reviewTitle')}
              className="w-full max-w-[calc(var(--dz-h)*var(--dz-r))] rounded-md bg-white shadow-sm"
              style={{ aspectRatio: String(ratio) }}
              onError={() => setProofUrl(null)}
            />
          ) : (
            <>
              {canvas('proof')}
              <p className="mt-2 text-center text-xs text-gray-500">{t('previewPending')}</p>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-3">
        {step === 'review' && !inCart && blockedReason && variantPicker && (
          <div className="mb-3 max-h-[40vh] overflow-y-auto">{variantPicker}</div>
        )}
        {(submitError || (step === 'review' && blockedReason && !inCart)) && (
          <p className="mb-2 text-sm text-red-600" role="alert">
            {submitError || blockedReason}
          </p>
        )}
        <div className="flex items-center gap-3">
          {priceLabel && <span className="text-base font-semibold text-gray-900 tabular-nums">{priceLabel}</span>}
          {step === 'edit' ? (
            <button
              type="button"
              onClick={() => void startReview()}
              disabled={!ready || uploading || fontsMissing}
              className="ms-auto inline-flex min-w-40 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t('review')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={proofLoading || submitting || (!inCart && Boolean(blockedReason))}
              className="ms-auto inline-flex min-w-40 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : inCart ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              )}
              {inCart ? t('saveChanges') : t('addToCart')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
