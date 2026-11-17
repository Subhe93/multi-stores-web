// CategoryTiles: equal cards with an image, a short title, a subtitle and a
// small arrow, each linking somewhere (usually a collection). Static: the
// owner enters every tile; nothing is fetched.

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

interface Tile {
  image?: string;
  title?: string;
  subtitle?: string;
  url?: string;
  alt?: string;
}

/** Most tiles rendered; the builder repeater has the same limit. */
export const CATEGORY_TILES_MAX = 12;

type Aspect = 'square' | 'portrait' | 'landscape';

const ASPECT_CLASS: Record<Aspect, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-[4/3]',
};

const IMAGE_CLASS =
  'object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]';

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function CategoryTiles({ settings, content, locale, primaryLocale, builderPreview }: SectionRenderProps) {
  // Non-async shared component: the hook works on the server and in the
  // client-rendered builder preview.
  const t = useTranslations('sections');
  const heading = str(content.heading);
  const subheading = str(content.subheading);
  const tiles = (Array.isArray(content.items) ? (content.items as Tile[]) : [])
    .filter((it) => !!it && typeof it === 'object' && (str(it.title) || str(it.image)))
    .slice(0, CATEGORY_TILES_MAX);

  if (tiles.length === 0) {
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
          <p className="text-sm">{t('empty.categoryTiles')}</p>
        </div>
      </section>
    );
  }

  const overlay = settings.card_style === 'overlay';
  const aspectClass = ASPECT_CLASS[settings.aspect as Aspect] || ASPECT_CLASS.square;
  const columns = clampCols(settings.columns, 4, 2, 6);
  const columnsTablet = clampCols(settings.columns_tablet, 3, 2, 4);
  const columnsMobile = clampCols(settings.columns_mobile, 2, 1, 2);
  // Booleans: only the literal true is on (the inspector shows unset as off).
  const mobileScroll = settings.mobile_scroll === true;
  const showArrow = settings.show_arrow === true;
  const cardSurface = settings.card_surface === true;
  const radius = settings.rounded === true ? 'var(--theme-radius-md)' : '0';
  const align = settings.heading_align === 'start' ? 'start' : 'center';

  const arrowBg = colorOr(settings.arrow_bg_color, 'var(--theme-colors-primary)');
  const arrowColor = colorOr(settings.arrow_color, 'var(--theme-colors-primaryContrast, #fff)');
  const sizes = gridImageSizes(columns, columnsTablet, columnsMobile, mobileScroll ? '62vw' : undefined);

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
        className={`${GRID_COLS_CLASS} gap-3 md:gap-4${
          mobileScroll
            ? ' max-md:flex max-md:overflow-x-auto max-md:snap-x max-md:snap-mandatory max-md:-mx-4 max-md:px-4 max-md:py-1'
            : ''
        }`}
        style={gridColsStyle(columns, columnsTablet, columnsMobile)}
      >
        {tiles.map((tile, i) => {
          const title = str(tile.title);
          const subtitle = str(tile.subtitle);
          const url = str(tile.url);
          const img = str(tile.image) ? resolveMediaUrl(str(tile.image)) : '';
          const Wrapper = url ? 'a' : 'div';
          const linkProps = url ? { href: sectionHref(url, locale, primaryLocale) } : {};
          const image = img ? (
            <StoreImage
              src={img}
              alt={str(tile.alt)}
              fill
              sizes={sizes}
              unoptimized={isSvgSrc(img)}
              className={IMAGE_CLASS}
            />
          ) : null;
          const arrow =
            showArrow && url ? (
              <span
                aria-hidden
                className="inline-flex size-7 md:size-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: arrowBg, color: arrowColor }}
              >
                <ArrowRight className="size-4 rtl:-scale-x-100" />
              </span>
            ) : null;
          // On a photograph the text is white over a dark scrim; without an
          // image the overlay card falls back to the theme text colours.
          const onImage = overlay && !!img;
          const titleColor = colorOr(settings.title_color, onImage ? '#fff' : 'var(--theme-colors-text)');
          const subtitleColor = colorOr(
            settings.subtitle_color,
            onImage ? 'rgba(255,255,255,0.85)' : 'var(--theme-colors-muted)',
          );
          const text = (
            <div className="min-w-0">
              {title && (
                <Heading
                  level="h3"
                  look="body"
                  className="text-sm md:text-base font-semibold leading-tight"
                  style={{ color: titleColor }}
                >
                  {title}
                </Heading>
              )}
              {subtitle && (
                <p className="mt-0.5 text-xs md:text-sm" style={{ color: subtitleColor }}>
                  {subtitle}
                </p>
              )}
            </div>
          );

          return (
            <StaggerItem
              key={i}
              className={`h-full${mobileScroll ? ' max-md:shrink-0 max-md:basis-[62%] max-md:snap-start' : ''}`}
            >
              {overlay ? (
                <Wrapper
                  {...linkProps}
                  className={`group relative block overflow-hidden ${aspectClass} ${FOCUS_RING}`}
                  style={{ borderRadius: radius, backgroundColor: 'var(--theme-colors-surface)' }}
                >
                  {image}
                  {img && (
                    <span
                      aria-hidden
                      className="absolute inset-0"
                      style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)' }}
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 md:p-4">
                    {text}
                    {arrow}
                  </div>
                </Wrapper>
              ) : (
                <Wrapper
                  {...linkProps}
                  className={`group block h-full overflow-hidden ${FOCUS_RING}`}
                  style={{
                    borderRadius: radius,
                    backgroundColor: cardSurface ? 'var(--theme-colors-surface)' : undefined,
                  }}
                >
                  <div
                    className={`relative ${aspectClass} overflow-hidden`}
                    style={img ? undefined : { backgroundColor: 'var(--theme-colors-surface)' }}
                  >
                    {image}
                  </div>
                  {(title || subtitle || arrow) && (
                    <div className="flex items-center justify-between gap-3 p-3 md:p-4">
                      {text}
                      {arrow}
                    </div>
                  )}
                </Wrapper>
              )}
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </section>
  );
}

export const categoryTilesSection: SectionDefinition = {
  schema: {
    id: 'category-tiles',
    label: { en: 'Category tiles', ar: 'بطاقات الفئات' },
    icon: 'layout-grid',
    category: 'commerce',
    description: {
      en: 'Equal image cards with a title, a subtitle and a link. Good for collections and categories.',
      ar: 'بطاقات صور متساوية مع عنوان وعنوان فرعي ورابط. مناسبة للمجموعات والفئات.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 240 },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Tiles', ar: 'البطاقات' },
        maxItems: CATEGORY_TILES_MAX,
        fields: [
          { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' }, maxLength: 60 },
          { key: 'subtitle', type: 'text', label: { en: 'Subtitle', ar: 'العنوان الفرعي' }, maxLength: 80 },
          { key: 'url', type: 'url', label: { en: 'Link URL', ar: 'الرابط' } },
          {
            key: 'alt',
            type: 'text',
            label: { en: 'Image description (alt text)', ar: 'وصف الصورة (النص البديل)' },
            maxLength: 160,
          },
        ],
      },
      {
        key: 'card_style',
        type: 'select',
        label: { en: 'Card style', ar: 'نمط البطاقة' },
        defaultValue: 'caption',
        options: [
          { value: 'caption', label: { en: 'Text below the image', ar: 'النص تحت الصورة' } },
          { value: 'overlay', label: { en: 'Text over the image', ar: 'النص فوق الصورة' } },
        ],
      },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Image aspect', ar: 'نسبة الصورة' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square', ar: 'مربّع' } },
          { value: 'portrait', label: { en: 'Portrait 4:5', ar: 'طولي 4:5' } },
          { value: 'landscape', label: { en: 'Landscape 4:3', ar: 'عرضي 4:3' } },
        ],
      },
      { key: 'columns', type: 'number', label: { en: 'Columns (desktop)', ar: 'الأعمدة (سطح المكتب)' }, min: 2, max: 6, defaultValue: 4 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns (tablet)', ar: 'الأعمدة (اللوحي)' }, min: 2, max: 4, defaultValue: 3 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns (mobile)', ar: 'الأعمدة (الجوال)' }, min: 1, max: 2, defaultValue: 2 },
      {
        key: 'mobile_scroll',
        type: 'boolean',
        label: { en: 'One scrolling row on mobile', ar: 'صف واحد قابل للتمرير على الجوال' },
        defaultValue: false,
      },
      {
        key: 'heading_align',
        type: 'select',
        label: { en: 'Heading alignment', ar: 'محاذاة العنوان' },
        defaultValue: 'center',
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
      { key: 'show_arrow', type: 'boolean', label: { en: 'Show arrow', ar: 'إظهار السهم' }, defaultValue: true },
      {
        key: 'card_surface',
        type: 'boolean',
        label: { en: 'Card background', ar: 'خلفية البطاقة' },
        defaultValue: true,
        showIf: { key: 'card_style', in: ['', 'caption'] },
      },
      { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'زوايا مستديرة' }, defaultValue: true },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'title_color', type: 'color', label: { en: 'Tile title color', ar: 'لون عنوان البطاقة' } },
      { key: 'subtitle_color', type: 'color', label: { en: 'Tile subtitle color', ar: 'لون العنوان الفرعي للبطاقة' } },
      { key: 'arrow_bg_color', type: 'color', label: { en: 'Arrow background', ar: 'خلفية السهم' } },
      { key: 'arrow_color', type: 'color', label: { en: 'Arrow color', ar: 'لون السهم' } },
    ],
  },
  Component: CategoryTiles,
  needsBuilderPreview: true,
  defaultSettings: {
    card_style: 'caption',
    aspect: 'square',
    columns: 4,
    columns_tablet: 3,
    columns_mobile: 2,
    mobile_scroll: false,
    heading_align: 'center',
    heading_rule: false,
    show_arrow: true,
    card_surface: true,
    rounded: true,
  },
  defaultContent: {
    heading: 'Shop by category',
    items: [
      { title: 'New in', subtitle: 'The latest arrivals', url: '/products' },
      { title: 'Clothing', subtitle: 'Everyday pieces', url: '/products' },
      { title: 'Accessories', subtitle: 'Finishing touches', url: '/products' },
      { title: 'Gifts', subtitle: 'Something for everyone', url: '/products' },
    ],
  },
};
