import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';
import { Counter, StaggerGroup, StaggerItem } from '../../_motion';
import { SectionHeading } from './_shared/SectionHeading';

interface StatItem {
  value?: string;
  label?: string;
  prefix?: string;
  suffix?: string;
}

function clampColumns(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : fallback;
  return Math.max(2, Math.min(4, v));
}

function StatsBar({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const items = ((content.items as StatItem[]) || []).filter((s) => s.value || s.label);
  const columns = clampColumns(settings.columns, items.length || 3);
  const style = (settings.style as 'plain' | 'surface') || 'plain';

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
            {locale === 'ar' ? 'لا توجد أرقام بعد. أضف عناصر من البيلدر.' : 'No stats yet. Add some from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12">
      {(heading || subheading) && (
        <div className="mb-10">
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
        className="grid gap-6 text-center"
        style={
          style === 'surface'
            ? {
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                backgroundColor: 'var(--theme-colors-surface)',
                border: '1px solid var(--theme-colors-border)',
                borderRadius: 'var(--theme-radius-lg)',
                padding: '2.5rem 1.5rem',
              }
            : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
        }
      >
        {items.map((s, i) => (
          <StaggerItem key={i}>
            <Counter
              value={s.value || ''}
              prefix={s.prefix || ''}
              suffix={s.suffix || ''}
              className="block font-semibold leading-none"
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'calc(var(--theme-scale-h2) * 1.1)',
                letterSpacing: 'var(--theme-tracking-heading)',
                color: colorOr(settings.value_color, 'var(--theme-colors-primary)'),
              }}
            />
            {s.label && (
              <div className="text-sm mt-2" style={{ color: 'var(--theme-colors-muted)' }}>
                {s.label}
              </div>
            )}
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}

export const statsBarSection: SectionDefinition = {
  schema: {
    id: 'stats-bar',
    label: { en: 'Stats', ar: 'إحصائيات' },
    icon: 'bar-chart',
    category: 'content',
    description: {
      en: 'Row of big numbers with labels — customers, orders, ratings, anything.',
      ar: 'صف من الأرقام الكبيرة مع تسميات — عملاء، طلبات، تقييمات، أي شيء.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'النمط' },
        defaultValue: 'plain',
        options: [
          { value: 'plain', label: { en: 'Plain', ar: 'بسيط' } },
          { value: 'surface', label: { en: 'Surface card', ar: 'بطاقة' } },
        ],
      },
      { key: 'columns', type: 'number', label: { en: 'Columns', ar: 'الأعمدة' }, min: 2, max: 4, defaultValue: 3 },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Stats', ar: 'الأرقام' },
        fields: [
          { key: 'value', type: 'text', label: { en: 'Value', ar: 'القيمة' } },
          { key: 'prefix', type: 'text', label: { en: 'Prefix (optional)', ar: 'بادئة (اختياري)' } },
          { key: 'suffix', type: 'text', label: { en: 'Suffix (optional)', ar: 'لاحقة (اختياري)' } },
          { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
        ],
      },
      { key: 'value_color', type: 'color', label: { en: 'Number color', ar: 'لون الرقم' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
    ],
  },
  Component: StatsBar,
  defaultSettings: { style: 'plain', columns: 3 },
  defaultContent: {
    items: [
      { value: '10K', suffix: '+', label: 'Happy customers' },
      { value: '50K', suffix: '+', label: 'Orders delivered' },
      { value: '4.9', suffix: '/5', label: 'Average rating' },
    ],
  },
};
