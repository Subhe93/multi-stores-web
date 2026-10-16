'use client';

import { forwardRef } from 'react';
import { useTranslations } from 'next-intl';
import { designTextLength, pickI18n, type TextElement } from '@/lib/designer/design-renderer';

interface Props {
  el: TextElement;
  value: string;
  locale?: string;
  /** Rule from validateState for this element ('required' only after a submit attempt). */
  error?: string | null;
  /** Fitted size (mm) from the last render, to explain shrinking. */
  fitted?: number;
  onChange: (value: string) => void;
}

/** Cuts a value to `max` code points (the server's counting unit). */
export function clampCodePoints(value: string, max: number): string {
  if (!(max > 0) || designTextLength(value) <= max) return value;
  const chars = Array.from(value);
  let out = '';
  for (const ch of chars) {
    if (designTextLength(out + ch) > max) break;
    out += ch;
  }
  return out;
}

export const TextFieldControl = forwardRef<HTMLInputElement, Props>(function TextFieldControl(
  { el, value, locale, error, fitted, onChange },
  ref,
) {
  const t = useTranslations('designer');
  const id = `designer-text-${el.id}`;
  const label = pickI18n(el.label, locale) || el.source_label || t('textLabel');
  const placeholder = pickI18n(el.placeholder, locale) || el.default_text || '';
  const max = el.max_length > 0 ? el.max_length : 0;
  const used = designTextLength(value);
  const minSize = el.fit?.min ?? 6;
  const shrunk = value !== '' && typeof fitted === 'number' && fitted < el.size;
  const atMin = shrunk && typeof fitted === 'number' && fitted <= minSize;

  const message =
    error === 'required'
      ? t('required')
      : error === 'max_length'
        ? t('tooLong', { max })
        : error === 'chars'
          ? t('invalidChars')
          : null;

  const hintId = `${id}-hint`;
  const countId = `${id}-count`;
  // The counter is outside the label (the accessible name stays the label)
  // and describes the input instead.
  const describedBy = [message || shrunk ? hintId : null, max > 0 ? countId : null].filter(Boolean).join(' ');
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-gray-900">
          {label}
          {el.required && <span className="ms-0.5 text-red-500" aria-hidden="true">*</span>}
        </label>
        {max > 0 && (
          <span id={countId} className="text-xs font-normal tabular-nums text-gray-400" aria-live="polite">
            {t('charsLeft', { count: Math.max(0, max - used) })}
          </span>
        )}
      </div>
      <input
        ref={ref}
        id={id}
        type="text"
        dir="auto"
        value={value}
        placeholder={placeholder}
        required={el.required}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(e) => onChange(clampCodePoints(e.target.value, max))}
        className={`w-full rounded-lg border px-3 py-2.5 text-base text-gray-900 outline-none transition focus:ring-2 ${
          message ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:border-gray-400 focus:ring-gray-200'
        }`}
        autoComplete="off"
        enterKeyHint="done"
      />
      {message ? (
        <p id={hintId} className="text-xs text-red-600">{message}</p>
      ) : shrunk ? (
        <p id={hintId} className={`text-xs ${atMin ? 'text-amber-700' : 'text-gray-500'}`}>
          {atMin ? t('textAtMin') : t('textShrunk')}
        </p>
      ) : null}
    </div>
  );
});
