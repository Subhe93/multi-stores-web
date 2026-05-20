import { Check, X } from 'lucide-react';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';
import { SectionHeading } from './_shared/SectionHeading';

interface ComparisonRow {
  feature?: string;
  a?: string; // 'yes' | 'no'
  b?: string; // 'yes' | 'no'
}

function Mark({ value, color }: { value?: string; color: string }) {
  if (value === 'no') {
    return <X className="size-5 mx-auto" style={{ color: 'var(--theme-colors-muted)', opacity: 0.6 }} />;
  }
  return <Check className="size-5 mx-auto" style={{ color }} />;
}

// Two-column feature comparison ("us" vs "them"). The highlighted column reads
// as the recommended choice with an accent header and surface background.
function ComparisonTable({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const colA = (content.col_a_label as string) || (locale === 'ar' ? 'نحن' : 'Us');
  const colB = (content.col_b_label as string) || (locale === 'ar' ? 'الآخرون' : 'Others');
  const rows = ((content.rows as ComparisonRow[]) || []).filter((r) => r.feature);
  const accent = colorOr(settings.highlight_color, 'var(--theme-colors-primary)');

  if (rows.length === 0) {
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
            {locale === 'ar' ? 'لا توجد صفوف بعد. أضف عناصر من البيلدر.' : 'No rows yet. Add some from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  // Grid: feature column (flexible) + two fixed value columns.
  const gridCols = 'minmax(0,1fr) 7rem 7rem';

  return (
    <section className="py-14">
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

      <div
        className="mx-auto max-w-3xl overflow-hidden"
        style={{ border: '1px solid var(--theme-colors-border)', borderRadius: 'var(--theme-radius-lg)' }}
      >
        {/* Header row */}
        <div
          className="grid items-center text-sm font-semibold"
          style={{ gridTemplateColumns: gridCols, backgroundColor: 'var(--theme-colors-surface)' }}
        >
          <div className="px-5 py-4" style={{ color: 'var(--theme-colors-muted)' }} />
          <div
            className="px-3 py-4 text-center text-white"
            style={{ backgroundColor: accent }}
          >
            {colA}
          </div>
          <div className="px-3 py-4 text-center" style={{ color: 'var(--theme-colors-muted)' }}>
            {colB}
          </div>
        </div>

        <StaggerGroup>
          {rows.map((r, i) => (
            <StaggerItem
              key={i}
              className="grid items-center text-sm"
              style={{
                gridTemplateColumns: gridCols,
                borderTop: '1px solid var(--theme-colors-border)',
              }}
            >
              <div className="px-5 py-4" style={{ color: 'var(--theme-colors-text)' }}>
                {r.feature}
              </div>
              <div className="px-3 py-4 h-full flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${accent} 7%, transparent)` }}>
                <Mark value={r.a || 'yes'} color={accent} />
              </div>
              <div className="px-3 py-4">
                <Mark value={r.b || 'no'} color="var(--theme-colors-muted)" />
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

const YES_NO_OPTIONS = [
  { value: 'yes', label: { en: 'Yes (check)', ar: 'نعم (صح)' } },
  { value: 'no', label: { en: 'No (cross)', ar: 'لا (خطأ)' } },
];

export const comparisonTableSection: SectionDefinition = {
  schema: {
    id: 'comparison-table',
    label: { en: 'Comparison', ar: 'مقارنة' },
    icon: 'table',
    category: 'content',
    description: {
      en: 'Two-column feature comparison ("us" vs "others") with check / cross marks and a highlighted column.',
      ar: 'مقارنة من عمودين ("نحن" مقابل "الآخرون") بعلامات صح / خطأ وعمود مميَّز.',
    },
    translatable: ['heading', 'subheading', 'col_a_label', 'col_b_label', 'rows'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'col_a_label', type: 'text', label: { en: 'Your column label', ar: 'تسمية عمودك' } },
      { key: 'col_b_label', type: 'text', label: { en: 'Other column label', ar: 'تسمية العمود الآخر' } },
      {
        key: 'rows',
        type: 'repeater',
        label: { en: 'Rows', ar: 'الصفوف' },
        fields: [
          { key: 'feature', type: 'text', label: { en: 'Feature', ar: 'الميزة' } },
          { key: 'a', type: 'select', label: { en: 'Your column', ar: 'عمودك' }, defaultValue: 'yes', options: YES_NO_OPTIONS },
          { key: 'b', type: 'select', label: { en: 'Other column', ar: 'العمود الآخر' }, defaultValue: 'no', options: YES_NO_OPTIONS },
        ],
      },
      { key: 'highlight_color', type: 'color', label: { en: 'Highlight color', ar: 'لون التمييز' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
    ],
  },
  Component: ComparisonTable,
  defaultSettings: {},
  defaultContent: {
    col_a_label: 'Smart card',
    col_b_label: 'Paper card',
    rows: [
      { feature: 'Share instantly with one tap', a: 'yes', b: 'no' },
      { feature: 'Always up to date', a: 'yes', b: 'no' },
      { feature: 'Never runs out', a: 'yes', b: 'no' },
      { feature: 'Eco-friendly', a: 'yes', b: 'no' },
    ],
  },
};
