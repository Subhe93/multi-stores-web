'use client';

// ── Designer back side (M5.6, NPP "Baksida" parity) ───────────────────────
// Shown right under the add-on that enables it: two cards "Samma design"
// (the front printed again) / "Annan mall" (another template), the gallery
// of allowed templates, then that template's photo slot(s) and editable
// texts with the SAME controls as the front, bound to the draft's
// `back.state`. The back canvas (same drag / zoom gestures) sits under the
// front canvas on desktop and under the back fields on mobile; two small
// "Framsida / Baksida" thumbnails close the block like NPP.

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2 } from 'lucide-react';
import type { ImageSlotElement } from '@multi-stores/core/designer';
import { DesignerCanvas } from './DesignerCanvas';
import { PhotoSlotControl } from './PhotoSlotControl';
import { TextFieldControl } from './TextFieldControl';
import { useDesignerSession } from './DesignerSession';
import type { DesignerSession } from './DesignerInline';

/** Element id of a back field in the error maps (`back:<id>`). */
export const backFieldId = (id: string) => `back:${id}`;

/** The back canvas (interactive for an 'other' back; a plain mirror of the front for 'same'). */
export function DesignerBackCanvas({ className, thumb = false }: { className?: string; thumb?: boolean }) {
  const ctx = useDesignerSession();
  const t = useTranslations('designer');
  const emptySlotText = useCallback(() => t('tapToUpload'), [t]);
  const s = ctx?.session;
  if (!ctx || !s || !s.backEnabled || !s.back || !s.backSpec) return null;
  const other = s.back.mode === 'other';
  const spec = s.backSpec;
  const ratio = spec.width / spec.height;
  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-gray-100 ${className ?? ''}`} style={{ aspectRatio: String(ratio) }} data-designer-back-canvas={thumb ? 'thumb' : 'full'}>
      <DesignerCanvas
        spec={spec}
        state={s.backRenderState}
        images={s.backImages}
        fonts={s.backFonts}
        renderKey={s.backRenderKey}
        mode={thumb ? 'proof' : 'edit'}
        locale={ctx.locale}
        interactive={other && !thumb}
        activeSlotId={other ? s.activeBackSlotId : null}
        onActivate={s.setActiveBackSlotId}
        onAdjChange={s.adjustBack}
        onDragStart={s.markDragged}
        onEmptySlotTap={s.openBackPicker}
        onTextTap={s.focusBackText}
        onReport={thumb ? undefined : s.onBackReport}
        emptySlotText={emptySlotText}
        label={t('backCanvasLabel')}
        keyboardHelp={other && !thumb ? t('keyboardHelp') : undefined}
        maxPx={thumb ? 400 : undefined}
        className={`absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none ${s.backReady ? 'opacity-100' : 'opacity-0'}`}
      />
      {!s.backReady && (
        <div className="absolute inset-0 flex items-center justify-center animate-pulse bg-gray-100 motion-reduce:animate-none" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400 motion-reduce:animate-none" aria-label={t('loading')} />
        </div>
      )}
    </div>
  );
}

/** "Framsida / Baksida" side thumbnails (NPP's side-by-side preview). */
export function DesignerSideThumbs() {
  const ctx = useDesignerSession();
  const t = useTranslations('designer');
  const s = ctx?.session;
  if (!ctx || !s || !s.backEnabled || !s.back || !s.backSpec) return null;
  const ratio = s.spec.width / s.spec.height;
  return (
    <div className="grid grid-cols-2 gap-3" data-designer-side-thumbs>
      <figure className="space-y-1">
        <div className="relative w-full overflow-hidden rounded-lg bg-gray-100" style={{ aspectRatio: String(ratio) }}>
          <DesignerCanvas
            spec={s.spec}
            state={s.renderState}
            images={s.images}
            fonts={s.fonts}
            renderKey={s.renderKey}
            mode="proof"
            locale={ctx.locale}
            interactive={false}
            label={t('frontSide')}
            maxPx={400}
            className="absolute inset-0"
          />
        </div>
        <figcaption className="text-center text-xs font-medium text-gray-600">{t('frontSide')}</figcaption>
      </figure>
      <figure className="space-y-1">
        <DesignerBackCanvas thumb />
        <figcaption className="text-center text-xs font-medium text-gray-600">{t('backSide')}</figcaption>
      </figure>
    </div>
  );
}

interface BackBlockProps {
  session: DesignerSession;
  locale: string;
  maxUploadMb: number;
  minDpi: number;
}

/**
 * The "Baksida" block under the enabling add-on: mode cards, the template
 * gallery and the back fields (photo slots then texts) for 'other'.
 */
export function DesignerBackBlock({ session: s, locale, maxUploadMb, minDpi }: BackBlockProps) {
  const t = useTranslations('designer');
  const back = s.back;
  const mode = back?.mode ?? 'same';
  const other = mode === 'other';
  const pickedId = back?.mode === 'other' ? back.template_id : null;
  const slots: ImageSlotElement[] = other ? s.backSlots : [];
  const backState = back?.mode === 'other' ? back.state : null;
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-3" data-designer-back role="group" aria-labelledby="designer-back-title">
      <p id="designer-back-title" className="text-sm font-semibold text-gray-900">
        {t('backTitle')}
      </p>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('backTitle')}>
        {(['same', 'other'] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => s.setBackMode(m)}
              className={`flex min-h-11 flex-col items-start gap-0.5 rounded-xl border p-3 text-start transition-colors motion-reduce:transition-none ${active ? 'bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              style={active ? { borderColor: 'var(--store-primary, #2563eb)' } : undefined}
              data-back-mode={m}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                {active && <Check className="h-4 w-4" aria-hidden="true" style={{ color: 'var(--store-primary, #2563eb)' }} />}
                {m === 'same' ? t('backSame') : t('backOther')}
              </span>
              <span className="text-xs text-gray-500">{m === 'same' ? t('backSameHint') : t('backOtherHint')}</span>
            </button>
          );
        })}
      </div>

      {other && (
        <div className="space-y-2" ref={(el) => s.registerBackGallery(el)}>
          <p className="text-xs font-medium text-gray-700">{t('backPickTemplate')}</p>
          {s.backTemplates.length === 0 ? (
            <p className="text-xs text-gray-500">{t('backNoTemplates')}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-designer-back-gallery>
              {s.backTemplates.map((tpl) => {
                const selected = tpl.template_id === pickedId;
                return (
                  <li key={tpl.template_id}>
                    <button
                      type="button"
                      onClick={() => s.pickBackTemplate(tpl.template_id)}
                      aria-pressed={selected}
                      className={`flex w-full flex-col gap-1 rounded-lg border p-1.5 text-start transition-colors motion-reduce:transition-none ${selected ? 'bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}
                      style={selected ? { borderColor: 'var(--store-primary, #2563eb)' } : undefined}
                      data-back-template={tpl.template_id}
                    >
                      <span className="block aspect-[5/7] w-full overflow-hidden rounded-md bg-gray-100">
                        {tpl.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- public template thumbnail
                          <img src={tpl.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : null}
                      </span>
                      <span className="line-clamp-2 text-xs text-gray-800" dir="auto">
                        {tpl.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {s.backError === 'template' && (
            <p className="text-xs text-red-600" role="alert">
              {t('backTemplateRequired')}
            </p>
          )}
          {s.backLoading && (
            <p className="flex items-center gap-1 text-xs text-gray-500" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {t('backLoading')}
            </p>
          )}
          {s.backLoadError && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-red-600" role="alert">
              {s.backLoadError}
              <button type="button" onClick={s.retryBackTemplate} className="min-h-11 font-medium underline">
                {t('tryAgain')}
              </button>
            </p>
          )}
        </div>
      )}

      {other && pickedId && s.backSpec && backState && (
        <div className="space-y-4" data-designer-back-fields>
          {slots.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">{t('backPhotoTitle')}</h4>
              {slots.map((el) => (
                <PhotoSlotControl
                  key={el.id}
                  ref={(h) => s.registerBackSlot(el.id, h)}
                  el={el}
                  photo={backState.photos[el.id]}
                  locale={locale}
                  active={s.activeBackSlotId === el.id}
                  progress={s.backProgress[el.id] ?? null}
                  error={s.backSlotErrors[el.id] || (s.backErrorFor[el.id] && s.backErrorFor[el.id] !== 'photo_required' ? t('photoInvalid') : null)}
                  missing={s.backMissing.has(el.id)}
                  maxUploadMb={maxUploadMb}
                  minDpi={minDpi}
                  onPick={(f) => s.pickBack(el.id, f)}
                  onCancelUpload={() => s.cancelBackUpload(el.id)}
                  onRetry={s.hasBackRetry(el.id) ? () => s.retryBack(el.id) : undefined}
                  onAdj={(adj) => s.adjustBack(el.id, adj)}
                  onRemove={() => s.removeBack(el.id)}
                  onActivate={() => s.toggleActiveBackSlot(el.id)}
                />
              ))}
            </div>
          )}
          {/* Mobile: the back canvas right under its fields (desktop: under the front canvas). */}
          <DesignerBackCanvas className="md:hidden" />
          {s.backTexts.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">{t('backDetails')}</h4>
              {s.backTexts.map((el) => (
                <TextFieldControl
                  key={el.id}
                  ref={(node) => s.registerBackText(el.id, node)}
                  el={el}
                  value={backState.texts[el.id] ?? ''}
                  locale={locale}
                  fitted={s.backFitted[el.id]}
                  error={s.backMissing.has(el.id) ? 'required' : (s.backErrorFor[el.id] ?? null)}
                  onChange={(v) => s.setBackText(el.id, v)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <DesignerSideThumbs />
    </div>
  );
}
