'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { fieldMessage, insertAtCaret, truncateChars, type PFieldDef } from '@multi-stores/core/personalization';
import { filterAllowedChars } from '@/lib/personalization/form';
import { displayLength, textLimits, type FieldText } from '../model';
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
 * - uppercase transform shown with CSS (the server stores it uppercased).
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
  const [filtered, setFiltered] = useState(false);
  const limits = useMemo(() => textLimits(def, siblings, siblingValues), [def, siblings, siblingValues]);
  const current = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  const count = displayLength(current);
  const multiline = def.type === 'TEXTAREA';

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
  }, [current]);

  const allowedMessage =
    fieldMessage(def, 'CUSTOM_FIELD_INVALID_CHARS', { locale, primaryLocale }, groupIndex) || t('allowedChars');

  const handleInput = (raw: string, composing: boolean) => {
    // IME composition: keep the raw text, filter once it ends.
    if (composing) return onChange(raw);
    const kept = filterAllowedChars(raw, limits.allowed);
    if (kept !== raw.normalize('NFC')) setFiltered(true);
    onChange(limits.max !== null ? truncateChars(kept, limits.max) : kept);
  };

  const insert = () => {
    if (!limits.insertChar) return;
    const el = inputRef.current;
    const caret = el?.selectionStart ?? current.length;
    const next = insertAtCaret(current, caret, limits.insertChar, limits.max);
    if (!next) return;
    pendingCaret.current = next.caret;
    onChange(next.value);
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
