import {
  Award,
  CreditCard,
  Gift,
  HeadphonesIcon,
  Heart,
  Leaf,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Zap,
} from 'lucide-react';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';
import { SectionHeading } from './_shared/SectionHeading';

interface FeatureItem {
  icon?: string;
  title?: string;
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
  gift: Gift,
  heart: Heart,
  package: Package,
  sparkles: Sparkles,
  zap: Zap,
};

function clampColumns(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : fallback;
  return Math.max(1, Math.min(4, v));
}

function FeatureGrid({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const items = ((content.items as FeatureItem[]) || []).filter((f) => f.title || f.description || f.icon);
  const columns = clampColumns(settings.columns, 3);
  const align = (settings.alignment as 'left' | 'center') || 'center';
  const iconStyle = (settings.icon_style as 'chip' | 'plain') || 'chip';

  // Per-section color overrides — fall back to the active theme tokens so an
  // untouched section keeps matching the theme.
  const iconColor = colorOr(settings.icon_color, 'var(--theme-colors-primary)');
  const iconBgColor = colorOr(settings.icon_bg_color, 'var(--theme-colors-surface)');
  const titleColor = colorOr(settings.title_color, 'var(--theme-colors-text)');
  const descriptionColor = colorOr(settings.description_color, 'var(--theme-colors-muted)');

  if (items.length === 0) {
    return (
      <section className="py-12">
        <div
          className="text-center py-10 px-4"
          style={{
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
            color: 'var(--theme-colors-muted)',
          }}
        >
          <p className="text-sm">
            {locale === 'ar' ? 'لا توجد مميزات بعد. أضف عناصر من البيلدر.' : 'No features yet. Add some from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  const alignClass = align === 'center' ? 'items-center text-center' : 'items-start text-start';

  return (
    <section className="py-12">
      {(heading || subheading) && (
        <div className="mb-12">
          <SectionHeading
            heading={heading}
            subheading={subheading}
            align="center"
            headingColor={settings.heading_color}
            subheadingColor={settings.subheading_color}
          />
        </div>
      )}

      <StaggerGroup className="grid gap-6" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map((f, i) => {
          const Icon = f.icon ? ICONS[f.icon] || Sparkles : Sparkles;
          return (
            <StaggerItem key={i} className={`flex flex-col gap-3 ${alignClass}`}>
              {iconStyle === 'chip' ? (
                <div
                  className="size-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: iconBgColor, color: iconColor }}
                >
                  <Icon className="size-6" />
                </div>
              ) : (
                <Icon className="size-7 shrink-0" style={{ color: iconColor }} />
              )}
              {f.title && (
                <h3 className="text-base font-semibold leading-tight" style={{ color: titleColor }}>
                  {f.title}
                </h3>
              )}
              {f.description && (
                <p className="text-sm leading-relaxed" style={{ color: descriptionColor }}>
                  {f.description}
                </p>
              )}
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </section>
  );
}

const ICON_OPTIONS = [
  { value: 'truck', label: { en: 'Truck', ar: 'شاحنة' } },
  { value: 'refresh', label: { en: 'Refresh', ar: 'تحديث' } },
  { value: 'shield', label: { en: 'Shield', ar: 'درع' } },
  { value: 'card', label: { en: 'Card', ar: 'بطاقة' } },
  { value: 'award', label: { en: 'Award', ar: 'جائزة' } },
  { value: 'star', label: { en: 'Star', ar: 'نجمة' } },
  { value: 'headphones', label: { en: 'Headphones', ar: 'سماعات' } },
  { value: 'leaf', label: { en: 'Leaf', ar: 'ورقة' } },
  { value: 'gift', label: { en: 'Gift', ar: 'هدية' } },
  { value: 'heart', label: { en: 'Heart', ar: 'قلب' } },
  { value: 'package', label: { en: 'Package', ar: 'صندوق' } },
  { value: 'sparkles', label: { en: 'Sparkles', ar: 'بريق' } },
  { value: 'zap', label: { en: 'Lightning', ar: 'برق' } },
];

export const featureGridSection: SectionDefinition = {
  schema: {
    id: 'feature-grid',
    label: { en: 'Features', ar: 'المميزات' },
    icon: 'sparkles',
    category: 'content',
    description: {
      en: 'Grid of features, each with an icon, title and short description.',
      ar: 'شبكة من المميزات، كل منها بأيقونة وعنوان ووصف قصير.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'columns', type: 'number', label: { en: 'Columns', ar: 'الأعمدة' }, min: 1, max: 4, defaultValue: 3 },
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Alignment', ar: 'المحاذاة' },
        defaultValue: 'center',
        options: [
          { value: 'left', label: { en: 'Left', ar: 'يسار' } },
          { value: 'center', label: { en: 'Center', ar: 'وسط' } },
        ],
      },
      {
        key: 'icon_style',
        type: 'select',
        label: { en: 'Icon style', ar: 'نمط الأيقونة' },
        defaultValue: 'chip',
        options: [
          { value: 'chip', label: { en: 'Chip', ar: 'بطاقة ملوّنة' } },
          { value: 'plain', label: { en: 'Plain', ar: 'بدون بطاقة' } },
        ],
      },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Features', ar: 'المميزات' },
        fields: [
          { key: 'icon', type: 'select', label: { en: 'Icon', ar: 'الأيقونة' }, options: ICON_OPTIONS },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' } },
          { key: 'description', type: 'textarea', label: { en: 'Description', ar: 'الوصف' } },
        ],
      },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'icon_color', type: 'color', label: { en: 'Icon color', ar: 'لون الأيقونة' } },
      { key: 'icon_bg_color', type: 'color', label: { en: 'Icon background (chip style)', ar: 'خلفية الأيقونة (نمط البطاقة)' } },
      { key: 'title_color', type: 'color', label: { en: 'Feature title color', ar: 'لون عنوان الميزة' } },
      { key: 'description_color', type: 'color', label: { en: 'Feature description color', ar: 'لون وصف الميزة' } },
    ],
  },
  Component: FeatureGrid,
  defaultSettings: { columns: 3, alignment: 'center', icon_style: 'chip' },
  defaultContent: {
    items: [
      { icon: 'truck', title: 'Fast delivery', description: 'Get your order in record time with our express shipping.' },
      { icon: 'shield', title: 'Secure payments', description: 'Your data is protected with bank-level encryption.' },
      { icon: 'headphones', title: 'Friendly support', description: 'Our team is here for you seven days a week.' },
    ],
  },
};
