// ProjectCards: a grid of cards with an image, a category, a location, a
// status badge, a title, a short text and a link. Usable for projects, case
// studies, events or a roadmap. Static: the owner enters every card.

import type { CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';
import { SectionHeading } from './_shared/SectionHeading';
import { Heading } from './_shared/Heading';
import { headingTag, textTag } from './_shared/headingLevel';
import { GRID_COLS_CLASS, clampCols, gridColsStyle, gridImageSizes } from './_shared/grid';
import { FOCUS_RING, sectionHref } from './_shared/links';
import { StatusBadge, hasStatusBadge } from './_shared/StatusBadge';

interface Card {
  image?: string;
  alt?: string;
  title?: string;
  category?: string;
  location?: string;
  status?: string;
  description?: string;
  url?: string;
}

/** Most cards rendered; the builder repeater has the same limit. */
export const PROJECT_CARDS_MAX = 24;

type Aspect = 'landscape' | 'square' | 'portrait' | 'wide';
type CardStyle = 'plain' | 'bordered' | 'surface';

const ASPECT_CLASS: Record<Aspect, string> = {
  landscape: 'aspect-[4/3]',
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  wide: 'aspect-[16/9]',
};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function ProjectCards({ settings, content, locale, primaryLocale, builderPreview }: SectionRenderProps) {
  // Non-async shared component: the hook works on the server and in the
  // client-rendered builder preview.
  const t = useTranslations('sections');
  const heading = str(content.heading);
  const subheading = str(content.subheading);
  const cards = (Array.isArray(content.items) ? (content.items as Card[]) : [])
    .filter((it) => !!it && typeof it === 'object' && (str(it.title) || str(it.image)))
    .slice(0, PROJECT_CARDS_MAX);

  if (cards.length === 0) {
    // Nothing on the live store; a placeholder in the builder only.
    if (!builderPreview) return null;
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
          <p className="text-sm">{t('empty.projectCards')}</p>
        </div>
      </section>
    );
  }

  const columns = clampCols(settings.columns, 3, 1, 4);
  const columnsTablet = clampCols(settings.columns_tablet, 2, 1, 3);
  const columnsMobile = clampCols(settings.columns_mobile, 1, 1, 2);
  const aspectClass = ASPECT_CLASS[settings.aspect as Aspect] || ASPECT_CLASS.landscape;
  const cardStyle: CardStyle =
    settings.card_style === 'plain' || settings.card_style === 'surface' ? settings.card_style : 'bordered';
  // Booleans: only the literal true is on (the inspector shows unset as off).
  const showStatus = settings.show_status === true;
  const radius = settings.rounded === true ? 'var(--theme-radius-md)' : '0';
  const align = settings.heading_align === 'center' ? 'center' : 'start';

  const titleColor = colorOr(settings.title_color, 'var(--theme-colors-text)');
  const bodyColor = colorOr(settings.body_color, 'var(--theme-colors-muted)');
  const linkColor = colorOr(settings.link_color, 'var(--theme-colors-text)');
  const sizes = gridImageSizes(columns, columnsTablet, columnsMobile);

  const frame: CSSProperties = {
    borderRadius: radius,
    border: cardStyle === 'bordered' ? '1px solid var(--theme-colors-border)' : undefined,
    backgroundColor: cardStyle === 'surface' ? 'var(--theme-colors-surface)' : undefined,
  };

  const linkLabel = str(content.link_label);
  const linkUrl = str(settings.link_url);

  return (
    <section className="py-12 md:py-16">
      {(heading || subheading) && (
        <div className="mb-8 md:mb-10">
          <SectionHeading
            tag={headingTag(settings.heading_level, 'h2')}
            subheadingTag={textTag(settings.subheading_tag, 'p')}
            heading={heading}
            subheading={subheading}
            align={align}
            ruled={settings.heading_rule === true}
            headingColor={settings.heading_color}
            subheadingColor={settings.subheading_color}
          />
        </div>
      )}

      <StaggerGroup
        className={`${GRID_COLS_CLASS} gap-5 md:gap-6`}
        style={gridColsStyle(columns, columnsTablet, columnsMobile)}
      >
        {cards.map((card, i) => {
          const title = str(card.title);
          const description = str(card.description);
          const url = str(card.url);
          const img = str(card.image) ? resolveMediaUrl(str(card.image)) : '';
          const meta = [str(card.category), str(card.location)].filter(Boolean).join(' · ');
          const badge = showStatus && hasStatusBadge(card.status);

          return (
            <StaggerItem key={i} className="h-full">
              <article className="group relative flex h-full flex-col overflow-hidden" style={frame}>
                {img && (
                  <div className={`relative ${aspectClass} overflow-hidden`}>
                    <StoreImage
                      src={img}
                      alt={str(card.alt)}
                      fill
                      sizes={sizes}
                      unoptimized={isSvgSrc(img)}
                      className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]"
                    />
                    {badge && (
                      <span className="absolute top-3 start-3">
                        <StatusBadge status={card.status} />
                      </span>
                    )}
                  </div>
                )}
                <div className={`flex flex-1 flex-col gap-2 py-4 md:py-5 ${cardStyle === 'plain' ? 'px-0' : 'px-4 md:px-5'}`}>
                  {/* Without an image the badge sits above the meta line. */}
                  {!img && badge && (
                    <span>
                      <StatusBadge status={card.status} />
                    </span>
                  )}
                  {meta && (
                    <p className="text-xs uppercase tracking-[0.14em]" style={{ color: bodyColor }}>
                      {meta}
                    </p>
                  )}
                  {title && (
                    <Heading
                      level="h3"
                      style={{
                        fontFamily: 'var(--theme-font-heading)',
                        fontSize: 'var(--theme-scale-h4)',
                        fontWeight: 'var(--theme-weight-heading)',
                        lineHeight: 'var(--theme-line-heading)',
                        color: titleColor,
                      }}
                    >
                      {url ? (
                        // The stretched pseudo-element makes the whole card
                        // one link whose accessible name is the title. The
                        // focus ring is drawn inside the card (it clips).
                        <a
                          href={sectionHref(url, locale, primaryLocale)}
                          className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2"
                        >
                          {title}
                        </a>
                      ) : (
                        title
                      )}
                    </Heading>
                  )}
                  {description && (
                    <p className="text-sm leading-relaxed" style={{ color: bodyColor }}>
                      {description}
                    </p>
                  )}
                  {url && (
                    <span
                      aria-hidden
                      className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold"
                      style={{ color: linkColor }}
                    >
                      {t('viewDetails')} <ArrowRight className="size-4 rtl:-scale-x-100" />
                    </span>
                  )}
                </div>
              </article>
            </StaggerItem>
          );
        })}
      </StaggerGroup>

      {linkLabel && linkUrl && (
        <div className={`mt-8 md:mt-10 ${align === 'center' ? 'text-center' : 'text-start'}`}>
          <a
            href={sectionHref(linkUrl, locale, primaryLocale)}
            className={`inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline ${FOCUS_RING}`}
            style={{ color: linkColor }}
          >
            {linkLabel}
            <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
          </a>
        </div>
      )}
    </section>
  );
}

const STATUS_OPTIONS = [
  { value: 'none', label: { en: 'None', ar: 'بدون' } },
  { value: 'planned', label: { en: 'Planned', ar: 'مخطَّط' } },
  { value: 'in_progress', label: { en: 'In progress', ar: 'قيد التنفيذ' } },
  { value: 'completed', label: { en: 'Completed', ar: 'مكتمل' } },
];

export const projectCardsSection: SectionDefinition = {
  schema: {
    id: 'project-cards',
    label: { en: 'Project cards', ar: 'بطاقات المشاريع' },
    icon: 'layout-grid',
    category: 'content',
    description: {
      en: 'Cards with an image, a status, a category, a location and a link.',
      ar: 'بطاقات مع صورة وحالة وفئة وموقع ورابط.',
    },
    translatable: ['heading', 'subheading', 'link_label', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 240 },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Cards', ar: 'البطاقات' },
        maxItems: PROJECT_CARDS_MAX,
        fields: [
          { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
          {
            key: 'alt',
            type: 'text',
            label: { en: 'Image description (alt text)', ar: 'وصف الصورة (النص البديل)' },
            maxLength: 160,
          },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' }, maxLength: 120 },
          { key: 'category', type: 'text', label: { en: 'Category', ar: 'الفئة' }, maxLength: 60 },
          { key: 'location', type: 'text', label: { en: 'Location', ar: 'الموقع' }, maxLength: 80 },
          { key: 'status', type: 'select', label: { en: 'Status', ar: 'الحالة' }, defaultValue: 'none', options: STATUS_OPTIONS },
          { key: 'description', type: 'textarea', label: { en: 'Short text', ar: 'نص قصير' }, maxLength: 240 },
          { key: 'url', type: 'url', label: { en: 'Link URL', ar: 'الرابط' } },
        ],
      },
      { key: 'columns', type: 'number', label: { en: 'Columns (desktop)', ar: 'الأعمدة (سطح المكتب)' }, min: 1, max: 4, defaultValue: 3 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns (tablet)', ar: 'الأعمدة (اللوحي)' }, min: 1, max: 3, defaultValue: 2 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns (mobile)', ar: 'الأعمدة (الجوال)' }, min: 1, max: 2, defaultValue: 1 },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Image aspect', ar: 'نسبة الصورة' },
        defaultValue: 'landscape',
        options: [
          { value: 'landscape', label: { en: 'Landscape 4:3', ar: 'عرضي 4:3' } },
          { value: 'square', label: { en: 'Square', ar: 'مربّع' } },
          { value: 'portrait', label: { en: 'Portrait 4:5', ar: 'طولي 4:5' } },
          { value: 'wide', label: { en: 'Wide 16:9', ar: 'عريض 16:9' } },
        ],
      },
      {
        key: 'card_style',
        type: 'select',
        label: { en: 'Card style', ar: 'نمط البطاقة' },
        defaultValue: 'bordered',
        options: [
          { value: 'plain', label: { en: 'Plain', ar: 'بسيط' } },
          { value: 'bordered', label: { en: 'Bordered', ar: 'بإطار' } },
          { value: 'surface', label: { en: 'Surface background', ar: 'بخلفية السطح' } },
        ],
      },
      { key: 'show_status', type: 'boolean', label: { en: 'Show status badges', ar: 'إظهار شارات الحالة' }, defaultValue: true },
      {
        key: 'heading_align',
        type: 'select',
        label: { en: 'Heading alignment', ar: 'محاذاة العنوان' },
        defaultValue: 'start',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Centre', ar: 'الوسط' } },
        ],
      },
      {
        key: 'heading_rule',
        type: 'boolean',
        label: { en: 'Lines beside a centred heading', ar: 'خطوط بجانب العنوان المتوسّط' },
        defaultValue: false,
      },
      { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'زوايا مستديرة' }, defaultValue: true },
      { key: 'link_label', type: 'text', label: { en: 'Link text under the grid', ar: 'نص الرابط تحت الشبكة' }, maxLength: 40 },
      { key: 'link_url', type: 'url', label: { en: 'Link URL under the grid', ar: 'رابط تحت الشبكة' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'title_color', type: 'color', label: { en: 'Card title color', ar: 'لون عنوان البطاقة' } },
      { key: 'body_color', type: 'color', label: { en: 'Card text color', ar: 'لون نص البطاقة' } },
      { key: 'link_color', type: 'color', label: { en: 'Link color', ar: 'لون الرابط' } },
    ],
  },
  Component: ProjectCards,
  needsBuilderPreview: true,
  defaultSettings: {
    columns: 3,
    columns_tablet: 2,
    columns_mobile: 1,
    aspect: 'landscape',
    card_style: 'bordered',
    show_status: true,
    heading_align: 'start',
    heading_rule: false,
    rounded: true,
  },
  defaultContent: {
    heading: 'Our projects',
    subheading: 'What is planned, what is under way and what is done.',
    items: [
      { title: 'First project', category: 'Category', location: 'Location', status: 'completed', description: 'Describe the project in one or two sentences.' },
      { title: 'Second project', category: 'Category', location: 'Location', status: 'in_progress', description: 'Describe the project in one or two sentences.' },
      { title: 'Third project', category: 'Category', location: 'Location', status: 'planned', description: 'Describe the project in one or two sentences.' },
    ],
  },
};
