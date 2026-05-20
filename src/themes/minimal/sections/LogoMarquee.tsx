import type { SectionDefinition, SectionRenderProps } from '../../types';
import { resolveMediaUrl } from '@/lib/api';
import { colorOr } from '../../elementStyles';

interface LogoItem {
  image?: string;
  url?: string;
  alt?: string;
}

// Seconds for the track to complete one loop, by speed setting.
const DURATION: Record<string, number> = { slow: 50, normal: 32, fast: 18 };

// Infinite auto-scrolling logo strip (CSS-only marquee). Two copies of the
// logos slide seamlessly; hovering pauses, and reduced-motion stops it and
// wraps the logos onto centered rows (see .marquee rules in globals.css).
function LogoMarquee({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const items = ((content.items as LogoItem[]) || []).filter((l) => l.image);
  const grayscale = settings.grayscale !== false;
  const speed = (settings.speed as string) || 'normal';
  const duration = DURATION[speed] ?? DURATION.normal;

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
            {locale === 'ar' ? 'لا توجد شعارات بعد. أضف عناصر من البيلدر.' : 'No logos yet. Add some from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  const renderLogo = (l: LogoItem, key: string) => {
    const img = (
      <img
        src={resolveMediaUrl(l.image!)}
        alt={l.alt || ''}
        loading="lazy"
        className="max-h-10 w-auto object-contain transition-all duration-300"
        style={grayscale ? { filter: 'grayscale(1)', opacity: 0.65 } : undefined}
      />
    );
    return (
      <div key={key} className="shrink-0 flex items-center justify-center px-8 [&>img]:hover:grayscale-0 [&>img]:hover:opacity-100">
        {l.url ? (
          <a href={l.url} className="block">
            {img}
          </a>
        ) : (
          img
        )}
      </div>
    );
  };

  return (
    <section className="py-12">
      {heading && (
        <p
          className="text-center text-xs font-semibold uppercase tracking-wider mb-8"
          style={{ color: colorOr(settings.heading_color, 'var(--theme-colors-muted)') }}
        >
          {heading}
        </p>
      )}
      <div className="marquee">
        <div className="marquee-track" style={{ animationDuration: `${duration}s` }}>
          {items.map((l, i) => renderLogo(l, `a-${i}`))}
          {/* Second copy enables the seamless loop. */}
          {items.map((l, i) => renderLogo(l, `b-${i}`))}
        </div>
      </div>
    </section>
  );
}

export const logoMarqueeSection: SectionDefinition = {
  schema: {
    id: 'logo-marquee',
    label: { en: 'Logo Marquee', ar: 'شريط شعارات متحرك' },
    icon: 'image',
    category: 'social',
    description: {
      en: 'Auto-scrolling row of partner or brand logos. Pauses on hover; grayscale colours on hover.',
      ar: 'صف شعارات يتحرك تلقائياً للشركاء أو الماركات. يتوقف عند المرور؛ ويتلوّن الرمادي عند المرور.',
    },
    translatable: ['heading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      {
        key: 'speed',
        type: 'select',
        label: { en: 'Scroll speed', ar: 'سرعة التمرير' },
        defaultValue: 'normal',
        options: [
          { value: 'slow', label: { en: 'Slow', ar: 'بطيء' } },
          { value: 'normal', label: { en: 'Normal', ar: 'متوسط' } },
          { value: 'fast', label: { en: 'Fast', ar: 'سريع' } },
        ],
      },
      { key: 'grayscale', type: 'boolean', label: { en: 'Grayscale (colour on hover)', ar: 'رمادي (يتلوّن عند المرور)' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Logos', ar: 'الشعارات' },
        fields: [
          { key: 'image', type: 'image', label: { en: 'Logo image', ar: 'صورة الشعار' } },
          { key: 'url', type: 'url', label: { en: 'Link URL (optional)', ar: 'رابط (اختياري)' } },
          { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'النص البديل' } },
        ],
      },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
    ],
  },
  Component: LogoMarquee,
  defaultSettings: { speed: 'normal', grayscale: true },
  defaultContent: { heading: 'Trusted by leading brands', items: [] },
};
