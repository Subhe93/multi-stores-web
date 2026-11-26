'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { fieldMessage, insertAtCaret, readValidationRules, truncateChars, type PFieldDef } from '@multi-stores/core/personalization';
import { filterAllowedChars } from '@/lib/personalization/form';
import { displayLength, liveTextTransform, textLimits, type FieldText } from '../model';
import { FieldShell } from './FieldShell';

interface TextFieldProps {
  def: PFieldDef;
  /** Element id (`field-<key>`). */
  inputId: string;
  text: FieldText;
  value: unknown;
  /** Sibling set of the field (equal_length target lookup). */
  siblings: readonly PFieldDef[];
  siblingValues: Record<string, unknown>;
  required: boolean;
  error?: string | null;
  locale: string;
  primaryLocale: string;
  /** Repeater item index, for `{i}` in creator messages. */
  groupIndex?: number;
  onChange: (value: string) => void;
}

/**
 * TEXT / TEXTAREA of the personalization app (namez A, B):
 * - live `allowed_chars` filter with the creator's message (A L602-617);
 * - cut to the max in code points (C14); with `limit_to_target` the max is
 *   the length of the linked field (A L596-601);
 * - counter "x / max" or "x / length of the linked field" (A L491-503);
 * - `insert_char` button inserting at the caret while below the max (A L671-690);
 * - uppercase transform shown with CSS (the server stores it uppercased);
 * - capitalize transform (M173) applied to the value itself on every edit
 *   (not while an IME composition is open), with the caret kept in place: the
 *   field shows exactly the text that is stored. A value that arrives
 *   without typing (URL prefill) is normalised the same way.
 */
export function TextField({
  def,
  inputId,
  text,
  value,
  siblings,
  siblingValues,
  required,
  error,
  locale,
  primaryLocale,
  groupIndex,
  onChange,
}: TextFieldProps) {
  const t = useTranslations('personalization');
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  // True while an IME composition feeds raw text into the value.
  const composingRef = useRef(false);
  const [filtered, setFiltered] = useState(false);
  // Bumped to re-run the caret effect when the transformed value equals the
  // previous one (React then resets the DOM value without a new `current`).
  const [caretTick, setCaretTick] = useState(0);
  const limits = useMemo(() => textLimits(def, siblings, siblingValues), [def, siblings, siblingValues]);
  const current = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  const count = displayLength(current);
  const multiline = def.type === 'TEXTAREA';
  // Personnummer fields (B1): no browser autofill / spellcheck on an identity
  // number. The error text itself comes from `errors.CUSTOM_FIELD_INVALID_PERSONNUMMER`
  // (or the creator's `messages.format` override) like every other rule.
  const identityInput =
    readValidationRules(def.validation_rules).format === 'personnummer'
      ? ({ autoComplete: 'off', spellCheck: false } as const)
      : null;

  // Brief notice after characters were dropped by the allowed set.
  useEffect(() => {
    if (!filtered) return;
    const timer = setTimeout(() => setFiltered(false), 2500);
    return () => clearTimeout(timer);
  }, [filtered]);

  // Keeps the caret after an inserted character once the new value rendered.
  useEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null || !inputRef.current) return;
    pendingCaret.current = null;
    inputRef.current.focus();
    inputRef.current.setSelectionRange(caret, caret);
  }, [current, caretTick]);

  // A value written by something other than typing (URL prefill, a restored
  // or default value) gets the live transform once it lands here, so a
  // capitalize field never shows a text different from the stored one (M173).
  // No-op for uppercase / no transform; skipped during an IME composition.
  const liveValue = liveTextTransform(current, limits.transform);
  useEffect(() => {
    if (composingRef.current || liveValue === current) return;
    onChange(liveValue);
    // `onChange` identity changes every render of the parent; the value pair
    // is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveValue, current]);

  const allowedMessage =
    fieldMessage(def, 'CUSTOM_FIELD_INVALID_CHARS', { locale, primaryLocale }, groupIndex) || t('allowedChars');

  const handleInput = (raw: string, composing: boolean) => {
    // IME composition: keep the raw text, filter once it ends.
    composingRef.current = composing;
    if (composing) return onChange(raw);
    const kept = filterAllowedChars(raw, limits.allowed);
    if (kept !== raw.normalize('NFC')) setFiltered(true);
    const cut = limits.max !== null ? truncateChars(kept, limits.max) : kept;
    const next = liveTextTransform(cut, limits.transform);
    // The transform only changes letter case (same length): put the caret
    // back where the visitor was typing instead of at the end.
    if (next !== raw && next.length === raw.length && limits.transform === 'capitalize') {
      const caret = inputRef.current?.selectionStart;
      if (typeof caret === 'number') {
        pendingCaret.current = caret;
        setCaretTick((n) => n + 1);
      }
    }
    onChange(next);
  };

  const insert = () => {
    if (!limits.insertChar) return;
    const el = inputRef.current;
    const caret = el?.selectionStart ?? current.length;
    const next = insertAtCaret(current, caret, limits.insertChar, limits.max);
    if (!next) return;
    pendingCaret.current = next.caret;
    onChange(liveTextTransform(next.value, limits.transform));
  };

  const counterMax = limits.counter === 'linked' ? (limits.targetLength ?? limits.max) : limits.max;
  const atLimit = counterMax !== null && count >= counterMax;
  const mismatch = limits.counter === 'linked' && limits.targetLength !== null && count > 0 && count !== limits.targetLength;
  const counter =
    limits.counter !== 'none' && counterMax !== null ? (
      <span
        aria-live="polite"
        className={`shrink-0 text-xs tabular-nums ${mismatch ? 'text-red-600' : atLimit ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}
      >
        {t('counter', { count, max: counterMax })}
      </span>
    ) : null;

  const className = `w-full rounded-xl border px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 ${
    limits.uppercase ? 'uppercase placeholder:normal-case' : ''
  } ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-gray-900/20 focus:border-gray-400'}`;

  return (
    <FieldShell inputId={inputId} text={text} required={required} error={error} aside={counter}>
      <div className="flex items-stretch gap-2">
        {multiline ? (
          <textarea
            ref={inputRef}
            id={inputId}
            value={current}
            placeholder={text.placeholder}
            rows={3}
            aria-invalid={error ? true : undefined}
            onChange={(e) => handleInput(e.target.value, (e.nativeEvent as InputEvent).isComposing === true)}
            onCompositionEnd={(e) => handleInput(e.currentTarget.value, false)}
            className={`${className} resize-y`}
          />
        ) : (
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={current}
            placeholder={text.placeholder}
            {...identityInput}
            aria-invalid={error ? true : undefined}
            onChange={(e) => handleInput(e.target.value, (e.nativeEvent as InputEvent).isComposing === true)}
            onCompositionEnd={(e) => handleInput(e.currentTarget.value, false)}
            className={className}
          />
        )}
        {limits.insertChar && (
          <button
            type="button"
            onClick={insert}
            disabled={limits.max !== null && count >= limits.max}
            aria-label={t('insertChar', { char: limits.insertChar })}
            title={t('insertChar', { char: limits.insertChar })}
            className="shrink-0 min-w-11 rounded-xl border border-gray-200 px-3 text-base text-red-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {limits.insertChar}
          </button>
        )}
      </div>
      {filtered && <p className="mt-1.5 text-xs text-amber-600">{allowedMessage}</p>}
    </FieldShell>
  );
}
