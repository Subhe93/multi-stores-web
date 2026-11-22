// Colour swatches of a product card. OWNER: builder W2.
//
// Not interactive: a row of small dots under the price, with the colour
// names in visually hidden text (an aria-label on a plain list is announced
// unreliably). When a value has neither a colour nor an image the model
// carries no items and the card prints "N colours" instead.

import { useLocale, useTranslations } from 'next-intl';
import { StoreImage } from '@/components/StoreImage';
import { resolveMediaUrl } from '@/lib/api';
import { isSvgSrc } from '@/lib/storeMedia';
import { dualColorBackground } from '@/lib/swatches';
import type { CardSwatch } from '@/lib/productCard/model';
import type { CardSwatchListProps } from './types';
import './card-options.css';

/** "Sand, Black, Olive" with the locale's own separator. */
export function joinNames(locale: string, names: string[]): string {
  // A plain separator: Intl.ListFormat adds a conjunction in some locales
  // ("A، وB"), which reads badly between option values in another script.
  return names.join(locale.startsWith('ar') ? '، ' : ', ');
}

function Dot({ swatch }: { swatch: CardSwatch }) {
  if (swatch.image) {
    const src = resolveMediaUrl(swatch.image);
    return (
      <span className="pcopt-dot" aria-hidden="true" data-image="" data-swatch={swatch.value}>
        <StoreImage src={src} alt="" width={28} height={28} sizes="14px" loading="lazy" unoptimized={isSvgSrc(src)} />
      </span>
    );
  }
  const style =
    swatch.css && swatch.css2
      ? { background: dualColorBackground([swatch.css, swatch.css2]) }
      : { backgroundColor: swatch.css };
  return <span className="pcopt-dot" aria-hidden="true" data-swatch={swatch.value} style={style} />;
}

export function CardSwatchList({ swatches }: CardSwatchListProps) {
  const t = useTranslations('product');
  const locale = useLocale();
  const { items, more, total } = swatches;

  if (items.length === 0) {
    if (total <= 0) return null;
    return <p className="pcopt-count">{t('nColours', { count: total })}</p>;
  }

  // M159: screen-reader names in the page language when labelled.
  const names = items.map((s) => s.label ?? s.value);
  if (more > 0) names.push(t('moreColours', { count: more }));

  return (
    <div className="pcopt-swatches">
      <span className="sr-only">{t('colours', { list: joinNames(locale, names) })}</span>
      {items.map((s) => (
        <Dot key={s.value} swatch={s} />
      ))}
      {more > 0 ? (
        <span className="pcopt-more" aria-hidden="true">
          +{more}
        </span>
      ) : null}
    </div>
  );
}
