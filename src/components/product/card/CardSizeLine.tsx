// Line of sizes of a product card. OWNER: builder W2.
//
// Not interactive: "XS S M L" in the seller's order, sold-out sizes struck
// through. The strike is visual only, so the same information is given as
// visually hidden text ("Sizes: XS, S, M (sold out), L").

import { useLocale, useTranslations } from 'next-intl';
import { joinNames } from './CardSwatchList';
import type { CardSizeLineProps } from './types';
import './card-options.css';

export function CardSizeLine({ sizes }: CardSizeLineProps) {
  const t = useTranslations('product');
  const locale = useLocale();
  const { items, more } = sizes;
  if (items.length === 0) return null;

  // M159: the size in the page language when labelled; keys stay the value.
  const shown = (s: { value: string; label?: string }) => s.label ?? s.value;
  const names = items.map((s) => (s.available ? shown(s) : t('sizeUnavailable', { size: shown(s) })));
  if (more > 0) names.push(t('moreSizes', { count: more }));

  return (
    <p className="pcopt-sizes">
      <span className="sr-only">{t('sizesAvailable', { list: joinNames(locale, names) })}</span>
      {items.map((s) => (
        <span key={s.value} aria-hidden="true" className="pcopt-size" data-out={s.available ? undefined : ''}>
          {shown(s)}
        </span>
      ))}
      {more > 0 ? (
        <span className="pcopt-more" aria-hidden="true">
          +{more}
        </span>
      ) : null}
    </p>
  );
}
