// Timeline — brand story milestones along a vertical connector line with dot
// markers in the theme primary. Desktop alternates sides (zigzag) when
// `alternate` is on; mobile always collapses to a single start-aligned column.
// All offsets use logical properties so the layout mirrors cleanly under RTL.

import { resolveMediaUrl } from '@/lib/api';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr, mediaFx } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';
import { SectionHeading } from './_shared/SectionHeading';

interface TimelineItem {
  label?: string;
  title?: string;
  description?: string;
  image?: string;
}

function Timeline({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const items = ((content.items as TimelineItem[]) || []).filter(
    (it) => it.label || it.title || it.description,
  );
  const alternate = settings.alternate !== false;

  // Per-element color overrides — each falls back to the active theme token.
  const markerColor = colorOr(settings.marker_color, 'var(--theme-colors-primary)');
  const labelColor = colorOr(settings.label_color, 'var(--theme-colors-primary)');
  const titleColor = colorOr(settings.title_color, 'var(--theme-colors-text)');
  const descriptionColor = colorOr(settings.description_color, 'var(--theme-colors-muted)');

  // Stay visible while empty so creators can see placement in the builder.
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
            {locale === 'ar' ? 'لا توجد محطات زمنية بعد. أضف عناصر من البيلدر.' : 'No timeline entries yet. Add some from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  // The dot punches a hole through the connector line via a background-colored
  // ring, so the line never visually crosses through it.
  const dot = (
    <span
      className="block size-3.5 rounded-full"
      style={{
        backgroundColor: markerColor,
        boxShadow: '0 0 0 4px var(--theme-colors-background)',
      }}
    />
  );

  const renderBody = (item: TimelineItem, alignEnd: boolean) => (
    <div className={`flex flex-col gap-2 ${alignEnd ? 'md:items-end md:text-end' : ''}`}>
      {item.label && (
        <span className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: labelColor }}>
          {item.label}
        </span>
      )}
      {item.title && (
        <h3
          style={{
            fontFamily: 'var(--theme-font-heading)',
            fontSize: 'var(--theme-scale-h4)',
            fontWeight: 'var(--theme-weight-heading)',
            lineHeight: 'var(--theme-line-heading)',
            color: titleColor,
          }}
        >
          {item.title}
        </h3>
      )}
      {item.description && (
        <p className="text-sm leading-relaxed max-w-prose" style={{ color: descriptionColor }}>
          {item.description}
        </p>
      )}
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveMediaUrl(item.image)}
          alt={item.title || ''}
          loading="lazy"
          className="w-full max-w-sm aspect-[16/10] object-cover mt-2"
          style={mediaFx({ radius: 'var(--theme-radius-md)', shadow: 'var(--theme-shadow-sm)' })}
        />
      )}
    </div>
  );

  return (
    <section className="py-14 md:py-20">
      {(heading || subheading) && (
        <div className="mb-14">
          <SectionHeading
            heading={heading}
            subheading={subheading}
            align="center"
            headingColor={settings.heading_color}
            subheadingColor={settings.subheading_color}
          />
        </div>
      )}

      <div className="relative max-w-4xl mx-auto">
        {/* Connector line — start-aligned on mobile / single-column mode,
            centered on desktop when alternating. left-1/2 with -50% translate
            is symmetric, so it needs no RTL special-casing. */}
        <div
          className={`absolute top-1 bottom-1 w-px ${alternate ? 'md:hidden' : ''}`}
          style={{ insetInlineStart: '7px', backgroundColor: markerColor, opacity: 0.25 }}
        />
        {alternate && (
          <div
            className="absolute top-1 bottom-1 w-px hidden md:block left-1/2 -translate-x-1/2"
            style={{ backgroundColor: markerColor, opacity: 0.25 }}
          />
        )}

        <StaggerGroup className="flex flex-col gap-10 md:gap-14">
          {items.map((item, i) => {
            const onEndSide = alternate && i % 2 === 1;
            return (
              <StaggerItem key={i}>
                <div
                  className={`relative ps-10 ${
                    alternate ? 'md:ps-0 md:grid md:grid-cols-[1fr_4rem_1fr] md:items-start' : ''
                  }`}
                >
                  {/* Mobile / single-column dot, centered over the start line. */}
                  <span
                    className={`absolute top-1 ${alternate ? 'md:hidden' : ''}`}
                    style={{ insetInlineStart: 0 }}
                  >
                    {dot}
                  </span>

                  {alternate && (
                    <span className="hidden md:flex md:col-start-2 md:row-start-1 justify-center pt-1.5">
                      {dot}
                    </span>
                  )}

                  <div
                    className={
                      alternate
                        ? `md:row-start-1 ${onEndSide ? 'md:col-start-3' : 'md:col-start-1'}`
                        : ''
                    }
                  >
                    {renderBody(item, alternate && !onEndSide)}
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </div>
    </section>
  );
}

export const timelineSection: SectionDefinition = {
  schema: {
    id: 'timeline',
    label: { en: 'Timeline', ar: 'الخط الزمني' },
    icon: 'clock',
    category: 'content',
    description: {
      en: 'Brand story milestones on a vertical line with dot markers. Optional zigzag on desktop.',
      ar: 'محطات قصة العلامة على خط عمودي مع نقاط. تعرّج اختياري على سطح المكتب.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'alternate',
        type: 'boolean',
        label: { en: 'Alternate sides on desktop', ar: 'تبديل الجهات على سطح المكتب' },
        defaultValue: true,
      },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Milestones', ar: 'المحطات' },
        fields: [
          { key: 'label', type: 'text', label: { en: 'Label (e.g. year)', ar: 'التسمية (مثل السنة)' } },
          { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' } },
          { key: 'description', type: 'textarea', label: { en: 'Description', ar: 'الوصف' } },
          { key: 'image', type: 'image', label: { en: 'Image (optional)', ar: 'صورة (اختياري)' } },
        ],
      },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'marker_color', type: 'color', label: { en: 'Line & marker color', ar: 'لون الخط والنقاط' } },
      { key: 'label_color', type: 'color', label: { en: 'Label color', ar: 'لون التسمية' } },
      { key: 'title_color', type: 'color', label: { en: 'Title color', ar: 'لون العنوان الفرعي للمحطة' } },
      { key: 'description_color', type: 'color', label: { en: 'Description color', ar: 'لون الوصف' } },
    ],
  },
  Component: Timeline,
  defaultSettings: { alternate: true },
  defaultContent: {
    heading: 'Our story',
    items: [
      { label: '2019', title: 'The first sketch', description: 'What began as a notebook idea became our founding product.' },
      { label: '2021', title: 'Opening the studio', description: 'A small workshop, three makers, and a growing waitlist.' },
      { label: '2024', title: 'Going global', description: 'Shipping to 40+ countries with the same handmade care.' },
    ],
  },
};
