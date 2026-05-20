import { Quote, Star } from 'lucide-react';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { resolveMediaUrl } from '@/lib/api';
import { colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';
import { SectionHeading } from './_shared/SectionHeading';

interface TestimonialItem {
  quote?: string;
  author?: string;
  role?: string;
  avatar?: string;
  rating?: number;
}

function clampColumns(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : fallback;
  return Math.max(1, Math.min(4, v));
}

function Testimonials({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const items = ((content.items as TestimonialItem[]) || []).filter((t) => t.quote || t.author);
  const layout = (settings.layout as 'cards' | 'plain') || 'cards';
  const columns = clampColumns(settings.columns, 3);
  const showRating = settings.show_rating !== false;

  // Per-section color overrides — each falls back to the active theme token so
  // an untouched section still matches the theme.
  const starColor = colorOr(settings.star_color, 'var(--theme-colors-primary)');
  const starEmptyColor = colorOr(settings.star_empty_color, 'var(--theme-colors-border)');
  const quoteIconColor = colorOr(settings.quote_icon_color, 'var(--theme-colors-primary)');
  const quoteColor = colorOr(settings.quote_color, 'var(--theme-colors-text)');
  const authorColor = colorOr(settings.author_color, 'var(--theme-colors-text)');
  const roleColor = colorOr(settings.role_color, 'var(--theme-colors-muted)');
  const cardBgColor = colorOr(settings.card_bg_color, 'var(--theme-colors-surface)');
  const cardBorderColor = colorOr(settings.card_border_color, 'var(--theme-colors-border)');

  // Stay visible while empty so creators can see placement in the builder.
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
            {locale === 'ar' ? 'لا توجد آراء بعد. أضف عناصر من البيلدر.' : 'No testimonials yet. Add some from the builder.'}
          </p>
        </div>
      </section>
    );
  }

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

      <StaggerGroup
        className="grid gap-5"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${Math.floor(900 / columns)}px, 1fr))` }}
      >
        {items.map((t, i) => {
          const rating = Math.max(0, Math.min(5, Number(t.rating) || 0));
          return (
            <StaggerItem key={i} className="h-full">
            <figure
              className={`flex flex-col gap-4 p-6 h-full${layout === 'cards' ? ' card-lift' : ''}`}
              style={
                layout === 'cards'
                  ? {
                      backgroundColor: cardBgColor,
                      border: `1px solid ${cardBorderColor}`,
                      borderRadius: 'var(--theme-radius-md)',
                    }
                  : undefined
              }
            >
              <Quote className="size-6 shrink-0" style={{ color: quoteIconColor, opacity: 0.6 }} />
              {showRating && rating > 0 && (
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      className="size-4"
                      style={{
                        color: s < rating ? starColor : starEmptyColor,
                        fill: s < rating ? starColor : 'transparent',
                      }}
                    />
                  ))}
                </div>
              )}
              {t.quote && (
                <blockquote className="text-sm leading-relaxed flex-1" style={{ color: quoteColor }}>
                  {t.quote}
                </blockquote>
              )}
              <figcaption className="flex items-center gap-3 mt-auto">
                {t.avatar ? (
                  <img
                    src={resolveMediaUrl(t.avatar)}
                    alt={t.author || ''}
                    loading="lazy"
                    className="size-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="size-10 rounded-full shrink-0"
                    style={{ backgroundColor: cardBorderColor }}
                  />
                )}
                <div className="min-w-0">
                  {t.author && (
                    <div className="text-sm font-semibold leading-tight" style={{ color: authorColor }}>
                      {t.author}
                    </div>
                  )}
                  {t.role && (
                    <div className="text-xs mt-0.5" style={{ color: roleColor }}>
                      {t.role}
                    </div>
                  )}
                </div>
              </figcaption>
            </figure>
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </section>
  );
}

export const testimonialsSection: SectionDefinition = {
  schema: {
    id: 'testimonials',
    label: { en: 'Testimonials', ar: 'آراء العملاء' },
    icon: 'quote',
    category: 'social',
    description: {
      en: 'Customer quotes with name, role, avatar and star rating. Cards or plain layout.',
      ar: 'اقتباسات العملاء مع الاسم والصفة والصورة والتقييم بالنجوم. بطاقات أو تخطيط بسيط.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'cards',
        options: [
          { value: 'cards', label: { en: 'Cards', ar: 'بطاقات' } },
          { value: 'plain', label: { en: 'Plain', ar: 'بسيط' } },
        ],
      },
      { key: 'columns', type: 'number', label: { en: 'Columns', ar: 'الأعمدة' }, min: 1, max: 4, defaultValue: 3 },
      { key: 'show_rating', type: 'boolean', label: { en: 'Show star rating', ar: 'إظهار التقييم بالنجوم' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Testimonials', ar: 'الآراء' },
        fields: [
          { key: 'quote', type: 'textarea', label: { en: 'Quote', ar: 'الاقتباس' } },
          { key: 'author', type: 'text', label: { en: 'Author name', ar: 'اسم صاحب الرأي' } },
          { key: 'role', type: 'text', label: { en: 'Role / company', ar: 'الصفة / الشركة' } },
          { key: 'avatar', type: 'image', label: { en: 'Avatar', ar: 'الصورة' } },
          { key: 'rating', type: 'number', label: { en: 'Rating (0–5)', ar: 'التقييم (0–5)' }, min: 0, max: 5, defaultValue: 5 },
        ],
      },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'star_color', type: 'color', label: { en: 'Star color', ar: 'لون النجوم' } },
      { key: 'star_empty_color', type: 'color', label: { en: 'Empty star color', ar: 'لون النجوم الفارغة' } },
      { key: 'quote_icon_color', type: 'color', label: { en: 'Quote icon color', ar: 'لون أيقونة الاقتباس' } },
      { key: 'quote_color', type: 'color', label: { en: 'Quote text color', ar: 'لون نص الاقتباس' } },
      { key: 'author_color', type: 'color', label: { en: 'Author name color', ar: 'لون اسم الكاتب' } },
      { key: 'role_color', type: 'color', label: { en: 'Role / company color', ar: 'لون الصفة / الشركة' } },
      { key: 'card_bg_color', type: 'color', label: { en: 'Card background (cards layout)', ar: 'خلفية البطاقة (تخطيط البطاقات)' } },
      { key: 'card_border_color', type: 'color', label: { en: 'Card border (cards layout)', ar: 'حد البطاقة (تخطيط البطاقات)' } },
    ],
  },
  Component: Testimonials,
  defaultSettings: { layout: 'cards', columns: 3, show_rating: true },
  defaultContent: {
    heading: 'What our customers say',
    items: [
      { quote: 'Absolutely love the quality — exceeded my expectations.', author: 'Sarah M.', role: 'Verified buyer', rating: 5 },
      { quote: 'Fast shipping and great support. Will order again.', author: 'Ahmed K.', role: 'Verified buyer', rating: 5 },
      { quote: 'Beautiful products at a fair price. Highly recommend.', author: 'Lena P.', role: 'Verified buyer', rating: 4 },
    ],
  },
};
