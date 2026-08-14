// PricingTable — up to four plans side by side that wrap gracefully on smaller
// viewports. The highlighted plan is elevated with a theme-primary border and
// a badge chip. `features` is a multiline string split into a checklist.

import { Check } from 'lucide-react';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { buttonStyles, colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';
import { SectionHeading } from './_shared/SectionHeading';

interface PricingPlan {
  name?: string;
  price?: string;
  period?: string;
  features?: string;
  cta_text?: string;
  cta_url?: string;
  badge?: string;
  highlighted?: boolean;
}

function splitFeatures(features: unknown): string[] {
  if (typeof features !== 'string') return [];
  return features
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter(Boolean);
}

function PricingTable({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const plans = ((content.plans as PricingPlan[]) || []).filter((p) => p.name || p.price);

  // Per-element color overrides — each falls back to the active theme token.
  const nameColor = colorOr(settings.name_color, 'var(--theme-colors-text)');
  const priceColor = colorOr(settings.price_color, 'var(--theme-colors-text)');
  const periodColor = colorOr(settings.period_color, 'var(--theme-colors-muted)');
  const featureColor = colorOr(settings.feature_color, 'var(--theme-colors-muted)');
  const checkColor = colorOr(settings.check_color, 'var(--theme-colors-primary)');
  const cardBgColor = colorOr(settings.card_bg_color, 'var(--theme-colors-surface)');
  const cardBorderColor = colorOr(settings.card_border_color, 'var(--theme-colors-border)');
  const highlightColor = colorOr(settings.highlight_color, 'var(--theme-colors-primary)');
  const badgeTextColor = colorOr(settings.badge_text_color, 'var(--theme-colors-primaryContrast, #fff)');

  const primaryBtn = buttonStyles(
    {
      bg: settings.cta_bg_color,
      text: settings.cta_text_color,
      borderColor: settings.cta_border_color,
      borderWidth: settings.cta_border_width,
      borderRadius: settings.cta_border_radius,
    },
    {
      bg: 'var(--theme-colors-primary)',
      text: 'var(--theme-colors-primaryContrast, #fff)',
      radius: 'var(--theme-radius-full)',
    },
  );

  // Non-highlighted plans get a quiet outline CTA so the highlighted plan's
  // filled button carries the visual weight.
  const outlineBtn = buttonStyles(
    {
      bg: settings.cta_secondary_bg_color,
      text: settings.cta_secondary_text_color,
      borderColor: settings.cta_secondary_border_color,
      borderWidth: settings.cta_secondary_border_width,
      borderRadius: settings.cta_secondary_border_radius,
    },
    {
      bg: 'transparent',
      text: 'var(--theme-colors-text)',
      border: 'var(--theme-colors-border)',
      borderWidth: '1.5px',
      radius: 'var(--theme-radius-full)',
    },
  );

  // Stay visible while empty so creators can see placement in the builder.
  if (plans.length === 0) {
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
            {locale === 'ar' ? 'لا توجد باقات بعد. أضف باقات من البيلدر.' : 'No plans yet. Add some from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-14 md:py-20">
      {(heading || subheading) && (
        <div className="mb-14">
          <SectionHeading
            heading={heading}
            subheading={subheading}
            align="center"
            headingColor={settings.heading_color}
            subheadingColor={settings.subheading_color}
          />
        </div>
      )}

      <StaggerGroup
        className="grid gap-6 items-stretch max-w-6xl mx-auto"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}
      >
        {plans.map((plan, i) => {
          const features = splitFeatures(plan.features);
          const highlighted = plan.highlighted === true;
          return (
            <StaggerItem key={i} className="h-full">
              <div
                className={`relative flex flex-col gap-6 p-8 h-full transition-transform duration-300 ${
                  highlighted ? 'lg:-translate-y-2' : ''
                }`}
                style={{
                  backgroundColor: cardBgColor,
                  border: highlighted ? `2px solid ${highlightColor}` : `1px solid ${cardBorderColor}`,
                  borderRadius: 'var(--theme-radius-lg)',
                  boxShadow: highlighted ? 'var(--theme-shadow-lg)' : 'var(--theme-shadow-sm)',
                }}
              >
                {highlighted && plan.badge && (
                  <span
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-1 text-xs font-semibold uppercase tracking-[0.08em] rounded-full"
                    style={{ backgroundColor: highlightColor, color: badgeTextColor }}
                  >
                    {plan.badge}
                  </span>
                )}

                <div className="flex flex-col gap-1">
                  {plan.name && (
                    <div
                      className="text-sm font-semibold uppercase tracking-[0.12em]"
                      style={{ color: highlighted ? highlightColor : nameColor }}
                    >
                      {plan.name}
                    </div>
                  )}
                  {!highlighted && plan.badge && (
                    <span
                      className="self-start px-2.5 py-0.5 text-[11px] font-semibold rounded-full mt-1"
                      style={{
                        color: highlightColor,
                        border: `1px solid ${highlightColor}`,
                      }}
                    >
                      {plan.badge}
                    </span>
                  )}
                </div>

                {(plan.price || plan.period) && (
                  <div className="flex items-baseline gap-1.5">
                    {plan.price && (
                      <span
                        className="leading-none"
                        style={{
                          fontFamily: 'var(--theme-font-heading)',
                          fontSize: 'var(--theme-scale-h2)',
                          fontWeight: 'var(--theme-weight-heading)',
                          color: priceColor,
                        }}
                      >
                        {plan.price}
                      </span>
                    )}
                    {plan.period && (
                      <span className="text-sm" style={{ color: periodColor }}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                )}

                {features.length > 0 && (
                  <ul className="flex flex-col gap-3 flex-1">
                    {features.map((f, fi) => (
                      <li key={fi} className="flex items-start gap-2.5 text-sm leading-relaxed">
                        <Check className="size-4 shrink-0 mt-0.5" style={{ color: checkColor }} />
                        <span style={{ color: featureColor }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {plan.cta_text && (
                  <a
                    href={plan.cta_url || '#'}
                    className="inline-flex items-center justify-center px-6 py-3 mt-auto transition-all duration-300 hover:opacity-90 hover:-translate-y-px"
                    style={{
                      ...(highlighted ? primaryBtn : outlineBtn),
                      fontWeight: 'var(--theme-weight-bold)',
                      boxShadow: highlighted ? 'var(--theme-shadow-md)' : undefined,
                    }}
                  >
                    {plan.cta_text}
                  </a>
                )}
              </div>
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </section>
  );
}

export const pricingTableSection: SectionDefinition = {
  schema: {
    id: 'pricing-table',
    label: { en: 'Pricing Table', ar: 'جدول الأسعار' },
    icon: 'tag',
    category: 'commerce',
    description: {
      en: 'Side-by-side plans with feature checklists, badges and a highlighted plan.',
      ar: 'باقات متجاورة مع قوائم مزايا وشارات وباقة مميزة.',
    },
    translatable: ['heading', 'subheading', 'plans'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'plans',
        type: 'repeater',
        label: { en: 'Plans', ar: 'الباقات' },
        fields: [
          { key: 'name', type: 'text', label: { en: 'Plan name', ar: 'اسم الباقة' } },
          { key: 'price', type: 'text', label: { en: 'Price', ar: 'السعر' } },
          { key: 'period', type: 'text', label: { en: 'Period (e.g. /month)', ar: 'الفترة (مثل /شهريًا)' } },
          {
            key: 'features',
            type: 'textarea',
            label: { en: 'Features (one per line)', ar: 'المزايا (ميزة في كل سطر)' },
          },
          { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' } },
          { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
          { key: 'badge', type: 'text', label: { en: 'Badge (e.g. Most popular)', ar: 'الشارة (مثل الأكثر شيوعًا)' } },
          { key: 'highlighted', type: 'boolean', label: { en: 'Highlight this plan', ar: 'تمييز هذه الباقة' }, defaultValue: false },
        ],
      },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'name_color', type: 'color', label: { en: 'Plan name color', ar: 'لون اسم الباقة' } },
      { key: 'price_color', type: 'color', label: { en: 'Price color', ar: 'لون السعر' } },
      { key: 'period_color', type: 'color', label: { en: 'Period color', ar: 'لون الفترة' } },
      { key: 'feature_color', type: 'color', label: { en: 'Feature text color', ar: 'لون نص المزايا' } },
      { key: 'check_color', type: 'color', label: { en: 'Check icon color', ar: 'لون أيقونة الصح' } },
      { key: 'card_bg_color', type: 'color', label: { en: 'Card background', ar: 'خلفية البطاقة' } },
      { key: 'card_border_color', type: 'color', label: { en: 'Card border', ar: 'حد البطاقة' } },
      { key: 'highlight_color', type: 'color', label: { en: 'Highlight color', ar: 'لون التمييز' } },
      { key: 'badge_text_color', type: 'color', label: { en: 'Badge text color', ar: 'لون نص الشارة' } },
      { key: 'cta_bg_color', type: 'color', label: { en: 'Button background (highlighted)', ar: 'خلفية الزر (المميز)' } },
      { key: 'cta_text_color', type: 'color', label: { en: 'Button text color (highlighted)', ar: 'لون نص الزر (المميز)' } },
      { key: 'cta_border_color', type: 'color', label: { en: 'Button border color (highlighted)', ar: 'لون حدود الزر (المميز)' } },
      { key: 'cta_border_width', type: 'number', label: { en: 'Button border width (px) (highlighted)', ar: 'سماكة حدود الزر (px) (المميز)' }, min: 0, max: 8, defaultValue: 0 },
      { key: 'cta_border_radius', type: 'number', label: { en: 'Button corner radius (px) (highlighted)', ar: 'انحناء زوايا الزر (px) (المميز)' }, min: 0, max: 100 },
      { key: 'cta_secondary_bg_color', type: 'color', label: { en: 'Button background (regular)', ar: 'خلفية الزر (عادي)' } },
      { key: 'cta_secondary_text_color', type: 'color', label: { en: 'Button text color (regular)', ar: 'لون نص الزر (عادي)' } },
      { key: 'cta_secondary_border_color', type: 'color', label: { en: 'Button border color (regular)', ar: 'لون حدود الزر (عادي)' } },
      { key: 'cta_secondary_border_width', type: 'number', label: { en: 'Button border width (px) (regular)', ar: 'سماكة حدود الزر (px) (عادي)' }, min: 0, max: 8, defaultValue: 0 },
      { key: 'cta_secondary_border_radius', type: 'number', label: { en: 'Button corner radius (px) (regular)', ar: 'انحناء زوايا الزر (px) (عادي)' }, min: 0, max: 100 },
    ],
  },
  Component: PricingTable,
  defaultSettings: {},
  defaultContent: {
    heading: 'Simple pricing',
    subheading: 'Pick the plan that fits. Change anytime.',
    plans: [
      {
        name: 'Starter',
        price: '$9',
        period: '/month',
        features: 'Up to 3 products\nBasic analytics\nEmail support',
        cta_text: 'Get started',
      },
      {
        name: 'Growth',
        price: '$29',
        period: '/month',
        features: 'Unlimited products\nAdvanced analytics\nPriority support\nCustom domain',
        cta_text: 'Start free trial',
        badge: 'Most popular',
        highlighted: true,
      },
      {
        name: 'Scale',
        price: '$79',
        period: '/month',
        features: 'Everything in Growth\nDedicated manager\nAPI access',
        cta_text: 'Contact sales',
      },
    ],
  },
};
