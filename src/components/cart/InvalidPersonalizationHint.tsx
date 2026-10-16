'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';

interface InvalidPersonalizationHintProps {
  /** Cart lines; the ones flagged `personalizationInvalid` are named. */
  items: readonly InvalidCheckLine[];
  className?: string;
}

interface InvalidCheckLine {
  title?: string;
  personalizationInvalid?: boolean;
  /** Designer app (M4.2): the server flags a design that is invalid or locked. */
  design?: { invalid?: boolean; editable?: boolean };
}

/** True when the line's personalization or design blocks checkout. */
export function isInvalidLine(i: InvalidCheckLine): boolean {
  // An ordered design (`editable: false`) can never be bought again either.
  return i.personalizationInvalid === true || i.design?.invalid === true || i.design?.editable === false;
}

/**
 * True when a cart line's personalization no longer passes the rules (M4.1)
 * or its design is flagged invalid (M4.2).
 */
export function hasInvalidPersonalization(items: readonly InvalidCheckLine[]): boolean {
  return items.some(isInvalidLine);
}

/**
 * Notice shown at checkout while a cart line's personalization is invalid
 * (personalization app): names the products and links back to the cart,
 * where each flagged line explains what to do. Renders nothing otherwise.
 */
export function InvalidPersonalizationHint({ items, className = '' }: InvalidPersonalizationHintProps) {
  const t = useTranslations('checkout');
  const lp = useLocalePath();
  const flagged = items.filter(isInvalidLine);
  if (flagged.length === 0) return null;
  const titles = Array.from(new Set(flagged.map((i) => i.title).filter((s): s is string => Boolean(s))));
  return (
    <div role="alert" className={`rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 ${className}`}>
      <p className="flex items-start gap-1.5">
        <AlertCircle className="w-4 h-4 mt-px shrink-0" aria-hidden />
        <span>
          {titles.length > 0
            ? t('personalizationInvalid', { products: titles.join(', ') })
            : t('personalizationInvalidGeneric')}
        </span>
      </p>
      <Link href={lp('/cart')} className="mt-1 block font-medium underline underline-offset-2 hover:opacity-80">
        {t('returnToCart')}
      </Link>
    </div>
  );
}
