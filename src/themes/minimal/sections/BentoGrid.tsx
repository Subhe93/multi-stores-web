import { resolveMediaUrl } from '@/lib/api';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';
import { SectionHeading } from './_shared/SectionHeading';

type TileSize = 'small' | 'wide' | 'tall' | 'large';

interface BentoTile {
  size?: TileSize;
  title?: string;
  text?: string;
  image?: string;
  url?: string;
  bg_color?: string;
}

// Tailwind span classes per tile size (4-col grid on desktop, 2-col on mobile).
const SPAN: Record<TileSize, string> = {
  small: 'md:col-span-1 md:row-span-1',
  wide: 'md:col-span-2 md:row-span-1',
  tall: 'md:col-span-1 md:row-span-2',
  large: 'md:col-span-2 md:row-span-2',
};

// A modern asymmetric "bento" grid of tiles in mixed sizes. Each tile can carry
// an image (with overlaid text) or a title + body on a coloured surface. Tiles
// reveal in a stagger and lift on hover.
function BentoGrid({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const tiles = ((content.tiles as BentoTile[]) || []).filter((t) => t.title || t.text || t.image);

  if (tiles.length === 0) {
    return (
      <section className="py-12">
        <div
          className="text-center py-10 px-4"
          style={{ border: '1px dashed var(--theme-colors-border)', borderRadius: 'var(--theme-radius-md)', color: 'var(--theme-colors-muted)' }}
        >
          <p className="text-sm">
            {locale === 'ar' ? 'لا توجد بطاقات بعد. أضف عناصر من البيلدر.' : 'No tiles yet. Add some from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-14">
      {(heading || subheading) && (
        <div className="mb-10">
          <SectionHeading heading={heading} subheading={subheading} align="center" headingColor={settings.heading_color} subheadingColor={settings.subheading_color} />
        </div>
      )}

      <StaggerGroup
        className="grid grid-cols-2 md:grid-cols-4 gap-4 md:auto-rows-[170px]"
        style={{ gridAutoFlow: 'dense' }}
      >
        {tiles.map((t, i) => {
          const size = (t.size as TileSize) || 'small';
          const img = t.image ? resolveMediaUrl(t.image) : '';
          const Wrapper = t.url ? 'a' : 'div';
          return (
            <StaggerItem key={i} className={`${SPAN[size]} min-h-[170px]`}>
              <Wrapper
                {...(t.url ? { href: t.url } : {})}
                className="card-lift relative flex h-full flex-col justify-end overflow-hidden p-5"
                style={{
                  borderRadius: 'var(--theme-radius-lg)',
                  backgroundColor: img ? '#000' : colorOr(t.bg_color, 'var(--theme-colors-surface)'),
                  border: img ? 'none' : '1px solid var(--theme-colors-border)',
                }}
              >
                {img && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={t.title || ''} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.6) 100%)' }} />
                  </>
                )}
                <div className="relative z-10">
                  {t.title && (
                    <h3 className="text-lg font-semibold leading-tight" style={{ color: img ? '#fff' : 'var(--theme-colors-text)' }}>
                      {t.title}
                    </h3>
                  )}
                  {t.text && (
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: img ? 'rgba(255,255,255,0.85)' : 'var(--theme-colors-muted)' }}>
                      {t.text}
                    </p>
                  )}
                </div>
              </Wrapper>
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </section>
  );
}

const SIZE_OPTIONS = [
  { value: 'small', label: { en: 'Small (1×1)', ar: 'صغير (1×1)' } },
  { value: 'wide', label: { en: 'Wide (2×1)', ar: 'عريض (2×1)' } },
  { value: 'tall', label: { en: 'Tall (1×2)', ar: 'طويل (1×2)' } },
  { value: 'large', label: { en: 'Large (2×2)', ar: 'كبير (2×2)' } },
];

export const bentoGridSection: SectionDefinition = {
  schema: {
    id: 'bento-grid',
    label: { en: 'Bento Grid', ar: 'شبكة بنتو' },
    icon: 'layout-grid',
    category: 'content',
    description: {
      en: 'A modern asymmetric grid of mixed-size tiles with images or text. Tiles reveal in a stagger and lift on hover.',
      ar: 'شبكة عصرية غير متماثلة من بطاقات بأحجام مختلفة بصور أو نصوص. تظهر بالتتابع وترتفع عند المرور.',
    },
    translatable: ['heading', 'subheading', 'tiles'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'tiles',
        type: 'repeater',
        label: { en: 'Tiles', ar: 'البطاقات' },
        fields: [
          { key: 'size', type: 'select', label: { en: 'Size', ar: 'الحجم' }, defaultValue: 'small', options: SIZE_OPTIONS },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' } },
          { key: 'text', type: 'textarea', label: { en: 'Text', ar: 'النص' } },
          { key: 'image', type: 'image', label: { en: 'Background image (optional)', ar: 'صورة خلفية (اختياري)' } },
          { key: 'url', type: 'url', label: { en: 'Link URL (optional)', ar: 'رابط (اختياري)' } },
          { key: 'bg_color', type: 'color', label: { en: 'Tile color (no image)', ar: 'لون البطاقة (بدون صورة)' } },
        ],
      },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
    ],
  },
  Component: BentoGrid,
  defaultSettings: {},
  defaultContent: {
    tiles: [
      { size: 'large', title: 'Featured', text: 'Your headline highlight goes here.' },
      { size: 'small', title: 'Fast' },
      { size: 'small', title: 'Secure' },
      { size: 'wide', title: 'Loved by thousands', text: 'Add a supporting line.' },
      { size: 'tall', title: 'Quality' },
    ],
  },
};
