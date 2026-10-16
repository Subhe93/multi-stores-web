'use client';

import { useTranslations } from 'next-intl';
import { splitDisplay, type PersonalizationDisplayLine } from '@/components/product/personalization/model';
import { CartFieldValue, formatCartFieldValue } from './CartItem';

/** A cart display line (`CartCustomFieldDisplay`); group keys only in app mode. */
export type SummaryDisplayLine = PersonalizationDisplayLine;

interface PersonalizationSummaryProps {
  display: SummaryDisplayLine[];
  className?: string;
  /** Text colour class of the lines (matches the surrounding list). */
  textClassName?: string;
}

/**
 * Grouped personalization of a cart line (M4.1 §5): one line per repeater
 * item ("Artikel 2: ● KARIN · Röd", colour dot from the hex) plus the
 * ungrouped fields as "label: value". Option lines outside a group are left
 * out (the variant line already shows them). Used only when some line has
 * a `group_index`, i.e. only with the personalization app.
 */
export function PersonalizationSummary({ display, className, textClassName = 'text-gray-400' }: PersonalizationSummaryProps) {
  const t = useTranslations('personalization');
  const { flat, groups } = splitDisplay(
    display,
    (d) => formatCartFieldValue(d.value, d.display),
    (i) => t('itemN', { i }),
  );

  return (
    <div className={className ?? 'flex flex-col gap-0.5'}>
      {flat.map((f, i) => (
        <span key={`${f.id}-${i}`} className={`text-xs ${textClassName}`}>
          {f.label}: <CartFieldValue value={f.value} display={f.display} />
        </span>
      ))}
      {groups.map((g) => (
        <span key={`${g.key}-${g.index}`} className={`text-xs ${textClassName}`}>
          <span className="font-medium">{g.label}:</span>{' '}
          {g.entries.map((e, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              {e.hex && (
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full border border-gray-300 align-middle me-1"
                  style={{ backgroundColor: e.hex }}
                />
              )}
              {e.value}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}
