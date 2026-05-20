import { Award, CreditCard, HeadphonesIcon, Leaf, RefreshCw, ShieldCheck, Star, Truck } from 'lucide-react';
import type { SectionDefinition, SectionRenderProps } from '../../types';

interface BadgeItem {
  icon?: string;
  label?: string;
  description?: string;
}

// Map icon name → lucide component. Keeps the schema string-only so it
// serialises cleanly without component references.
const ICONS: Record<string, typeof Truck> = {
  truck: Truck,
  refresh: RefreshCw,
  shield: ShieldCheck,
  card: CreditCard,
  award: Award,
  star: Star,
  headphones: HeadphonesIcon,
  leaf: Leaf,
};

function TrustBadges({ settings, content, locale }: SectionRenderProps) {
  const items = (content.items as BadgeItem[]) || [];
  const layout = (settings.layout as 'cards' | 'inline') || 'cards';
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

  if (layout === 'inline') {
    return (
      <section className={padClass}>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {visible.map((b, i) => {
            const Icon = b.icon ? ICONS[b.icon] || ShieldCheck : ShieldCheck;
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
          const Icon = b.icon ? ICONS[b.icon] || ShieldCheck : ShieldCheck;
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

const ICON_OPTIONS = [
  { value: 'truck', label: { en: 'Truck (shipping)', ar: 'شاحنة (شحن)' } },
  { value: 'refresh', label: { en: 'Refresh (returns)', ar: 'تحديث (إرجاع)' } },
  { value: 'shield', label: { en: 'Shield (secure)', ar: 'درع (آمن)' } },
  { value: 'card', label: { en: 'Card (payment)', ar: 'بطاقة (دفع)' } },
  { value: 'award', label: { en: 'Award (quality)', ar: 'جائزة (جودة)' } },
  { value: 'star', label: { en: 'Star (rated)', ar: 'نجمة (مقيّم)' } },
  { value: 'headphones', label: { en: 'Headphones (support)', ar: 'سماعات (دعم)' } },
  { value: 'leaf', label: { en: 'Leaf (eco)', ar: 'ورقة (بيئي)' } },
];

export const trustBadgesSection: SectionDefinition = {
  schema: {
    id: 'trust-badges',
    label: { en: 'Trust Badges', ar: 'شارات الثقة' },
    icon: 'shield-check',
    category: 'social',
    description: {
      en: 'Row of reassurance points (free shipping, returns, secure payment...). Cards or inline.',
      ar: 'صف من نقاط الطمأنينة (شحن مجاني، إرجاع، دفع آمن...). بطاقات أو سطر واحد.',
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
        ],
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
