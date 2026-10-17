'use client';

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
} from '@/lib/designer/design-renderer';
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
  onChange,
  format,
  ltr,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  ltr?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        {format && <span className="tabular-nums text-gray-400">{format(value)}</span>}
      </label>
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
        className="w-full accent-[var(--store-primary,#2563eb)]"
      />
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
    focus: () => boxRef.current?.focus(),
  }));

  const label = pickI18n(el.label, locale) || t('photoLabel');
  const limits = limitsOf(el);
  const adj = photo?.adj ?? el.default_adj ?? DEFAULT_ADJ;
  const set = (patch: Partial<PhotoAdj>) => onAdj(clampAdj({ ...adj, ...patch }, limits));
  const dpi = photo ? effectiveDpi(el, photo.width, photo.height, adj) : 0;
  const lowRes = photo ? dpi > 0 && dpi < minDpi : false;
  const uploading = progress !== null;
  const base = `designer-slot-${el.id}`;

  return (
    <div
      ref={boxRef}
      tabIndex={-1}
      className={`rounded-xl border p-3 space-y-3 outline-none ${
        missing ? 'border-red-300 bg-red-50/40' : active ? 'border-gray-400' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          {label}
          {el.required && <span className="ms-0.5 text-red-500" aria-hidden="true">*</span>}
        </h3>
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
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
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
              className="h-full rounded-full transition-[width]"
              style={{ width: `${Math.round((progress ?? 0) * 100)}%`, backgroundColor: 'var(--store-primary, #2563eb)' }}
            />
          </div>
        </div>
      ) : !photo ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 px-3 py-5 text-center hover:border-gray-400 hover:bg-gray-50"
        >
          <ImagePlus className="h-6 w-6 text-gray-400" aria-hidden="true" />
          <span className="text-sm font-medium text-gray-900">{t('chooseFile')}</span>
          <span className="text-xs text-gray-500">{t('uploadHint', { max: maxUploadMb })}</span>
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{t('tapToAdjust')}</p>
          <Slider
            id={`${base}-zoom`}
            label={t('zoom')}
            value={adj.zoom}
            min={limits.zoom[0]}
            max={limits.zoom[1]}
            step={0.05}
            onChange={(v) => set({ zoom: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            id={`${base}-rot`}
            label={t('rotate')}
            value={adj.rot}
            min={limits.rot[0]}
            max={limits.rot[1]}
            step={1}
            onChange={(v) => set({ rot: v })}
            format={(v) => `${Math.round(v)}°`}
          />
          <Slider id={`${base}-panx`} label={t('panX')} value={adj.panX} min={0} max={1} step={0.01} onChange={(v) => set({ panX: v })} ltr />
          <Slider id={`${base}-pany`} label={t('panY')} value={adj.panY} min={0} max={1} step={0.01} onChange={(v) => set({ panY: v })} ltr />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onAdj({ ...(el.default_adj ?? DEFAULT_ADJ) })}
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {t('reset')}
            </button>
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
