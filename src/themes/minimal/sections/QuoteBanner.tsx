// QuoteBanner — classic full-width blockquote with a large decorative
// quotation mark in the theme primary at low opacity. Serif-leaning scale
// with generous vertical whitespace.

import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';
import { Reveal } from '../../_motion';

type Alignment = 'left' | 'center' | 'right';

// Logical alignment classes so 'left'/'right' mirror correctly under RTL.
const ALIGN_CLASS: Record<Alignment, string> = {
  left: 'text-start items-start',
  center: 'text-center items-center',
  right: 'text-end items-end',
};

function QuoteBanner({ settings, content, locale }: SectionRenderProps) {
  const quote = (content.quote as string) || '';
  const author = (content.author as string) || '';
  const role = (content.role as string) || '';
  const alignment = (settings.alignment as Alignment) || 'center';

  // Per-element color overrides — each falls back to the active theme token.
  const quoteColor = colorOr(settings.quote_color, 'var(--theme-colors-text)');
  const authorColor = colorOr(settings.author_color, 'var(--theme-colors-text)');
  const roleColor = colorOr(settings.role_color, 'var(--theme-colors-muted)');
  const markColor = colorOr(settings.mark_color, 'var(--theme-colors-primary)');

  // Stay visible while empty so creators can see placement in the builder.
  if (!quote) {
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
            {locale === 'ar' ? 'لا يوجد اقتباس بعد. أضف نصًا من البيلدر.' : 'No quote yet. Add one from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24">
      <Reveal direction="up">
        <figure className={`relative flex flex-col gap-8 max-w-4xl mx-auto px-4 ${ALIGN_CLASS[alignment]}`}>
          {/* Decorative quotation mark — aria-hidden, purely visual. */}
          <span
            aria-hidden="true"
            className="absolute -top-10 md:-top-14 select-none pointer-events-none leading-none"
            style={{
              insetInlineStart: alignment === 'center' ? '50%' : alignment === 'right' ? 'auto' : '0',
              insetInlineEnd: alignment === 'right' ? '0' : 'auto',
              transform: alignment === 'center' ? 'translateX(-50%)' : undefined,
              fontFamily: 'var(--theme-font-heading)',
              fontSize: 'clamp(6rem, 12vw, 9rem)',
              color: markColor,
              opacity: 0.12,
            }}
          >
            &ldquo;
          </span>

          <blockquote
            className="relative leading-snug"
            style={{
              fontFamily: 'var(--theme-font-heading)',
              fontSize: 'clamp(1.5rem, 3.2vw, 2.35rem)',
              fontWeight: 'var(--theme-weight-heading)',
              letterSpacing: 'var(--theme-tracking-heading)',
              color: quoteColor,
            }}
          >
            {quote}
          </blockquote>

          {(author || role) && (
            <figcaption className="flex flex-col gap-1">
              {author && (
                <span className="text-sm font-semibold tracking-wide" style={{ color: authorColor }}>
                  {author}
                </span>
              )}
              {role && (
                <span className="text-xs uppercase tracking-[0.14em]" style={{ color: roleColor }}>
                  {role}
                </span>
              )}
            </figcaption>
          )}
        </figure>
      </Reveal>
    </section>
  );
}

export const quoteBannerSection: SectionDefinition = {
  schema: {
    id: 'quote-banner',
    label: { en: 'Quote Banner', ar: 'بانر اقتباس' },
    icon: 'quote',
    category: 'content',
    description: {
      en: 'Full-width blockquote with a large decorative quotation mark and attribution.',
      ar: 'اقتباس بعرض كامل مع علامة اقتباس زخرفية كبيرة ونسبة القول لصاحبه.',
    },
    translatable: ['quote', 'author', 'role'],
    schema: [
      { key: 'quote', type: 'textarea', label: { en: 'Quote', ar: 'الاقتباس' }, maxLength: 400 },
      { key: 'author', type: 'text', label: { en: 'Author', ar: 'القائل' }, maxLength: 80 },
      { key: 'role', type: 'text', label: { en: 'Role / company', ar: 'الصفة / الشركة' }, maxLength: 80 },
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Alignment', ar: 'المحاذاة' },
        defaultValue: 'center',
        options: [
          { value: 'left', label: { en: 'Left', ar: 'يسار' } },
          { value: 'center', label: { en: 'Center', ar: 'وسط' } },
          { value: 'right', label: { en: 'Right', ar: 'يمين' } },
        ],
      },
      { key: 'quote_color', type: 'color', label: { en: 'Quote text color', ar: 'لون نص الاقتباس' } },
      { key: 'author_color', type: 'color', label: { en: 'Author color', ar: 'لون اسم القائل' } },
      { key: 'role_color', type: 'color', label: { en: 'Role color', ar: 'لون الصفة' } },
      { key: 'mark_color', type: 'color', label: { en: 'Quotation mark color', ar: 'لون علامة الاقتباس' } },
    ],
  },
  Component: QuoteBanner,
  defaultSettings: { alignment: 'center' },
  defaultContent: {
    quote: 'We believe the objects you live with should be made to last — and made with care.',
    author: 'Alex Morgan',
    role: 'Founder',
  },
};
