'use client';

import { useTranslations } from 'next-intl';
import { resolveMediaUrl } from '@/lib/api';
import { buildPersonalizationGroups, hasPersonalizationGroups } from '@multi-stores/core/personalization';
import {
  snapshotLabel,
  sortOrderFieldValues,
  type OrderFieldValueRow,
} from '@/lib/customFields';

interface OrderFieldValuesProps {
  rows: OrderFieldValueRow[] | null | undefined;
  locale: string;
  /** Store primary locale, when the page knows it (label fallback). */
  primaryLocale?: string;
  className?: string;
}

/** Personalization app columns of a snapshot row (C1); absent on M4.0 rows. */
type GroupedRow = OrderFieldValueRow & {
  group_key?: string | null;
  group_index?: number | null;
  group_label?: unknown;
  source?: string | null;
  meta?: { hex?: unknown } | null;
};

/** Previews are WebP; legacy rows may hold a PDF or another non-image file. */
const IMAGE_PATH = /\.(webp|png|jpe?g|gif|avif)$/i;

/** Group key: consecutive rows of one field (MULTI_IMAGE = one row per file) render on one line. */
function groupKey(row: OrderFieldValueRow): string {
  return row.custom_field_id || row.field_name || row.id || '';
}

/**
 * Personalization of an order line, read from the order snapshot (M4.0 §6):
 * frozen labels and option texts, files as thumbnails of their public
 * preview. Purged uploads (retention) show a note instead of the image.
 * Renders nothing for lines without values.
 */
export function OrderFieldValues({ rows, locale, primaryLocale, className }: OrderFieldValuesProps) {
  const t = useTranslations('account');
  const tp = useTranslations('personalization');
  if (!rows || rows.length === 0) return null;

  // Personalization app (M4.1): repeater items render as one line each
  // ("Artikel 2: ● KARIN · Röd"); option rows outside a group are skipped.
  // Rows without `group_index` (every M4.0 row) keep the rendering below.
  const all = rows as GroupedRow[];
  const grouped = hasPersonalizationGroups(all);
  const itemGroups = grouped
    ? buildPersonalizationGroups(
        all
          .filter((r) => typeof r.group_index === 'number')
          .map((r) => {
            const { label, value } = snapshotLabel(r, locale, primaryLocale);
            return {
              label,
              value: value || null,
              group_key: r.group_key ?? null,
              group_index: r.group_index ?? null,
              group_label: (r.group_label ?? null) as string | Record<string, unknown> | null,
              source: r.source ?? 'FIELD',
              meta: r.meta ?? null,
              sort_order: r.sort_order ?? null,
            };
          }),
        { locale, primary: primaryLocale, defaultGroupLabel: (i) => tp('itemN', { i }) },
      ).groups
    : [];
  const plainRows = grouped
    ? all.filter((r) => typeof r.group_index !== 'number' && r.source !== 'OPTION')
    : rows;

  const groups: { key: string; label: string; rows: OrderFieldValueRow[] }[] = [];
  for (const row of sortOrderFieldValues(plainRows)) {
    const key = groupKey(row);
    const last = groups[groups.length - 1];
    const isFile = Boolean(row.file_url || row.upload);
    if (last && key && last.key === key && isFile && last.rows.every((r) => r.file_url || r.upload)) {
      last.rows.push(row);
    } else {
      groups.push({ key, label: snapshotLabel(row, locale, primaryLocale).label, rows: [row] });
    }
  }

  return (
    <div className={className}>
      {groups.map((g, gi) => (
        <div key={`${g.key}-${gi}`} className="text-[11px] text-gray-500 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="font-medium text-gray-600">{g.label}:</span>
          {g.rows.map((row, ri) => {
            const k = row.id || `${gi}-${ri}`;
            if (row.file_url || row.upload) {
              if (row.upload?.purged_at) {
                return <span key={k} className="italic text-gray-400">{t('fileRemoved')}</span>;
              }
              const src = row.upload?.preview_url || row.file_url;
              return src && IMAGE_PATH.test(src) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={k}
                  src={resolveMediaUrl(src)}
                  alt={row.upload?.original_name || g.label}
                  title={row.upload?.original_name || undefined}
                  className="w-10 h-10 rounded-md object-cover border border-gray-200"
                />
              ) : (
                <span key={k}>{t('fileUploaded')}</span>
              );
            }
            return <span key={k}>{snapshotLabel(row, locale, primaryLocale).value || '—'}</span>;
          })}
        </div>
      ))}
      {itemGroups.map((g) => (
        <div key={`item-${g.key}-${g.index}`} className="text-[11px] text-gray-500 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="font-medium text-gray-600">{g.label}:</span>
          {g.entries.map((e, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <span aria-hidden="true">·</span>}
              {e.hex && (
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full border border-gray-300"
                  style={{ backgroundColor: e.hex }}
                />
              )}
              {e.value || '—'}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
