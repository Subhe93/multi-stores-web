import type { SectionDefinition, SectionRenderProps } from '../../types';
import { resolveMediaUrl } from '@/lib/api';
import { colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';

interface LogoItem {
  image?: string;
  url?: string;
  alt?: string;
}

function clampColumns(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : fallback;
  return Math.max(2, Math.min(8, v));
}

// Extract a readable host from a URL for use as a link aria-label fallback.
function safeHost(url: string): string {
  try {
    return new URL(url, 'http://x').host;
  } catch {
    return '';
  }
}

function LogoList({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const items = ((content.items as LogoItem[]) || []).filter((l) => l.image);
  const columns = clampColumns(settings.columns, 5);
  const grayscale = settings.grayscale !== false;

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
      <StaggerGroup
        className="grid items-center gap-x-8 gap-y-6"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {items.map((l, i) => {
          const img = (
            <img
              src={resolveMediaUrl(l.image!)}
              alt={l.alt || ''}
              loading="lazy"
              className="max-h-12 w-auto mx-auto object-contain transition-all duration-300"
              style={
                grayscale
                  ? { filter: 'grayscale(1)', opacity: 0.7 }
                  : undefined
              }
            />
          );
          // Anonymous-link guard: when alt is empty, fall back to host or
          // a localized "Open link" so the link has a discernible name.
          const linkLabel =
            l.alt?.trim() ||
            (l.url ? safeHost(l.url) : '') ||
            (locale === 'ar' ? 'فتح الرابط' : 'Open link');
          return (
            <StaggerItem key={i}>
              {l.url ? (
                <a
                  href={l.url}
                  aria-label={linkLabel}
                  className="block hover:opacity-100 [&>img]:hover:grayscale-0 [&>img]:hover:opacity-100"
                >
                  {img}
                </a>
              ) : (
                img
              )}
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </section>
  );
}

export const logoListSection: SectionDefinition = {
  schema: {
    id: 'logo-list',
    label: { en: 'Logo List', ar: 'قائمة الشعارات' },
    icon: 'image',
    category: 'social',
    description: {
      en: 'Row of partner or brand logos. Optional grayscale that colours on hover.',
      ar: 'صف من شعارات الشركاء أو الماركات. خيار تدرّج رمادي يتلوّن عند المرور.',
    },
    translatable: ['heading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'columns', type: 'number', label: { en: 'Columns', ar: 'الأعمدة' }, min: 2, max: 8, defaultValue: 5 },
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
  Component: LogoList,
  defaultSettings: { columns: 5, grayscale: true },
  defaultContent: { heading: 'Trusted by leading brands', items: [] },
};
