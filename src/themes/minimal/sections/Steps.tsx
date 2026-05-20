import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';
import { SectionHeading } from './_shared/SectionHeading';

interface StepItem {
  title?: string;
  description?: string;
}

function clampColumns(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : fallback;
  return Math.max(2, Math.min(4, v));
}

// Numbered process / "how it works" section. Each step shows an auto-numbered
// badge, title and short description, optionally joined by a connector line on
// wide screens. Composes the shared SectionHeading + staggered reveal.
function Steps({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const items = ((content.items as StepItem[]) || []).filter((s) => s.title || s.description);
  const columns = clampColumns(settings.columns, 3);
  const showConnector = settings.show_connector !== false;

  const badgeColor = colorOr(settings.badge_color, 'var(--theme-colors-primary)');
  const badgeTextColor = colorOr(settings.badge_text_color, 'var(--theme-colors-primaryContrast, #fff)');
  const titleColor = colorOr(settings.title_color, 'var(--theme-colors-text)');
  const descriptionColor = colorOr(settings.description_color, 'var(--theme-colors-muted)');

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
            {locale === 'ar' ? 'لا توجد خطوات بعد. أضف عناصر من البيلدر.' : 'No steps yet. Add some from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-14">
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
        className="grid gap-x-8 gap-y-10"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {items.map((s, i) => (
          <StaggerItem key={i} className="relative flex flex-col items-center text-center gap-3">
            {/* Connector line to the next step (desktop only). */}
            {showConnector && i < items.length - 1 && (
              <span
                aria-hidden
                className="hidden md:block absolute top-6 left-1/2 w-full h-px"
                style={{ backgroundColor: 'var(--theme-colors-border)' }}
              />
            )}
            <div
              className="relative z-10 size-12 rounded-full flex items-center justify-center text-lg font-semibold shrink-0"
              style={{ backgroundColor: badgeColor, color: badgeTextColor }}
            >
              {i + 1}
            </div>
            {s.title && (
              <h3 className="text-base font-semibold leading-tight" style={{ color: titleColor }}>
                {s.title}
              </h3>
            )}
            {s.description && (
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: descriptionColor }}>
                {s.description}
              </p>
            )}
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}

export const stepsSection: SectionDefinition = {
  schema: {
    id: 'steps',
    label: { en: 'Steps', ar: 'خطوات' },
    icon: 'list-ordered',
    category: 'content',
    description: {
      en: 'Numbered "how it works" process — each step with a title and short description.',
      ar: 'خطوات مرقّمة لشرح "كيف تعمل" — كل خطوة بعنوان ووصف قصير.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'columns', type: 'number', label: { en: 'Columns', ar: 'الأعمدة' }, min: 2, max: 4, defaultValue: 3 },
      { key: 'show_connector', type: 'boolean', label: { en: 'Show connector line', ar: 'إظهار خط الوصل' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Steps', ar: 'الخطوات' },
        fields: [
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' } },
          { key: 'description', type: 'textarea', label: { en: 'Description', ar: 'الوصف' } },
        ],
      },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'badge_color', type: 'color', label: { en: 'Number badge color', ar: 'لون شارة الرقم' } },
      { key: 'badge_text_color', type: 'color', label: { en: 'Number text color', ar: 'لون رقم الشارة' } },
      { key: 'title_color', type: 'color', label: { en: 'Step title color', ar: 'لون عنوان الخطوة' } },
      { key: 'description_color', type: 'color', label: { en: 'Step description color', ar: 'لون وصف الخطوة' } },
    ],
  },
  Component: Steps,
  defaultSettings: { columns: 3, show_connector: true },
  defaultContent: {
    items: [
      { title: 'Tap', description: 'Tap your card on any smartphone — no app required.' },
      { title: 'Share', description: 'Your details and links appear instantly on their phone.' },
      { title: 'Save', description: 'They save you to their contacts with a single click.' },
    ],
  },
};
