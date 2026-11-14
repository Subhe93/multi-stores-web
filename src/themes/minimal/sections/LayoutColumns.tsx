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
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc, responsiveImgProps } from '@/lib/storeMedia';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr, numberOr } from '../../elementStyles';
import { storeHref } from '@/lib/storeUrl';
import {
  PLATFORMS,
  PLATFORM_ORDER,
  SocialIconSvg,
  brandColor,
  resolveSocialHref,
  type SocialPlatform,
} from './_shared/socialIcons';
import { hasImageSize, type ImageSizeSettings } from '../../imageSizing';
import { SizedImage, sizedImageLayout, useImageSizeScope } from './_shared/SizedImage';

type Mode = 'grid' | 'flex';
type Align = 'start' | 'center' | 'end' | 'stretch';
type Justify = 'start' | 'center' | 'end' | 'between' | 'around';
type FlexDir = 'row' | 'column';

type BlockType =
  | 'heading'
  | 'text'
  | 'image'
  | 'images'
  | 'social'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'html';

interface RowImage {
  image?: string;
  alt?: string;
  link?: string;
}

interface SocialLink {
  platform?: SocialPlatform;
  url?: string;
}

interface Block {
  type?: BlockType;
  // heading
  text?: string;
  level?: 'h1' | 'h2' | 'h3' | 'h4';
  // 'label' = small uppercase column title (the theme footer's style).
  heading_style?: 'default' | 'label';
  // heading / image: optional link
  link?: string;
  // text
  html?: string;
  // heading / text / social: theme text colour or the softer muted one
  tone?: 'default' | 'muted';
  // image
  image?: string;
  alt?: string;
  aspect?: 'auto' | 'square' | 'landscape' | 'portrait' | 'wide';
  rounded?: boolean;
  // Legacy fixed width; ignored once `image_size` is set (form no longer shows it).
  width_px?: number;
  // Per-breakpoint sizing (../../imageSizing.ts); wins over aspect / width_px.
  image_size?: ImageSizeSettings;
  // images (a row of small images, e.g. payment or partner logos)
  images?: RowImage[];
  item_height_px?: number;
  // social
  socials?: SocialLink[];
  icon_size_px?: number;
  icon_color?: 'theme' | 'brand';
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

/** Logical alignment of a block; accepts the builder's left/right too. */
function blockAlign(raw: string | undefined): 'start' | 'center' | 'end' {
  if (raw === 'left') return 'start';
  if (raw === 'right') return 'end';
  return raw === 'center' || raw === 'end' ? raw : 'start';
}

/** Theme colour for a block's tone (text by default, muted on request). */
function toneColor(tone: Block['tone']): string {
  return tone === 'muted' ? 'var(--theme-colors-muted)' : 'var(--theme-colors-text)';
}

/** A block's link: external URLs open in a new tab, store URLs stay in place. */
function BlockLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const target = storeHref(href);
  const external = /^https?:\/\//i.test(target);
  return (
    <a
      href={target}
      className={className}
      style={style}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

// ── Block renderer ──────────────────────────────────────────────

// The same slots as the legacy block's '(min-width: 768px) 50vw, 100vw'.
const IMAGE_CONTAINER = { desktop: '50vw', mobile: '100vw' } as const;

/** Image block with `image_size` (plans/image-sizing/SPEC.md). */
function SizedImageBlock({ block }: { block: Block }) {
  const scope = useImageSizeScope();
  const layout = sizedImageLayout(block.image_size as ImageSizeSettings, scope, IMAGE_CONTAINER);
  const src = resolveMediaUrl(block.image || '');
  const frameStyle: React.CSSProperties | undefined = block.rounded
    ? { borderRadius: 'var(--theme-radius-md)', overflow: 'hidden' }
    : undefined;
  let link: { href: string; target?: string; rel?: string } | undefined;
  if (block.link) {
    const href = storeHref(block.link);
    link = /^https?:\/\//i.test(href) ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href };
  }
  return <SizedImage layout={layout} src={src} alt={block.alt || ''} frameStyle={frameStyle} link={link} />;
}

function BlockView({ block }: { block: Block }) {
  const type = block.type || 'text';
  // The builder's shared alignment select stores left/right; blocks use
  // logical start/end.
  const align = blockAlign(block.align as string | undefined);
  const alignClass = TEXT_ALIGN[align];

  switch (type) {
    case 'heading': {
      const Tag = block.level || 'h2';
      const isLabel = block.heading_style === 'label';
      const sizeVar =
        Tag === 'h1'
          ? 'var(--theme-scale-h1)'
          : Tag === 'h2'
            ? 'var(--theme-scale-h2)'
            : Tag === 'h3'
              ? 'var(--theme-scale-h3)'
              : 'var(--theme-scale-h4)';
      const label = block.text || '';
      return (
        <Tag
          // 'label': the small uppercase column title of the theme footer.
          className={`${alignClass} ${isLabel ? 'text-sm font-semibold uppercase tracking-wider' : ''}`}
          style={
            isLabel
              ? { color: colorOr(block.color, toneColor(block.tone)) }
              : {
                  fontFamily: 'var(--theme-font-heading)',
                  fontSize: sizeVar,
                  fontWeight: 'var(--theme-weight-heading)',
                  lineHeight: 'var(--theme-line-heading)',
                  color: colorOr(block.color, toneColor(block.tone)),
                }
          }
        >
          {block.link ? (
            <BlockLink href={block.link} className="hover:opacity-70 transition-opacity" style={{ color: 'inherit' }}>
              {label}
            </BlockLink>
          ) : (
            label
          )}
        </Tag>
      );
    }
    case 'text':
      return (
        <div
          // Muted text (e.g. footer columns): links follow the text colour
          // instead of the editor's blue/underline link class.
          // Default tone: links underlined in the text colour (rich text
          // carries no link styling of its own).
          className={`max-w-prose ${alignClass} prose-sm ${
            block.tone === 'muted'
              ? '[&_a]:text-inherit! [&_a]:no-underline! [&_a:hover]:opacity-70'
              : '[&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:opacity-80'
          }`}
          style={{
            color: colorOr(block.color, toneColor(block.tone)),
            lineHeight: 'var(--theme-line-body)',
          }}
          // Rich text is creator-authored via the dashboard editor.
          dangerouslySetInnerHTML={{ __html: block.html || '' }}
        />
      );
    case 'image': {
      if (!block.image) return null;
      // `image_size` set: the sized renderer. Without it the legacy markup
      // below stays byte-identical (saved sections, live stores).
      if (hasImageSize(block.image_size)) return <SizedImageBlock block={block} />;
      const aspect = block.aspect || 'auto';
      const src = resolveMediaUrl(block.image);
      const radius = block.rounded ? { borderRadius: 'var(--theme-radius-md)' } : undefined;
      // Optional fixed width (e.g. a logo); otherwise the column width.
      const widthPx = typeof block.width_px === 'number' && block.width_px > 0 ? block.width_px : null;
      const box: React.CSSProperties | undefined = widthPx ? { width: widthPx, maxWidth: '100%' } : undefined;
      // 'auto' keeps the natural ratio, which next/image cannot size without
      // known dimensions, so it stays a plain <img> with an optimized srcset.
      const img =
        aspect === 'auto' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            {...responsiveImgProps(src, widthPx ? `${widthPx}px` : '(min-width: 768px) 50vw, 100vw')}
            alt={block.alt || ''}
            decoding="async"
            loading="lazy"
            className={widthPx ? 'block h-auto object-cover' : 'w-full object-cover'}
            style={{ ...radius, ...box }}
          />
        ) : (
          <div className={`relative w-full overflow-hidden ${ASPECT_CLASS[aspect]}`} style={{ ...radius, ...box }}>
            <StoreImage
              src={src}
              alt={block.alt || ''}
              fill
              sizes={widthPx ? `${widthPx}px` : '(min-width: 768px) 50vw, 100vw'}
              unoptimized={isSvgSrc(src)}
              className="object-cover"
            />
          </div>
        );
      return block.link ? (
        <BlockLink href={block.link} className={widthPx ? 'block' : 'block w-full'} style={box}>
          {img}
        </BlockLink>
      ) : (
        img
      );
    }
    case 'images': {
      const items = (block.images || []).filter((i) => i?.image);
      if (items.length === 0) return null;
      const h = Math.max(16, Math.min(200, numberOr(block.item_height_px, 40)));
      const justifyClass =
        align === 'center' ? 'justify-center' : align === 'end' ? 'justify-end' : 'justify-start';
      return (
        <div className={`flex flex-wrap items-center gap-2 ${justifyClass}`}>
          {items.map((item, i) => {
            const src = resolveMediaUrl(item.image || '');
            const img = (
              // Natural width at a fixed height: logos keep their proportions.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={item.alt || ''}
                height={h}
                decoding="async"
                loading="lazy"
                className="block w-auto object-contain"
                style={{ height: h }}
              />
            );
            return item.link ? (
              <BlockLink key={i} href={item.link} className="inline-block hover:opacity-80 transition-opacity">
                {img}
              </BlockLink>
            ) : (
              <span key={i} className="inline-block">
                {img}
              </span>
            );
          })}
        </div>
      );
    }
    case 'social': {
      const links = (block.socials || [])
        .filter((s): s is SocialLink & { platform: SocialPlatform } => !!s?.platform && Object.hasOwn(PLATFORMS, s.platform))
        .map((s) => ({ platform: s.platform, href: resolveSocialHref(s.platform, s.url || '') }))
        .filter((s) => s.href !== '#');
      if (links.length === 0) return null;
      const size = Math.max(12, Math.min(48, numberOr(block.icon_size_px, 20)));
      const justifyClass =
        align === 'center' ? 'justify-center' : align === 'end' ? 'justify-end' : 'justify-start';
      return (
        <div className={`flex flex-wrap items-center gap-3.5 ${justifyClass}`}>
          {links.map((s, i) => {
            const label = PLATFORMS[s.platform].label.en;
            const external = /^https?:/i.test(s.href);
            return (
              <a
                key={i}
                href={s.href}
                aria-label={label}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="inline-flex hover:opacity-70 transition-opacity"
                style={{
                  color:
                    block.icon_color === 'brand'
                      ? brandColor(s.platform)
                      : colorOr(block.color, toneColor(block.tone)),
                }}
              >
                <SocialIconSvg platform={s.platform} width={size} height={size} />
              </a>
            );
          })}
        </div>
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
      { value: 'images', label: { en: 'Image row (logos)', ar: 'صف صور (شعارات)' } },
      { value: 'social', label: { en: 'Social icons', ar: 'أيقونات التواصل' } },
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
      { value: 'h1', label: { en: 'H1 (page title)', ar: 'H1 (عنوان الصفحة)' } },
      { value: 'h2', label: { en: 'H2', ar: 'H2' } },
      { value: 'h3', label: { en: 'H3', ar: 'H3' } },
      { value: 'h4', label: { en: 'H4', ar: 'H4' } },
    ],
    showIf: { key: 'type', in: ['heading'] },
  },
  {
    key: 'heading_style',
    type: 'select' as const,
    label: { en: 'Heading style', ar: 'شكل العنوان' },
    defaultValue: 'default',
    options: [
      { value: 'default', label: { en: 'Theme heading', ar: 'عنوان الثيم' } },
      { value: 'label', label: { en: 'Small uppercase label (footer column title)', ar: 'تسمية صغيرة بأحرف كبيرة (عنوان عمود الفوتر)' } },
    ],
    showIf: { key: 'type', in: ['heading'] },
  },
  { key: 'link', type: 'url' as const, label: { en: 'Link (optional)', ar: 'رابط (اختياري)' }, showIf: { key: 'type', in: ['heading', 'image'] } },
  // text
  { key: 'html', type: 'richtext' as const, label: { en: 'Text', ar: 'النص' }, showIf: { key: 'type', in: ['text'] } },
  // image
  { key: 'image', type: 'image' as const, label: { en: 'Image', ar: 'الصورة' }, showIf: { key: 'type', in: ['image'] } },
  { key: 'alt', type: 'text' as const, label: { en: 'Alt text', ar: 'نص بديل' }, showIf: { key: 'type', in: ['image'] } },
  // Width / height / ratio / alignment per breakpoint. Replaces the legacy
  // `width_px` field; stored width_px / aspect still render via the legacy
  // path while `image_size` is empty.
  { key: 'image_size', type: 'imageSize' as const, label: { en: 'Image size', ar: 'حجم الصورة' }, showIf: { key: 'type', in: ['image'] } },
  // images (row of logos)
  {
    key: 'images',
    type: 'repeater' as const,
    label: { en: 'Images', ar: 'الصور' },
    fields: [
      { key: 'image', type: 'image' as const, label: { en: 'Image', ar: 'الصورة' } },
      { key: 'alt', type: 'text' as const, label: { en: 'Alt text', ar: 'نص بديل' } },
      { key: 'link', type: 'url' as const, label: { en: 'Link (optional)', ar: 'رابط (اختياري)' } },
    ],
    showIf: { key: 'type', in: ['images'] },
  },
  { key: 'item_height_px', type: 'number' as const, label: { en: 'Image height (px)', ar: 'ارتفاع الصورة (px)' }, min: 16, max: 200, defaultValue: 40, showIf: { key: 'type', in: ['images'] } },
  // social
  {
    key: 'socials',
    type: 'repeater' as const,
    label: { en: 'Social links', ar: 'روابط التواصل' },
    fields: [
      {
        key: 'platform',
        type: 'select' as const,
        label: { en: 'Platform', ar: 'المنصّة' },
        defaultValue: 'instagram',
        options: PLATFORM_ORDER.map((p) => ({ value: p, label: PLATFORMS[p].label })),
      },
      { key: 'url', type: 'text' as const, label: { en: 'URL or handle', ar: 'الرابط أو المُعرّف' } },
    ],
    showIf: { key: 'type', in: ['social'] },
  },
  { key: 'icon_size_px', type: 'number' as const, label: { en: 'Icon size (px)', ar: 'حجم الأيقونة (px)' }, min: 12, max: 48, defaultValue: 20, showIf: { key: 'type', in: ['social'] } },
  {
    key: 'icon_color',
    type: 'select' as const,
    label: { en: 'Icon colour', ar: 'لون الأيقونات' },
    defaultValue: 'theme',
    options: [
      { value: 'theme', label: { en: 'Theme (tone / colour below)', ar: 'الثيم (النبرة / اللون أدناه)' } },
      { value: 'brand', label: { en: 'Brand colours', ar: 'ألوان المنصّات' } },
    ],
    showIf: { key: 'type', in: ['social'] },
  },
  // (The legacy block `aspect` select moved into `image_size` above.)
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
  { key: 'align', type: 'select' as const, label: { en: 'Align', ar: 'المحاذاة' }, defaultValue: 'start', options: ALIGN_OPTIONS, showIf: { key: 'type', in: ['heading', 'text', 'button', 'html', 'images', 'social'] } },
  {
    key: 'tone',
    type: 'select' as const,
    label: { en: 'Text tone', ar: 'درجة النص' },
    defaultValue: 'default',
    options: [
      { value: 'default', label: { en: 'Theme text', ar: 'نص الثيم' } },
      { value: 'muted', label: { en: 'Muted (softer)', ar: 'خافت (أهدأ)' } },
    ],
    showIf: { key: 'type', in: ['heading', 'text', 'social'] },
  },
  { key: 'color', type: 'color' as const, label: { en: 'Color', ar: 'اللون' }, showIf: { key: 'type', in: ['heading', 'text', 'divider', 'social'] } },
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
