import { useId } from 'react';
import { resolveMediaUrl } from '@/lib/api';
import type { SectionDefinition, SectionRenderProps } from '../../types';

interface GalleryItem {
  url?: string;
  alt?: string;
  caption?: string;
  href?: string;
}

type Layout = 'grid' | 'masonry' | 'carousel';
type Aspect = 'square' | 'portrait' | 'landscape' | 'auto';

const ASPECT_CLASS: Record<Aspect, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
  auto: '',
};

function ImageGallery({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  // Items live on translatable content (per the schema) so creators can vary
  // captions and links per locale.
  const items = (content.items as GalleryItem[]) || (settings.items as GalleryItem[]) || [];
  const columns = clamp((settings.columns as number) ?? 3, 1, 6);
  const columnsTablet = clamp((settings.columns_tablet as number) ?? Math.min(columns, 3), 1, 6);
  const columnsMobile = clamp((settings.columns_mobile as number) ?? Math.min(columnsTablet, 2), 1, 4);
  const layout = (settings.layout as Layout) || 'grid';
  const aspect = (settings.aspect as Aspect) || 'square';
  const showCaption = settings.show_caption !== false;
  const rounded = settings.rounded !== false;
  // Scoped class so per-breakpoint grid-template-columns rules don't bleed
  // across multiple ImageGallery instances on the same page.
  const scopeClass = `ig-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const visibleItems = items.filter((i) => !!i.url);

  const radiusStyle = rounded ? { borderRadius: 'var(--theme-radius-md)' } : undefined;

  // Each image is a tile — wrapped in <a> only when a link is supplied. Keeps
  // the same hover/transition treatment regardless of click behaviour.
  function Tile({ item }: { item: GalleryItem }) {
    const inner = (
      <div className="group relative overflow-hidden" style={radiusStyle}>
        <img
          src={resolveMediaUrl(item.url || '')}
          alt={item.alt || ''}
          loading="lazy"
          className={`w-full ${ASPECT_CLASS[aspect]} object-cover transition-transform duration-500 group-hover:scale-105`}
        />
        {showCaption && item.caption && (
          <div
            className="absolute inset-x-0 bottom-0 p-3 text-white text-xs translate-y-full group-hover:translate-y-0 transition-transform duration-300"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65), transparent)' }}
          >
            {item.caption}
          </div>
        )}
      </div>
    );
    return item.href ? <a href={item.href}>{inner}</a> : inner;
  }

  return (
    <section className="py-12">
      {(heading || subheading) && (
        <div className="text-center mb-10 space-y-2">
          {heading && (
            <h2
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h2)',
                fontWeight: 'var(--theme-weight-heading)',
                lineHeight: 'var(--theme-line-heading)',
              }}
            >
              {heading}
            </h2>
          )}
          {subheading && (
            <p className="max-w-2xl mx-auto" style={{ color: 'var(--theme-colors-muted)' }}>
              {subheading}
            </p>
          )}
        </div>
      )}

      {visibleItems.length === 0 ? (
        <div
          className="text-center py-10 px-4"
          style={{
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
            color: 'var(--theme-colors-muted)',
          }}
        >
          <p className="text-sm">
            {locale === 'ar'
              ? 'لا توجد صور بعد. أضف صورًا من البيلدر.'
              : 'No images yet. Add some from the builder.'}
          </p>
        </div>
      ) : layout === 'masonry' ? (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 *:mb-4 *:break-inside-avoid">
          {visibleItems.map((item, i) => (
            <Tile key={i} item={item} />
          ))}
        </div>
      ) : layout === 'carousel' ? (
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4">
          {visibleItems.map((item, i) => (
            <div key={i} className="snap-start shrink-0 w-72">
              <Tile item={item} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Per-breakpoint grid columns — inline styles can't carry media
              queries so we inject a scoped style block keyed off useId. */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
.${scopeClass} { grid-template-columns: repeat(${columns}, minmax(0, 1fr)); }
@media (max-width: 1023px) {
  .${scopeClass} { grid-template-columns: repeat(${columnsTablet}, minmax(0, 1fr)); }
}
@media (max-width: 767px) {
  .${scopeClass} { grid-template-columns: repeat(${columnsMobile}, minmax(0, 1fr)); }
}
              `.trim(),
            }}
          />
          <div className={`grid gap-4 ${scopeClass}`}>
            {visibleItems.map((item, i) => (
              <Tile key={i} item={item} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export const imageGallerySection: SectionDefinition = {
  schema: {
    id: 'image-gallery',
    label: { en: 'Image Gallery', ar: 'معرض صور' },
    icon: 'gallery',
    category: 'showcase',
    description: {
      en: 'Visual grid, masonry or horizontal carousel. Each image can link and reveal a caption on hover.',
      ar: 'شبكة بصرية، نمط masonry، أو شريط أفقي. كل صورة قابلة للربط مع تسمية تظهر عند المرور.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'grid',
        options: [
          { value: 'grid', label: { en: 'Grid', ar: 'شبكة' } },
          { value: 'masonry', label: { en: 'Masonry', ar: 'Masonry' } },
          { value: 'carousel', label: { en: 'Horizontal carousel', ar: 'شريط أفقي' } },
        ],
      },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square', ar: 'مربع' } },
          { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
          { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
          { value: 'auto', label: { en: 'Original', ar: 'الأصلي' } },
        ],
      },
      { key: 'columns', type: 'number', label: { en: 'Columns — desktop (grid only)', ar: 'الأعمدة — سطح المكتب (للشبكة)' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns — tablet', ar: 'الأعمدة — تابلت' }, min: 1, max: 6, defaultValue: 2 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns — mobile', ar: 'الأعمدة — جوال' }, min: 1, max: 4, defaultValue: 2 },
      { key: 'show_caption', type: 'boolean', label: { en: 'Show captions on hover', ar: 'إظهار التسمية عند المرور' }, defaultValue: true },
      { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'حواف دائرية' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Images', ar: 'الصور' },
        fields: [
          { key: 'url', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
          { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'نص بديل' } },
          { key: 'caption', type: 'text', label: { en: 'Caption', ar: 'تسمية توضيحية' } },
          { key: 'href', type: 'url', label: { en: 'Link (optional)', ar: 'رابط (اختياري)' } },
        ],
      },
    ],
  },
  Component: ImageGallery,
  defaultSettings: { layout: 'grid', aspect: 'square', columns: 3, columns_tablet: 2, columns_mobile: 2, show_caption: true, rounded: true, items: [] },
};
