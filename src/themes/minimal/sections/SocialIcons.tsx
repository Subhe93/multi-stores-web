// Social Icons — a row/column/grid of brand icons that link to the store's
// profiles. Server-only: every interaction (hover, focus) is pure CSS so no
// client boundary is needed.

import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr, numberOr } from '../../elementStyles';
import {
  PLATFORMS,
  PLATFORM_ORDER,
  SocialIconSvg,
  brandColor,
  resolveSocialHref,
  type SocialPlatform,
} from './_shared/socialIcons';

type Layout = 'horizontal' | 'vertical' | 'grid';
type Alignment = 'start' | 'center' | 'end';
type IconStyle = 'solid' | 'outline' | 'plain';
type IconShape = 'circle' | 'rounded' | 'square';
type ColorMode = 'brand' | 'theme-primary' | 'theme-accent' | 'theme-text' | 'custom';
type LabelMode = 'never' | 'hover' | 'always';
type HoverEffect = 'none' | 'scale' | 'lift' | 'invert';

interface SocialItem {
  platform?: SocialPlatform;
  url?: string;
  label?: string;
}

const SIZE_PX: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 56,
  xl: 72,
};

const ICON_SCALE: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
};

function HEADING_FROM(content: Record<string, unknown>) {
  return {
    heading: (content.heading as string) || '',
    subheading: (content.subheading as string) || '',
  };
}

function SocialIcons({ settings, content, locale }: SectionRenderProps) {
  const { heading, subheading } = HEADING_FROM(content);
  const items = ((content.items as SocialItem[]) || []).filter(
    (i): i is SocialItem & { platform: SocialPlatform } =>
      !!i?.platform && !!PLATFORMS[i.platform as SocialPlatform],
  );

  const layout = (settings.layout as Layout) || 'horizontal';
  const alignment = (settings.alignment as Alignment) || 'center';
  const iconStyle = (settings.icon_style as IconStyle) || 'solid';
  const iconShape = (settings.icon_shape as IconShape) || 'circle';
  const colorMode = (settings.color_mode as ColorMode) || 'brand';
  const labelMode = (settings.label_mode as LabelMode) || 'never';
  const hoverEffect = (settings.hover_effect as HoverEffect) || 'scale';
  const sizeKey = (settings.size as 'xs' | 'sm' | 'md' | 'lg' | 'xl') || 'md';
  const size = numberOr(settings.size_px, SIZE_PX[sizeKey] ?? SIZE_PX.md);
  const iconSize = Math.round(size * (ICON_SCALE[sizeKey] / SIZE_PX[sizeKey]));
  const gapPx = numberOr(settings.gap_px, 12);
  const customColor = colorOr(settings.custom_color, '#18181b');
  const customBg = colorOr(settings.custom_bg_color, '#18181b');
  const openInNewTab = settings.open_in_new_tab !== false;
  const nofollow = settings.nofollow === true;
  const headingColor = colorOr(settings.heading_color, 'var(--theme-colors-text)');
  const subheadingColor = colorOr(settings.subheading_color, 'var(--theme-colors-muted)');

  // Shape → border-radius. `square` is sharp corners, `rounded` is a 25%
  // value (Elementor's default), `circle` is a pill (any value >= 50% works).
  const shapeRadius =
    iconShape === 'circle' ? '9999px' : iconShape === 'rounded' ? `${Math.round(size * 0.22)}px` : '0';

  // Per-icon colour. Brand mode reads from the platform map; the other modes
  // produce a single colour applied to all icons in the row.
  function iconColor(platform: SocialPlatform): string {
    switch (colorMode) {
      case 'brand':
        return brandColor(platform);
      case 'theme-primary':
        return 'var(--theme-colors-primary)';
      case 'theme-accent':
        return 'var(--theme-colors-accent)';
      case 'theme-text':
        return 'var(--theme-colors-text)';
      case 'custom':
        return customColor;
      default:
        return brandColor(platform);
    }
  }

  // Background colour for `solid` icon style. Brand mode = platform colour;
  // theme modes match the icon colour for a tonal look; custom uses its own
  // setting so creators can pair (e.g. light icons on a dark chip).
  function iconBg(platform: SocialPlatform): string {
    if (iconStyle !== 'solid') return 'transparent';
    switch (colorMode) {
      case 'brand':
        return brandColor(platform);
      case 'theme-primary':
        return 'var(--theme-colors-primary)';
      case 'theme-accent':
        return 'var(--theme-colors-accent)';
      case 'theme-text':
        return 'var(--theme-colors-text)';
      case 'custom':
        return customBg;
      default:
        return brandColor(platform);
    }
  }

  // For solid icons the SVG sits on a coloured chip, so the path itself
  // needs the contrast colour (white). For outline/plain, the SVG carries
  // the brand/custom colour.
  function svgColor(platform: SocialPlatform): string {
    if (iconStyle === 'solid') return '#fff';
    return iconColor(platform);
  }

  function borderStyle(platform: SocialPlatform): string {
    if (iconStyle !== 'outline') return '0';
    return `2px solid ${iconColor(platform)}`;
  }

  // Hover transform — applied via inline class. None / scale / lift / invert.
  // `invert` flips the chip colours on hover (solid only); falls back to
  // scale for other styles.
  const hoverClass = (() => {
    if (hoverEffect === 'none') return '';
    if (hoverEffect === 'lift') return 'hover:-translate-y-0.5';
    if (hoverEffect === 'invert' && iconStyle === 'solid') return 'hover:opacity-80';
    return 'hover:scale-110';
  })();

  // Layout wrappers.
  const wrapperClass = (() => {
    const justify =
      alignment === 'start' ? 'justify-start' : alignment === 'end' ? 'justify-end' : 'justify-center';
    if (layout === 'vertical') return `flex flex-col items-${alignment === 'end' ? 'end' : alignment === 'start' ? 'start' : 'center'}`;
    if (layout === 'grid') return `grid grid-flow-row ${justify}`;
    return `flex flex-wrap ${justify} items-center`;
  })();

  const gridStyle =
    layout === 'grid' ? { gridTemplateColumns: `repeat(auto-fit, minmax(${size}px, max-content))` } : undefined;

  if (items.length === 0) {
    // Empty-state placeholder — the builder needs SOMETHING to click to open
    // the inspector when adding a brand-new SocialIcons section.
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
            ? 'لا توجد روابط اجتماعية بعد. أضف منصة من البيلدر.'
            : 'No social links yet. Add a platform from the builder.'}
        </p>
      </section>
    );
  }

  return (
    <section className="py-8">
      {(heading || subheading) && (
        <div
          className={`mb-6 ${alignment === 'start' ? 'text-start' : alignment === 'end' ? 'text-end' : 'text-center'} space-y-1.5`}
        >
          {heading && (
            <h2
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h3)',
                fontWeight: 'var(--theme-weight-heading)',
                lineHeight: 'var(--theme-line-heading)',
                color: headingColor,
              }}
            >
              {heading}
            </h2>
          )}
          {subheading && (
            <p className="text-sm" style={{ color: subheadingColor }}>
              {subheading}
            </p>
          )}
        </div>
      )}

      <ul
        className={wrapperClass}
        style={{ gap: `${gapPx}px`, listStyle: 'none', padding: 0, margin: 0, ...gridStyle }}
      >
        {items.map((item, i) => {
          const platform = item.platform;
          const href = resolveSocialHref(platform, item.url || '');
          const def = PLATFORMS[platform];
          const accessibleLabel = item.label || def.label[locale === 'ar' ? 'ar' : 'en'] || def.label.en;
          const showLabel = labelMode !== 'never';
          return (
            <li key={i}>
              <a
                href={href}
                target={openInNewTab ? '_blank' : undefined}
                rel={[openInNewTab ? 'noopener noreferrer' : '', nofollow ? 'nofollow' : ''].filter(Boolean).join(' ') || undefined}
                aria-label={accessibleLabel}
                title={accessibleLabel}
                className={`group inline-flex items-center gap-2 transition-all duration-200 ease-out ${hoverClass}`}
              >
                <span
                  className="inline-flex items-center justify-center transition-colors duration-200"
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: iconBg(platform),
                    color: svgColor(platform),
                    borderRadius: shapeRadius,
                    border: borderStyle(platform),
                  }}
                >
                  <SocialIconSvg
                    platform={platform}
                    title={accessibleLabel}
                    className="block"
                    // Inline width/height keep the SVG square inside the chip
                    // regardless of CSS resets in the host page.
                    width={iconSize}
                    height={iconSize}
                  />
                </span>
                {showLabel && (
                  <span
                    className={`text-sm font-medium whitespace-nowrap transition-opacity ${
                      labelMode === 'hover' ? 'opacity-0 group-hover:opacity-100' : ''
                    }`}
                    style={{ color: iconColor(platform) }}
                  >
                    {accessibleLabel}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Schema ─────────────────────────────────────────────────────────────

const PLATFORM_OPTIONS = PLATFORM_ORDER.map((p) => ({
  value: p,
  label: PLATFORMS[p].label,
}));

export const socialIconsSection: SectionDefinition = {
  schema: {
    id: 'social-icons',
    label: { en: 'Social Icons', ar: 'أيقونات التواصل الاجتماعي' },
    icon: 'share',
    category: 'social',
    description: {
      en: '18 platforms (Instagram, TikTok, X, …) with brand colours or your own palette. Horizontal, vertical, or grid layouts; circular / rounded / square chips; hover effects.',
      ar: '18 منصّة (إنستغرام، تيك توك، إكس، …) بألوان كل منصّة أو لوحة ألوانك. تخطيطات أفقي/عمودي/شبكة، أشكال دائرية/مدوّرة/مربعة، تأثيرات تمرير.',
    },
    // Available on every page type — explicitly include HEADER and FOOTER so
    // creators can drop a social row into the chrome (very common for stores).
    pageTypes: ['HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE', 'HEADER', 'FOOTER'],
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      // ── Content ────────────────────────────────────────────────
      { key: 'heading', type: 'text', label: { en: 'Heading (optional)', ar: 'العنوان (اختياري)' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading (optional)', ar: 'العنوان الفرعي (اختياري)' } },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Social links', ar: 'الروابط الاجتماعية' },
        fields: [
          {
            key: 'platform',
            type: 'select',
            label: { en: 'Platform', ar: 'المنصّة' },
            defaultValue: 'instagram',
            options: PLATFORM_OPTIONS,
          },
          { key: 'url', type: 'text', label: { en: 'URL or handle', ar: 'الرابط أو المُعرّف' } },
          { key: 'label', type: 'text', label: { en: 'Custom label (optional)', ar: 'تسمية مخصّصة (اختياري)' } },
        ],
      },
      // ── Layout ─────────────────────────────────────────────────
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'horizontal',
        options: [
          { value: 'horizontal', label: { en: 'Horizontal row', ar: 'صف أفقي' } },
          { value: 'vertical', label: { en: 'Vertical stack', ar: 'عمود عمودي' } },
          { value: 'grid', label: { en: 'Grid', ar: 'شبكة' } },
        ],
      },
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Alignment', ar: 'المحاذاة' },
        defaultValue: 'center',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
        ],
      },
      { key: 'gap_px', type: 'number', label: { en: 'Gap between icons (px)', ar: 'المسافة بين الأيقونات (px)' }, min: 0, max: 80, defaultValue: 12 },
      // ── Style ──────────────────────────────────────────────────
      {
        key: 'icon_style',
        type: 'select',
        label: { en: 'Icon style', ar: 'نمط الأيقونة' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid chip', ar: 'بطاقة ملوّنة' } },
          { value: 'outline', label: { en: 'Outline', ar: 'إطار' } },
          { value: 'plain', label: { en: 'Plain (no chip)', ar: 'بدون بطاقة' } },
        ],
      },
      {
        key: 'icon_shape',
        type: 'select',
        label: { en: 'Shape', ar: 'الشكل' },
        defaultValue: 'circle',
        options: [
          { value: 'circle', label: { en: 'Circle', ar: 'دائري' } },
          { value: 'rounded', label: { en: 'Rounded square', ar: 'مربع مدوّر' } },
          { value: 'square', label: { en: 'Square', ar: 'مربع' } },
        ],
      },
      {
        key: 'size',
        type: 'select',
        label: { en: 'Size preset', ar: 'الحجم' },
        defaultValue: 'md',
        options: [
          { value: 'xs', label: { en: 'XS (28px)', ar: 'صغير جداً (28px)' } },
          { value: 'sm', label: { en: 'Small (36px)', ar: 'صغير (36px)' } },
          { value: 'md', label: { en: 'Medium (44px)', ar: 'متوسط (44px)' } },
          { value: 'lg', label: { en: 'Large (56px)', ar: 'كبير (56px)' } },
          { value: 'xl', label: { en: 'XL (72px)', ar: 'كبير جداً (72px)' } },
        ],
      },
      { key: 'size_px', type: 'number', label: { en: 'Custom size (px, overrides preset)', ar: 'حجم مخصّص (px، يلغي الحجم المختار)' }, min: 16, max: 200 },
      // ── Colour ─────────────────────────────────────────────────
      {
        key: 'color_mode',
        type: 'select',
        label: { en: 'Color mode', ar: 'وضع الألوان' },
        defaultValue: 'brand',
        options: [
          { value: 'brand', label: { en: 'Brand colors (per platform)', ar: 'ألوان كل منصّة' } },
          { value: 'theme-primary', label: { en: 'Theme primary', ar: 'اللون الأساسي للثيم' } },
          { value: 'theme-accent', label: { en: 'Theme accent', ar: 'لون التمييز للثيم' } },
          { value: 'theme-text', label: { en: 'Theme text', ar: 'لون نص الثيم' } },
          { value: 'custom', label: { en: 'Custom', ar: 'مخصّص' } },
        ],
      },
      { key: 'custom_color', type: 'color', label: { en: 'Custom icon color', ar: 'لون الأيقونة المخصّص' } },
      { key: 'custom_bg_color', type: 'color', label: { en: 'Custom chip background (solid style)', ar: 'خلفية البطاقة المخصّصة (نمط مملوء)' } },
      // ── Behaviour ──────────────────────────────────────────────
      {
        key: 'label_mode',
        type: 'select',
        label: { en: 'Show platform name', ar: 'إظهار اسم المنصّة' },
        defaultValue: 'never',
        options: [
          { value: 'never', label: { en: 'Never', ar: 'أبداً' } },
          { value: 'hover', label: { en: 'On hover', ar: 'عند المرور' } },
          { value: 'always', label: { en: 'Always', ar: 'دائماً' } },
        ],
      },
      {
        key: 'hover_effect',
        type: 'select',
        label: { en: 'Hover effect', ar: 'تأثير التمرير' },
        defaultValue: 'scale',
        options: [
          { value: 'none', label: { en: 'None', ar: 'بدون' } },
          { value: 'scale', label: { en: 'Scale up', ar: 'تكبير' } },
          { value: 'lift', label: { en: 'Lift', ar: 'رفع' } },
          { value: 'invert', label: { en: 'Fade (solid only)', ar: 'تلاشٍ (للنمط المملوء فقط)' } },
        ],
      },
      { key: 'open_in_new_tab', type: 'boolean', label: { en: 'Open links in new tab', ar: 'فتح الروابط في نافذة جديدة' }, defaultValue: true },
      { key: 'nofollow', type: 'boolean', label: { en: 'Add rel="nofollow"', ar: 'إضافة rel="nofollow"' }, defaultValue: false },
      // ── Heading colors ────────────────────────────────────────
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
    ],
  },
  Component: SocialIcons,
  defaultSettings: {
    layout: 'horizontal',
    alignment: 'center',
    gap_px: 12,
    icon_style: 'solid',
    icon_shape: 'circle',
    size: 'md',
    color_mode: 'brand',
    label_mode: 'never',
    hover_effect: 'scale',
    open_in_new_tab: true,
    nofollow: false,
  },
  defaultContent: {
    items: [
      { platform: 'instagram', url: 'https://instagram.com/' },
      { platform: 'facebook', url: 'https://facebook.com/' },
      { platform: 'tiktok', url: 'https://tiktok.com/' },
      { platform: 'whatsapp', url: 'https://wa.me/' },
    ],
  },
};
