'use client';

// ── Designer: one photo slot of the inline form (M4.2 §7.1, M5.5) ─────────
// NPP's upload card (icon, title, hint, "choose" pill) while the slot is
// empty; once a photo is placed, its adjustment card: zoom / rotate and the
// two pan sliders in a 2×2 grid, each with a reset, then replace / remove.
// Every target is at least 44 px. The low-resolution warning shows inline.

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ImagePlus, Loader2, RotateCcw, Trash2, AlertTriangle, Move, X } from 'lucide-react';
import {
  DEFAULT_ADJ,
  effectiveDpi,
  pickI18n,
  type DesignPhoto,
  type ImageSlotElement,
  type PhotoAdj,
} from '@multi-stores/core/designer';
import { clampAdj, limitsOf } from '@/lib/designer/gestures';

export const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

export interface PhotoSlotHandle {
  openPicker: () => void;
  focus: () => void;
}

interface Props {
  el: ImageSlotElement;
  photo?: DesignPhoto;
  locale?: string;
  active: boolean;
  /** 0..1 while uploading, null otherwise. */
  progress: number | null;
  error?: string | null;
  /** Show the required error (after a submit attempt). */
  missing?: boolean;
  maxUploadMb: number;
  minDpi: number;
  onPick: (file: File) => void;
  /** Aborts the running upload (D14). */
  onCancelUpload?: () => void;
  /** Re-uploads the last picked file after a failure; absent when there is none. */
  onRetry?: () => void;
  onAdj: (adj: PhotoAdj) => void;
  onRemove: () => void;
  onActivate: () => void;
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  onChange,
  format,
  ltr,
  resetLabel,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  ltr?: boolean;
  resetLabel: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-600">
        <span>{label}</span>
        {format && <span className="font-normal normal-case tabular-nums text-gray-400">{format(value)}</span>}
      </label>
      <div className="flex items-center gap-1">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          // Pan sliders follow the canvas axes, which are never mirrored.
          dir={ltr ? 'ltr' : undefined}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-11 min-w-0 flex-1 accent-(--store-primary,#2563eb)"
        />
        <button
          type="button"
          onClick={() => onChange(defaultValue)}
          disabled={value === defaultValue}
          aria-label={resetLabel}
          title={resetLabel}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export const PhotoSlotControl = forwardRef<PhotoSlotHandle, Props>(function PhotoSlotControl(
  { el, photo, locale, active, progress, error, missing, maxUploadMb, minDpi, onPick, onCancelUpload, onRetry, onAdj, onRemove, onActivate },
  ref,
) {
  const t = useTranslations('designer');
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({
    openPicker: () => inputRef.current?.click(),
    focus: () => {
      const box = boxRef.current;
      if (!box) return;
      if (typeof box.scrollIntoView === 'function') box.scrollIntoView({ block: 'center' });
      box.focus({ preventScroll: true });
    },
  }));

  const label = pickI18n(el.label, locale) || t('photoLabel');
  const limits = limitsOf(el);
  const defaults = el.default_adj ?? DEFAULT_ADJ;
  const adj = photo?.adj ?? defaults;
  const set = (patch: Partial<PhotoAdj>) => onAdj(clampAdj({ ...adj, ...patch }, limits));
  const dpi = photo ? effectiveDpi(el, photo.width, photo.height, adj) : 0;
  const lowRes = photo ? dpi > 0 && dpi < minDpi : false;
  const uploading = progress !== null;
  const base = `designer-slot-${el.id}`;

  return (
    <div
      ref={boxRef}
      tabIndex={-1}
      className={`space-y-3 rounded-xl border p-3 outline-none transition-colors motion-reduce:transition-none ${
        missing ? 'border-red-300 bg-red-50/40' : active ? 'border-gray-400' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">
          {label}
          {el.required && <span className="ms-0.5 text-red-500" aria-hidden="true">*</span>}
        </h4>
        {photo && !uploading && (
          <button
            type="button"
            onClick={onActivate}
            aria-pressed={active}
            className={`inline-flex min-h-11 items-center gap-1 rounded-md px-3 py-2 text-xs font-medium ${
              active ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Move className="h-3.5 w-3.5" aria-hidden="true" />
            {t('adjustPhoto')}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        id={`${base}-file`}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onPick(f);
        }}
      />

      {uploading ? (
        <div className="space-y-1.5" aria-live="polite">
          <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {t('uploading', { percent: Math.round((progress ?? 0) * 100) })}
            </span>
            {onCancelUpload && (
              <button
                type="button"
                onClick={onCancelUpload}
                className="inline-flex min-h-11 items-center gap-1 px-2 font-medium text-gray-700 underline hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                {t('cancelUpload')}
              </button>
            )}
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((progress ?? 0) * 100)}
            aria-label={t('uploadTitle')}
          >
            <div
              className="h-full rounded-full transition-[width] motion-reduce:transition-none"
              style={{ width: `${Math.round((progress ?? 0) * 100)}%`, backgroundColor: 'var(--store-primary, #2563eb)' }}
            />
          </div>
        </div>
      ) : !photo ? (
        // NPP's upload card: icon, title + hint, "choose" pill; the whole card picks.
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-3.5 rounded-xl border border-gray-200 bg-white p-3.5 text-start shadow-sm transition hover:border-gray-300 hover:shadow motion-reduce:transition-none"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600" aria-hidden="true">
            <ImagePlus className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-gray-900">{t('uploadTitle')}</span>
            <span className="block text-xs text-gray-500">{t('uploadHint', { max: maxUploadMb })}</span>
          </span>
          <span className="shrink-0 rounded-full bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white">{t('chooseFile')}</span>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
            <Slider
              id={`${base}-zoom`}
              label={t('zoom')}
              value={adj.zoom}
              min={limits.zoom[0]}
              max={limits.zoom[1]}
              step={0.05}
              defaultValue={defaults.zoom}
              onChange={(v) => set({ zoom: v })}
              format={(v) => `${Math.round(v * 100)}%`}
              resetLabel={t('reset')}
            />
            <Slider
              id={`${base}-rot`}
              label={t('rotate')}
              value={adj.rot}
              min={limits.rot[0]}
              max={limits.rot[1]}
              step={1}
              defaultValue={defaults.rot}
              onChange={(v) => set({ rot: v })}
              format={(v) => `${Math.round(v)}°`}
              resetLabel={t('reset')}
            />
            <Slider
              id={`${base}-panx`}
              label={t('panX')}
              value={adj.panX}
              min={0}
              max={1}
              step={0.01}
              defaultValue={defaults.panX}
              onChange={(v) => set({ panX: v })}
              resetLabel={t('reset')}
              ltr
            />
            <Slider
              id={`${base}-pany`}
              label={t('panY')}
              value={adj.panY}
              min={0}
              max={1}
              step={0.01}
              defaultValue={defaults.panY}
              onChange={(v) => set({ panY: v })}
              resetLabel={t('reset')}
              ltr
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('replacePhoto')}
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:border-red-200 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('remove')}
            </button>
          </div>
        </div>
      )}

      {lowRes && !uploading && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800" role="status">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('lowRes', { dpi: Math.round(dpi) })}
        </p>
      )}
      {error && (
        <p className="flex flex-wrap items-center gap-x-3 text-xs text-red-600" role="alert">
          <span>{error}</span>
          {onRetry && !uploading && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-11 items-center gap-1 px-2 font-semibold text-gray-900 underline"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {t('tryAgain')}
            </button>
          )}
        </p>
      )}
      {!error && missing && <p className="text-xs text-red-600">{t('photoRequired')}</p>}
    </div>
  );
});
