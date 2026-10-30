'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useBuyerType } from '@/hooks/useBuyerType';
import type { BuyerType } from '@/lib/buyerType';
import { readableTextOn } from '@/lib/readableText';

// ── Person | Company toggle (b2b app, M2-DESIGN §4.2) ────────────────────────
// Two-segment control mounted inside `<IfApp app="b2b">` in the header, the
// cart page and the cart drawer. Switching writes the `ms-buyer-type` cookie
// and re-renders every price through the BuyerType context — no reload.
// Renders nothing when the app is off or company purchases are disallowed.

interface BuyerTypeToggleProps {
  /** `compact` for the header, `full` (full-width) for cart surfaces. */
  variant?: 'compact' | 'full';
  primaryColor?: string;
  className?: string;
}

export function BuyerTypeToggle({ variant = 'compact', primaryColor, className = '' }: BuyerTypeToggleProps) {
  const t = useTranslations('b2b');
  const { enabled, settings, buyerType, setBuyerType } = useBuyerType();
  // Without a hex primaryColor (cart page / drawer pass none) the active
  // segment's background is a CSS variable: read the computed colour and set
  // a readable label colour on the element directly.
  const groupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (primaryColor || !groupRef.current) return;
    for (const btn of groupRef.current.querySelectorAll<HTMLButtonElement>('button[role="radio"]')) {
      btn.style.color =
        btn.getAttribute('aria-checked') === 'true' ? readableTextOn(getComputedStyle(btn).backgroundColor) : '';
    }
  }, [primaryColor, buyerType, enabled]);
  if (!enabled || settings.allow_company === false) return null;

  const options: { value: BuyerType; label: string }[] = [
    { value: 'person', label: t('person') },
    { value: 'company', label: t('company') },
  ];
  const accent = primaryColor || 'var(--store-primary, #2563eb)';
  const full = variant === 'full';

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={t('toggleLabel')}
      className={`inline-flex items-center rounded-lg border store-bd p-0.5 ${full ? 'w-full' : ''} ${
        full ? 'text-sm' : 'text-xs'
      } ${className}`}
      style={{ backgroundColor: 'var(--theme-colors-surface, #fff)' }}
    >
      {options.map((opt) => {
        const active = opt.value === buyerType;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setBuyerType(opt.value)}
            className={`rounded-md font-medium transition-colors ${full ? 'flex-1 py-2' : 'px-2.5 py-1'} ${
              active ? (primaryColor ? '' : 'text-white') : 'text-gray-600 hover:text-gray-900'
            }`}
            // Readable label on light brand colours too (white on yellow failed contrast).
            style={active ? { backgroundColor: accent, ...(primaryColor ? { color: readableTextOn(primaryColor) } : {}) } : undefined}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
