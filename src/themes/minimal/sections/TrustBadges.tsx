import {
  TRUST_BADGE_ICON_OPTIONS as ICON_OPTIONS,
  trustBadgeIcon,
  type TrustBadgeItem as BadgeItem,
} from '@/lib/trustBadgeIcons';
import type { CSSProperties } from 'react';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';

// Strip layout, from 1024px: where an incomplete last row starts so that it
// is centred, keyed by the number of missing items. The grid is counted in
// half-columns (an item spans two), so the offset is exact. Literal class
// names: Tailwind only generates classes it can read in the source.
const STRIP_LAST_ROW_START: Record<number, string> = {
  1: 'lg:col-start-2',
  2: 'lg:col-start-3',
  3: 'lg:col-start-4',
};

function TrustBadges({ settings, content, locale }: SectionRenderProps) {
  const items = (content.items as BadgeItem[]) || [];
  const layout = (settings.layout as 'cards' | 'inline' | 'strip') || 'cards';
  const padding = (settings.padding as 'compact' | 'comfortable') || 'comfortable';

  const visible = items.filter((b) => b.label || b.icon);
  const padClass = padding === 'compact' ? 'py-6' : 'py-12';

  // Stay visible while empty so creators can see the section's placement and
  // the storefront has a recognisable shell until badges are filled in.
  if (visible.length === 0) {
    return (
      <section className={padClass}>
        <div
          className="text-center py-8 px-4"
          style={{
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
            color: 'var(--theme-colors-muted)',
          }}
        >
          <p className="text-sm">
            {locale === 'ar'
              ? 'لا توجد شارات بعد. أضف عناصر من البيلدر.'
              : 'No badges yet. Add some from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  if (layout === 'strip') {
    // One quiet row of icon + label + description, separated by thin rules.
    // Two per row below 1024px, up to four across from there (four across on
    // a tablet leaves under 90px for the text of each cell). An incomplete
    // row is centred.
    const n = visible.length;
    const perRow = Math.min(n, 4);
    const iconColor = colorOr(settings.icon_color, 'var(--theme-colors-text)');
    // A row with fewer items than columns is centred. The grid is counted in
    // half-columns (every item spans two), so the first item of such a row
    // can start half a column in; grid columns follow the text direction, so
    // right-to-left mirrors by itself.
    // Below 1024px (two per row): an odd count leaves the last item alone.
    const loneLast = n % 2 === 1 ? n - 1 : -1;
    // From 1024px: the last row holds `rem` items.
    const rem = n % perRow;
    const lastRowFirst = rem > 0 ? n - rem : -1;
    return (
      <section className={padClass}>
        <ul
          role="list"
          className="grid grid-cols-4 gap-y-6 lg:grid-cols-[repeat(calc(var(--tb-n)*2),minmax(0,1fr))]"
          style={{ '--tb-n': perRow, '--tb-w': perRow >= 3 ? '13rem' : '20rem' } as CSSProperties}
        >
          {visible.map((b, i) => {
            const Icon = trustBadgeIcon(b.icon);
            // A rule between neighbours of the same row, never before the
            // first item of a row.
            const divider = `${i % 2 === 1 ? 'max-lg:border-s' : ''} ${i % perRow !== 0 ? 'lg:border-s' : ''}`.trim();
            const centre = `${i === loneLast ? 'max-lg:col-start-2 max-lg:justify-center' : ''} ${
              i === lastRowFirst ? STRIP_LAST_ROW_START[perRow - rem] : ''
            }`.trim();
            return (
              <li
                key={i}
                className={`col-span-2 flex items-center gap-3 px-3 md:px-6 lg:justify-center ${divider} ${centre}`.replace(/ +/g, ' ').trim()}
                style={{ borderColor: 'var(--theme-colors-border)' }}
              >
                <Icon
                  className="size-7 md:size-8 shrink-0"
                  strokeWidth={1.25}
                  aria-hidden
                  style={{ color: iconColor }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight" style={{ color: 'var(--theme-colors-text)' }}>
                    {b.label}
                  </div>
                  {b.description && (
                    // From 1024px the description no longer widens the text
                    // block: the block is as wide as the label (at least
                    // --tb-w, never wider than the cell), so the centred
                    // content is what is actually visible.
                    <div
                      className="text-xs md:text-sm leading-snug lg:w-[var(--tb-w)] lg:min-w-full lg:max-w-full"
                      style={{ color: 'var(--theme-colors-muted)' }}
                    >
                      {b.description}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  if (layout === 'inline') {
    return (
      <section className={padClass}>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {visible.map((b, i) => {
            const Icon = trustBadgeIcon(b.icon);
            return (
              <div key={i} className="flex items-center gap-2.5">
                <Icon
                  className="size-5 shrink-0"
                  style={{ color: 'var(--theme-colors-primary)' }}
                />
                <div>
                  <div className="text-xs font-semibold" style={{ color: 'var(--theme-colors-text)' }}>
                    {b.label}
                  </div>
                  {b.description && (
                    <div className="text-[10px]" style={{ color: 'var(--theme-colors-muted)' }}>
                      {b.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // Cards layout (default) — grid of icon + label + description
  return (
    <section className={padClass}>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
        }}
      >
        {visible.map((b, i) => {
          const Icon = trustBadgeIcon(b.icon);
          return (
            <div
              key={i}
              className="flex items-center gap-3 p-4 card-lift"
              style={{
                backgroundColor: 'var(--theme-colors-background)',
                border: '1px solid var(--theme-colors-border)',
                borderRadius: 'var(--theme-radius-md)',
              }}
            >
              <div
                className="size-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--theme-colors-surface)',
                  color: 'var(--theme-colors-primary)',
                }}
              >
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <div
                  className="text-sm font-semibold leading-tight"
                  style={{ color: 'var(--theme-colors-text)' }}
                >
                  {b.label}
                </div>
                {b.description && (
                  <div
                    className="text-xs mt-0.5 leading-snug"
                    style={{ color: 'var(--theme-colors-muted)' }}
                  >
                    {b.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const trustBadgesSection: SectionDefinition = {
  schema: {
    id: 'trust-badges',
    label: { en: 'Trust Badges', ar: 'شارات الثقة' },
    icon: 'shield-check',
    category: 'social',
    description: {
      en: 'Row of reassurance points you can stand behind (shipping terms, returns, secure payment…). Cards or inline.',
      ar: 'صف من نقاط الطمأنينة التي تنطبق فعلاً على متجرك (شروط الشحن، الإرجاع، الدفع الآمن…). بطاقات أو سطر واحد.',
    },
    translatable: ['items'],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'cards',
        options: [
          { value: 'cards', label: { en: 'Cards', ar: 'بطاقات' } },
          { value: 'inline', label: { en: 'Inline row', ar: 'سطر واحد' } },
          { value: 'strip', label: { en: 'Strip', ar: 'شريط' } },
        ],
      },
      {
        key: 'icon_color',
        type: 'color',
        label: { en: 'Icon colour', ar: 'لون الأيقونة' },
        showIf: { key: 'layout', in: ['strip'] },
      },
      {
        key: 'padding',
        type: 'select',
        label: { en: 'Padding', ar: 'الحشو' },
        defaultValue: 'comfortable',
        options: [
          { value: 'compact', label: { en: 'Compact', ar: 'مدمج' } },
          { value: 'comfortable', label: { en: 'Comfortable', ar: 'مريح' } },
        ],
      },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Badges', ar: 'الشارات' },
        fields: [
          {
            key: 'icon',
            type: 'select',
            label: { en: 'Icon', ar: 'الأيقونة' },
            options: ICON_OPTIONS,
          },
          { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
          { key: 'description', type: 'text', label: { en: 'Description', ar: 'الوصف' } },
        ],
      },
    ],
  },
  Component: TrustBadges,
  defaultSettings: { layout: 'cards', padding: 'comfortable' },
};
