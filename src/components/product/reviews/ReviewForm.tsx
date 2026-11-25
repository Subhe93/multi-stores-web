'use client';

// The review form (M171): rating, public display name, optional title and
// the text. Presentation only: values, errors and the submit live in
// ReviewWriteClient. Field errors are translated codes shown under their
// field (never raw validator text).

import type { FormEvent, ReactNode } from 'react';
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import {
  REVIEW_LIMITS,
  reviewTextLength,
  type ReviewFormErrorCode,
  type ReviewFormField,
  type ReviewFormValues,
} from '@/lib/reviews';

const STAR_PATH =
  'M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8L10 1.5z';
const INPUT =
  'w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition';

export type ReviewFieldErrors = Partial<Record<ReviewFormField, ReviewFormErrorCode | string>>;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-red-600">
      {message}
    </p>
  );
}

export function ReviewForm({
  values,
  errors,
  formError,
  busy,
  onChange,
  onSubmit,
  honeypot,
  onHoneypot,
  captcha,
  notice,
}: {
  values: ReviewFormValues;
  /** Error code per field (a key of the `errors` messages). */
  errors: ReviewFieldErrors;
  /** Already translated form-level error. */
  formError?: string;
  busy: boolean;
  onChange: (patch: Partial<ReviewFormValues>) => void;
  onSubmit: () => void;
  honeypot: string;
  onHoneypot: (value: string) => void;
  /** Captcha widget (review link only, when the storefront uses one). */
  captcha?: ReactNode;
  /** "Editing sends it back for approval". */
  notice?: string;
}) {
  const t = useTranslations('reviews');
  const tErrors = useTranslations('errors');
  const uid = useId();
  // Star preview while the pointer is over the group.
  const [hover, setHover] = useState(0);
  const message = (field: ReviewFormField) => {
    const code = errors[field];
    if (!code) return undefined;
    if (field === 'rating') return t('form.ratingRequired');
    return tErrors.has(code) ? tErrors(code) : tErrors('generic');
  };
  const bodyLength = reviewTextLength(values.body);
  const shown = hover || values.rating;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) onSubmit();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6" data-review-form="">
      {notice && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-review-notice="">
          {notice}
        </p>
      )}
      {formError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" data-review-error="">
          {formError}
        </p>
      )}

      {/* Rating: a native radio group (arrow keys, screen readers). */}
      <fieldset aria-describedby={errors.rating ? `${uid}-rating-error` : undefined}>
        <legend className="mb-2 block text-sm font-medium text-gray-700">{t('form.rating')}</legend>
        <div className="inline-flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-md focus-within:ring-2 focus-within:ring-gray-900/40" onMouseEnter={() => setHover(n)}>
              <input
                type="radio"
                name={`${uid}-rating`}
                value={n}
                checked={values.rating === n}
                onChange={() => onChange({ rating: n })}
                className="sr-only"
                aria-label={t('starsLabel', { rating: n })}
              />
              <svg
                width="36"
                height="36"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                focusable="false"
                style={{ color: n <= shown ? 'var(--theme-colors-rating, #f59e0b)' : 'var(--theme-colors-border, #d1d5db)' }}
              >
                <path d={STAR_PATH} />
              </svg>
            </label>
          ))}
        </div>
        <FieldError id={`${uid}-rating-error`} message={message('rating')} />
      </fieldset>

      <div>
        <label htmlFor={`${uid}-name`} className="mb-1.5 block text-sm font-medium text-gray-700">
          {t('form.displayName')}
        </label>
        <input
          id={`${uid}-name`}
          type="text"
          autoComplete="nickname"
          maxLength={REVIEW_LIMITS.nameMax}
          value={values.display_name}
          onChange={(e) => onChange({ display_name: e.target.value })}
          aria-invalid={errors.display_name ? true : undefined}
          aria-describedby={`${uid}-name-hint${errors.display_name ? ` ${uid}-name-error` : ''}`}
          className={INPUT}
        />
        <p id={`${uid}-name-hint`} className="mt-1.5 text-xs text-gray-500">
          {t('form.displayNameHint')}
        </p>
        <FieldError id={`${uid}-name-error`} message={message('display_name')} />
      </div>

      <div>
        <label htmlFor={`${uid}-title`} className="mb-1.5 block text-sm font-medium text-gray-700">
          {t('form.reviewTitle')}
        </label>
        <input
          id={`${uid}-title`}
          type="text"
          maxLength={REVIEW_LIMITS.titleMax}
          value={values.title}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? `${uid}-title-error` : undefined}
          className={INPUT}
        />
        <FieldError id={`${uid}-title-error`} message={message('title')} />
      </div>

      <div>
        <label htmlFor={`${uid}-body`} className="mb-1.5 block text-sm font-medium text-gray-700">
          {t('form.body')}
        </label>
        <textarea
          id={`${uid}-body`}
          rows={6}
          value={values.body}
          onChange={(e) => onChange({ body: e.target.value })}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={`${uid}-body-hint${errors.body ? ` ${uid}-body-error` : ''}`}
          className={`${INPUT} resize-y`}
        />
        <div id={`${uid}-body-hint`} className="mt-1.5 flex items-start justify-between gap-4 text-xs text-gray-500">
          <span>{t('form.bodyHint', { min: REVIEW_LIMITS.bodyMin })}</span>
          <span
            className={`shrink-0 tabular-nums ${bodyLength > REVIEW_LIMITS.bodyMax ? 'text-red-600' : ''}`}
            data-review-counter=""
          >
            {t('form.counter', { count: bodyLength, max: REVIEW_LIMITS.bodyMax })}
          </span>
        </div>
        <FieldError id={`${uid}-body-error`} message={message('body')} />
      </div>

      {/* Honeypot: hidden from people and assistive technology; a filled
          value makes the API drop the post silently. */}
      <div aria-hidden="true" className="sr-only">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => onHoneypot(e.target.value)}
          />
        </label>
      </div>

      {captcha}

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy || undefined}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
        style={{ backgroundColor: 'var(--store-primary, #111)', color: 'var(--store-primary-contrast, #fff)' }}
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {busy ? t('form.submitting') : t('form.submit')}
      </button>
    </form>
  );
}
