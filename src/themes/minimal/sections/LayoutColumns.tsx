// LayoutColumns — a self-contained page-division section. Renders a CSS grid
// or flexbox of cells; each cell holds an ordered list of inline content
// blocks (heading / text / image / button / divider / spacer / html). No
// nested sections — this covers the common "split the page into columns of
// content" need without a builder/data-model rewrite.
//
// Server-only: blocks are static content; the only interactivity (button
// links) is plain anchors.

import { useId } from 'react';
import Link from 'next/link';
import { resolveMediaUrl } from '@/lib/api';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr, numberOr } from '../../elementStyles';

type Mode = 'grid' | 'flex';
type Align = 'start' | 'center' | 'end' | 'stretch';
type Justify = 'start' | 'center' | 'end' | 'between' | 'around';
type FlexDir = 'row' | 'column';

type BlockType = 'heading' | 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'html';

interface Block {
  type?: BlockType;
  // heading
  text?: string;
  level?: 'h2' | 'h3' | 'h4';
  // text
  html?: string;
  // image
  image?: string;
  alt?: string;
  aspect?: 'auto' | 'square' | 'landscape' | 'portrait' | 'wide';
  rounded?: boolean;
  // button
  button_label?: string;
  button_url?: string;
  button_variant?: 'solid' | 'outline';
  // divider
  // spacer
  height_px?: number;
  // raw html
  raw_html?: string;
  // shared
  align?: 'start' | 'center' | 'end';
  color?: string;
}

interface Cell {
  col_span?: number;
  align?: Align;
  blocks?: Block[];
}

const ASPECT_CLASS: Record<NonNullable<Block['aspect']>, string> = {
  auto: '',
  square: 'aspect-square',
  landscape: 'aspect-[4/3]',
  portrait: 'aspect-[3/4]',
  wide: 'aspect-[16/9]',
};

const TEXT_ALIGN: Record<'start' | 'center' | 'end', string> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

const ITEMS_ALIGN: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const JUSTIFY_CLASS: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ── Block renderer ──────────────────────────────────────────────

function BlockView({ block }: { block: Block }) {
  const type = block.type || 'text';
  const align = block.align || 'start';
  const alignClass = TEXT_ALIGN[align];

  switch (type) {
    case 'heading': {
      const Tag = block.level || 'h2';
      const sizeVar =
        Tag === 'h2' ? 'var(--theme-scale-h2)' : Tag === 'h3' ? 'var(--theme-scale-h3)' : 'var(--theme-scale-h4)';
      return (
        <Tag
          className={alignClass}
          style={{
            fontFamily: 'var(--theme-font-heading)',
            fontSize: sizeVar,
            fontWeight: 'var(--theme-weight-heading)',
            lineHeight: 'var(--theme-line-heading)',
            color: colorOr(block.color, 'var(--theme-colors-text)'),
          }}
        >
          {block.text || ''}
        </Tag>
      );
    }
    case 'text':
      return (
        <div
          className={`max-w-prose ${alignClass} prose-sm`}
          style={{
            color: colorOr(block.color, 'var(--theme-colors-text)'),
            lineHeight: 'var(--theme-line-body)',
          }}
          // Rich text is creator-authored via the dashboard editor.
          dangerouslySetInnerHTML={{ __html: block.html || '' }}
        />
      );
    case 'image': {
      if (!block.image) return null;
      const aspect = block.aspect || 'auto';
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveMediaUrl(block.image)}
          alt={block.alt || ''}
          loading="lazy"
          className={`w-full object-cover ${ASPECT_CLASS[aspect]} ${block.rounded ? '' : ''}`}
          style={block.rounded ? { borderRadius: 'var(--theme-radius-md)' } : undefined}
        />
      );
    }
    case 'button': {
      if (!block.button_label) return null;
      const outline = block.button_variant === 'outline';
      const justifyClass =
        align === 'center' ? 'justify-center' : align === 'end' ? 'justify-end' : 'justify-start';
      return (
        <div className={`flex ${justifyClass}`}>
          <Link
            href={block.button_url || '#'}
            className="inline-flex items-center justify-center px-6 py-2.5 text-sm transition hover:opacity-90"
            style={{
              backgroundColor: outline ? 'transparent' : 'var(--theme-colors-primary)',
              color: outline ? 'var(--theme-colors-primary)' : 'var(--theme-colors-primaryContrast, #fff)',
              border: outline ? '1.5px solid var(--theme-colors-primary)' : 'none',
              borderRadius: 'var(--theme-radius-md)',
              fontWeight: 'var(--theme-weight-bold)',
            }}
          >
            {block.button_label}
          </Link>
        </div>
      );
    }
    case 'divider':
      return (
        <hr
          style={{
            border: 'none',
            borderTop: `1px solid ${colorOr(block.color, 'var(--theme-colors-border)')}`,
            margin: 0,
          }}
        />
      );
    case 'spacer':
      return <div style={{ height: `${numberOr(block.height_px, 24)}px` }} aria-hidden />;
    case 'html':
      return (
        <div
          className={alignClass}
          dangerouslySetInnerHTML={{ __html: block.raw_html || '' }}
        />
      );
    default:
      return null;
  }
}

// ── Section ─────────────────────────────────────────────────────

function LayoutColumns({ settings, content, locale }: SectionRenderProps) {
  const cells = ((content.cells as Cell[]) || []).filter((c) => (c.blocks?.length ?? 0) > 0);

  const mode = (settings.mode as Mode) || 'grid';
  const gapPx = numberOr(settings.gap_px, 24);
  const align = (settings.align as Align) || 'stretch';
  const justify = (settings.justify as Justify) || 'start';

  // Grid columns per breakpoint.
  const colsDesktop = clamp(numberOr(settings.columns, 2), 1, 6);
  const colsTablet = clamp(numberOr(settings.columns_tablet, Math.min(colsDesktop, 2)), 1, 6);
  const colsMobile = clamp(numberOr(settings.columns_mobile, 1), 1, 4);

  // Flex options.
  const direction = (settings.direction as FlexDir) || 'row';
  const wrap = settings.wrap !== false;

  const scopeClass = `lc-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  if (cells.length === 0) {
    return (
      <section
        className="text-center py-10 px-4"
        style={{
          border: '1px dashed var(--theme-colors-border)',
          borderRadius: 'var(--theme-radius-md)',
          color: 'var(--theme-colors-muted)',
        }}
      >
        <p className="text-sm">
          {locale === 'ar'
            ? 'لا توجد أعمدة بعد. أضف عموداً وبلوكات من البيلدر.'
            : 'No columns yet. Add a column and blocks from the builder.'}
        </p>
      </section>
    );
  }

  const cellNodes = cells.map((cell, i) => {
    const blocks = (cell.blocks || []).filter((b) => b.type);
    const cellAlignClass = cell.align ? ITEMS_ALIGN[cell.align] : '';
    // Grid cells can span multiple columns; flex cells grow by span as a ratio.
    const span = clamp(numberOr(cell.col_span, 1), 1, 6);
    const cellStyle: React.CSSProperties =
      mode === 'grid'
        ? { gridColumn: `span ${span} / span ${span}` }
        : { flex: `${span} 1 0%`, minWidth: 0 };
    return (
      <div
        key={i}
        className={`flex flex-col gap-3 ${cellAlignClass}`}
        style={cellStyle}
      >
        {blocks.map((b, j) => (
          <BlockView key={j} block={b} />
        ))}
      </div>
    );
  });

  const containerClass =
    mode === 'grid'
      ? `grid ${scopeClass} ${ITEMS_ALIGN[align]} ${JUSTIFY_CLASS[justify]}`
      : `flex ${direction === 'column' ? 'flex-col' : 'flex-row'} ${wrap ? 'flex-wrap' : ''} ${ITEMS_ALIGN[align]} ${JUSTIFY_CLASS[justify]}`;

  return (
    <section className="py-8">
      {mode === 'grid' && (
        // Per-breakpoint grid columns — inline styles can't carry media queries.
        <style
          dangerouslySetInnerHTML={{
            __html: `
.${scopeClass} { grid-template-columns: repeat(${colsDesktop}, minmax(0, 1fr)); }
@media (max-width: 1023px) { .${scopeClass} { grid-template-columns: repeat(${colsTablet}, minmax(0, 1fr)); } }
@media (max-width: 767px) { .${scopeClass} { grid-template-columns: repeat(${colsMobile}, minmax(0, 1fr)); } }
            `.trim(),
          }}
        />
      )}
      <div className={containerClass} style={{ gap: `${gapPx}px` }}>
        {cellNodes}
      </div>
    </section>
  );
}

// ── Schema ──────────────────────────────────────────────────────

const ALIGN_OPTIONS = [
  { value: 'start', label: { en: 'Start', ar: 'البداية' } },
  { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
  { value: 'end', label: { en: 'End', ar: 'النهاية' } },
];

const BLOCK_FIELDS = [
  {
    key: 'type',
    type: 'select' as const,
    label: { en: 'Block type', ar: 'نوع البلوك' },
    defaultValue: 'text',
    options: [
      { value: 'heading', label: { en: 'Heading', ar: 'عنوان' } },
      { value: 'text', label: { en: 'Text', ar: 'نص' } },
      { value: 'image', label: { en: 'Image', ar: 'صورة' } },
      { value: 'button', label: { en: 'Button', ar: 'زر' } },
      { value: 'divider', label: { en: 'Divider', ar: 'فاصل' } },
      { value: 'spacer', label: { en: 'Spacer', ar: 'مسافة' } },
      { value: 'html', label: { en: 'Custom HTML', ar: 'HTML مخصّص' } },
    ],
  },
  // heading
  { key: 'text', type: 'text' as const, label: { en: 'Heading text', ar: 'نص العنوان' }, showIf: { key: 'type', in: ['heading'] } },
  {
    key: 'level',
    type: 'select' as const,
    label: { en: 'Heading level', ar: 'مستوى العنوان' },
    defaultValue: 'h2',
    options: [
      { value: 'h2', label: { en: 'H2', ar: 'H2' } },
      { value: 'h3', label: { en: 'H3', ar: 'H3' } },
      { value: 'h4', label: { en: 'H4', ar: 'H4' } },
    ],
    showIf: { key: 'type', in: ['heading'] },
  },
  // text
  { key: 'html', type: 'richtext' as const, label: { en: 'Text', ar: 'النص' }, showIf: { key: 'type', in: ['text'] } },
  // image
  { key: 'image', type: 'image' as const, label: { en: 'Image', ar: 'الصورة' }, showIf: { key: 'type', in: ['image'] } },
  { key: 'alt', type: 'text' as const, label: { en: 'Alt text', ar: 'نص بديل' }, showIf: { key: 'type', in: ['image'] } },
  {
    key: 'aspect',
    type: 'select' as const,
    label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
    defaultValue: 'auto',
    options: [
      { value: 'auto', label: { en: 'Original', ar: 'الأصلي' } },
      { value: 'square', label: { en: 'Square', ar: 'مربع' } },
      { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
      { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
      { value: 'wide', label: { en: 'Wide 16:9', ar: 'عريض 16:9' } },
    ],
    showIf: { key: 'type', in: ['image'] },
  },
  { key: 'rounded', type: 'boolean' as const, label: { en: 'Rounded corners', ar: 'حواف دائرية' }, defaultValue: true, showIf: { key: 'type', in: ['image'] } },
  // button
  { key: 'button_label', type: 'text' as const, label: { en: 'Button label', ar: 'نص الزر' }, showIf: { key: 'type', in: ['button'] } },
  { key: 'button_url', type: 'url' as const, label: { en: 'Button URL', ar: 'رابط الزر' }, showIf: { key: 'type', in: ['button'] } },
  {
    key: 'button_variant',
    type: 'select' as const,
    label: { en: 'Button style', ar: 'نمط الزر' },
    defaultValue: 'solid',
    options: [
      { value: 'solid', label: { en: 'Solid', ar: 'صلب' } },
      { value: 'outline', label: { en: 'Outline', ar: 'إطار' } },
    ],
    showIf: { key: 'type', in: ['button'] },
  },
  // spacer
  { key: 'height_px', type: 'number' as const, label: { en: 'Height (px)', ar: 'الارتفاع (px)' }, min: 4, max: 200, defaultValue: 24, showIf: { key: 'type', in: ['spacer'] } },
  // html
  { key: 'raw_html', type: 'textarea' as const, label: { en: 'HTML', ar: 'HTML' }, showIf: { key: 'type', in: ['html'] } },
  // shared
  { key: 'align', type: 'select' as const, label: { en: 'Align', ar: 'المحاذاة' }, defaultValue: 'start', options: ALIGN_OPTIONS, showIf: { key: 'type', in: ['heading', 'text', 'button', 'html'] } },
  { key: 'color', type: 'color' as const, label: { en: 'Color', ar: 'اللون' }, showIf: { key: 'type', in: ['heading', 'text', 'divider'] } },
];

export const layoutColumnsSection: SectionDefinition = {
  schema: {
    id: 'layout-columns',
    label: { en: 'Columns / Layout', ar: 'أعمدة / تخطيط' },
    icon: 'layout',
    category: 'layout',
    description: {
      en: 'Divide the page into a responsive grid or flex row of columns. Each column holds inline content blocks: heading, text, image, button, divider, spacer, or custom HTML.',
      ar: 'قسّم الصفحة إلى شبكة متجاوبة أو صف flex من الأعمدة. كل عمود يحتوي بلوكات: عنوان، نص، صورة، زر، فاصل، مسافة، أو HTML مخصّص.',
    },
    translatable: ['cells'],
    schema: [
      {
        key: 'mode',
        type: 'select',
        label: { en: 'Mode', ar: 'الوضع' },
        defaultValue: 'grid',
        options: [
          { value: 'grid', label: { en: 'Grid (equal columns)', ar: 'شبكة (أعمدة متساوية)' } },
          { value: 'flex', label: { en: 'Flex (flexible widths)', ar: 'مرن (عرض متغيّر)' } },
        ],
      },
      // Grid columns per device.
      { key: 'columns', type: 'number', label: { en: 'Columns — desktop', ar: 'الأعمدة — سطح المكتب' }, min: 1, max: 6, defaultValue: 2 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns — tablet', ar: 'الأعمدة — تابلت' }, min: 1, max: 6, defaultValue: 2 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns — mobile', ar: 'الأعمدة — جوال' }, min: 1, max: 4, defaultValue: 1 },
      // Flex options.
      {
        key: 'direction',
        type: 'select',
        label: { en: 'Flex direction', ar: 'اتجاه flex' },
        defaultValue: 'row',
        options: [
          { value: 'row', label: { en: 'Row', ar: 'صف' } },
          { value: 'column', label: { en: 'Column', ar: 'عمود' } },
        ],
      },
      { key: 'wrap', type: 'boolean', label: { en: 'Wrap (flex)', ar: 'التفاف (flex)' }, defaultValue: true },
      // Shared.
      { key: 'gap_px', type: 'number', label: { en: 'Gap (px)', ar: 'الفجوة (px)' }, min: 0, max: 80, defaultValue: 24 },
      {
        key: 'align',
        type: 'select',
        label: { en: 'Vertical align', ar: 'المحاذاة العمودية' },
        defaultValue: 'stretch',
        options: [
          { value: 'start', label: { en: 'Top', ar: 'أعلى' } },
          { value: 'center', label: { en: 'Center', ar: 'وسط' } },
          { value: 'end', label: { en: 'Bottom', ar: 'أسفل' } },
          { value: 'stretch', label: { en: 'Stretch', ar: 'تمدّد' } },
        ],
      },
      {
        key: 'justify',
        type: 'select',
        label: { en: 'Horizontal distribution', ar: 'التوزيع الأفقي' },
        defaultValue: 'start',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
          { value: 'between', label: { en: 'Space between', ar: 'موزّع' } },
          { value: 'around', label: { en: 'Space around', ar: 'محيطي' } },
        ],
      },
      {
        key: 'cells',
        type: 'repeater',
        label: { en: 'Columns', ar: 'الأعمدة' },
        fields: [
          { key: 'col_span', type: 'number', label: { en: 'Column span / flex ratio', ar: 'امتداد العمود / نسبة flex' }, min: 1, max: 6, defaultValue: 1 },
          {
            key: 'align',
            type: 'select',
            label: { en: 'Block alignment', ar: 'محاذاة البلوكات' },
            defaultValue: 'stretch',
            options: [
              { value: 'start', label: { en: 'Start', ar: 'البداية' } },
              { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
              { value: 'end', label: { en: 'End', ar: 'النهاية' } },
              { value: 'stretch', label: { en: 'Stretch', ar: 'تمدّد' } },
            ],
          },
          {
            key: 'blocks',
            type: 'repeater',
            label: { en: 'Content blocks', ar: 'بلوكات المحتوى' },
            fields: BLOCK_FIELDS,
          },
        ],
      },
    ],
  },
  Component: LayoutColumns,
  defaultSettings: {
    mode: 'grid',
    columns: 2,
    columns_tablet: 2,
    columns_mobile: 1,
    direction: 'row',
    wrap: true,
    gap_px: 24,
    align: 'stretch',
    justify: 'start',
  },
  defaultContent: {
    cells: [
      {
        col_span: 1,
        align: 'stretch',
        blocks: [
          { type: 'heading', text: 'Column one', level: 'h3', align: 'start' },
          { type: 'text', html: '<p>Describe something here. This block supports rich text.</p>', align: 'start' },
          { type: 'button', button_label: 'Learn more', button_url: '#', button_variant: 'solid', align: 'start' },
        ],
      },
      {
        col_span: 1,
        align: 'stretch',
        blocks: [
          { type: 'heading', text: 'Column two', level: 'h3', align: 'start' },
          { type: 'text', html: '<p>Another column of content sitting side by side.</p>', align: 'start' },
        ],
      },
    ],
  },
};
