// ProgressSpotlight: one goal with its status and a bar computed from two
// numbers the owner enters, beside an image (split) or as a compact panel
// (card). Reusable for a fundraising goal, a pre-order target, a production
// run. There is no typed percentage: see ./_shared/progress.ts.

import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import { TRUST_BADGE_ICONS, TRUST_BADGE_ICON_OPTIONS } from '@/lib/trustBadgeIcons';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { buttonStyles, colorOr } from '../../elementStyles';
import { Heading } from './_shared/Heading';
import { headingTag, textTag } from './_shared/headingLevel';
import { BleedMediaPlaceholder, BleedSplit, focusPosition } from './_shared/BleedSplit';
import { ctaDefaults, ctaToneValue } from './_shared/cta';
import { FOCUS_RING, sectionHref } from './_shared/links';
import { computeProgress, statusValue } from './_shared/progress';
import { ProgressBar } from './_shared/ProgressBar';
import { StatusBadge } from './_shared/StatusBadge';
import { toneColors, toneValue } from './_shared/tone';

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Locale-aware number formatters; an unknown locale tag falls back to English. */
function formatters(locale: string) {
  try {
    return {
      number: new Intl.NumberFormat(locale),
      percent: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
    };
  } catch {
    return {
      number: new Intl.NumberFormat('en'),
      percent: new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 0 }),
    };
  }
}

function ProgressSpotlight({ settings, content, locale, primaryLocale, builderPreview }: SectionRenderProps) {
  // Non-async shared component: the hook works on the server and in the
  // client-rendered builder preview.
  const t = useTranslations('sections');
  const split = settings.layout !== 'card';
  const image = split ? str(settings.image) : '';
  const resolvedImage = image ? resolveMediaUrl(image) : '';
  const tone = toneValue(settings.tone, 'surface');
  const colors = toneColors(tone, settings.bg_color);

  const eyebrow = str(content.eyebrow);
  const heading = str(content.heading);
  const body = str(content.body);
  const itemTitle = str(content.item_title);
  const itemMeta = str(content.item_meta);
  const unitLabel = str(content.unit_label);
  const note = str(content.note);
  const ctaText = str(content.cta_text);

  const status = statusValue(settings.status, 'in_progress');
  const progress = computeProgress({
    goal: settings.goal,
    reached: settings.reached,
    status,
    show: settings.show_progress,
  });
  // The panel needs a name, a goal or a status to be worth showing.
  const hasPanel = !!itemTitle || progress.goal !== null || status !== 'none';

  // A status alone (its default is "in progress") is not content.
  if (!resolvedImage && !eyebrow && !heading && !body && !itemTitle && progress.goal === null && !ctaText) {
    // Nothing on the live store; a placeholder in the builder only.
    if (!builderPreview) return null;
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
          <p className="text-sm">{t('empty.progressSpotlight')}</p>
        </div>
      </section>
    );
  }

  const fmt = formatters(locale);
  const withUnit = (line: string) => (unitLabel ? `${line} ${unitLabel}` : line);
  // "60 of 100 completed": shown under the bar and read out as its value.
  const reachedLine =
    progress.goal !== null
      ? withUnit(
          t('progress.reachedOfGoal', {
            reached: fmt.number.format(progress.reached),
            goal: fmt.number.format(progress.goal),
          }),
        )
      : '';
  // A planned goal states the target only: no bar, no percent.
  const goalLine =
    status === 'planned' && progress.goal !== null
      ? withUnit(t('progress.goal', { goal: fmt.number.format(progress.goal) }))
      : '';
  const percent = progress.percent ?? 0;

  const Icon =
    typeof settings.icon === 'string' && Object.prototype.hasOwnProperty.call(TRUST_BADGE_ICONS, settings.icon)
      ? TRUST_BADGE_ICONS[settings.icon]
      : undefined;
  const ctaStyle = buttonStyles(
    {
      bg: settings.cta_bg_color,
      text: settings.cta_text_color,
      borderColor: settings.cta_border_color,
      borderWidth: settings.cta_border_width,
      borderRadius: settings.cta_border_radius,
    },
    ctaDefaults(ctaToneValue(settings.cta_tone), tone),
  );

  const inner: ReactNode = (
    <>
      <div className="flex flex-col gap-3">
        {eyebrow && (
          <Heading
            level={textTag(settings.eyebrow_tag, 'span')}
            original="span"
            look="body"
            className="text-xs font-semibold uppercase tracking-[0.2em] rtl:tracking-normal"
            style={{ color: colorOr(settings.eyebrow_color, colors.eyebrow) }}
          >
            {eyebrow}
          </Heading>
        )}
        {heading && (
          <Heading
            level={headingTag(settings.heading_level, 'h2')}
            style={{
              fontFamily: 'var(--theme-font-heading)',
              fontSize: 'var(--theme-scale-h2)',
              fontWeight: 'var(--theme-weight-heading)',
              lineHeight: 'var(--theme-line-heading)',
              letterSpacing: 'var(--theme-tracking-heading)',
              color: colorOr(settings.heading_color, colors.text),
            }}
          >
            {heading}
          </Heading>
        )}
        {body && (
          <p
            className="max-w-prose"
            style={{ color: colorOr(settings.body_color, colors.muted), lineHeight: 'var(--theme-line-body)' }}
          >
            {body}
          </p>
        )}
      </div>

      {hasPanel && (
        // The panel keeps the page colours, so it reads on every tone.
        <div
          className="mt-6 p-4 md:p-5"
          style={{
            background: 'var(--theme-colors-background)',
            color: 'var(--theme-colors-text)',
            border: '1px solid var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
          }}
          data-progress-panel=""
        >
          <div className="flex items-start gap-3">
            {Icon && <Icon className="size-8 shrink-0" strokeWidth={1.5} aria-hidden />}
            <div className="min-w-0 flex-1">
              {itemTitle && <p className="font-semibold leading-tight">{itemTitle}</p>}
              {itemMeta && (
                <p className="text-sm" style={{ color: 'var(--theme-colors-muted)' }}>
                  {itemMeta}
                </p>
              )}
            </div>
            <StatusBadge status={status} />
          </div>
          {progress.showBar && (
            <>
              <div className="mt-3 flex items-center gap-3" data-progress-bar="">
                <ProgressBar
                  percent={percent}
                  text={reachedLine}
                  label={itemTitle || t('progress.label')}
                  barColor={colorOr(settings.bar_color, 'var(--theme-colors-accent)')}
                />
                {settings.show_percent === true && (
                  <span className="text-sm font-semibold tabular-nums">{fmt.percent.format(percent / 100)}</span>
                )}
              </div>
            </>
          )}
          {progress.goal !== null && <p className="mt-2 text-sm">{goalLine || reachedLine}</p>}
          {note && (
            <p className="mt-1 text-xs" style={{ color: 'var(--theme-colors-muted)' }}>
              {note}
            </p>
          )}
        </div>
      )}

      {ctaText && (
        <div className="mt-6">
          <a
            href={sectionHref(settings.cta_url, locale, primaryLocale)}
            className={`inline-flex items-center gap-2 px-6 py-3 motion-safe:transition-opacity hover:opacity-90 ${FOCUS_RING}`}
            style={{ ...ctaStyle, fontWeight: 'var(--theme-weight-bold)', outlineColor: colors.text }}
          >
            {ctaText}
            {settings.cta_arrow === true && <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />}
          </a>
        </div>
      )}
    </>
  );

  if (!split) {
    return (
      <section className="py-10 md:py-14">
        <div
          className="mx-auto max-w-3xl p-6 md:p-10"
          style={{ backgroundColor: colors.bg, color: colors.text, borderRadius: 'var(--theme-radius-md)' }}
        >
          {inner}
        </div>
      </section>
    );
  }

  // Split without an image: one contained text column on the live store; in
  // the builder the image half stays as a box so the layout is visible.
  const media = resolvedImage ? (
    <StoreImage
      src={resolvedImage}
      alt={str(content.alt)}
      fill
      sizes="(min-width: 768px) 50vw, 100vw"
      unoptimized={isSvgSrc(resolvedImage)}
      className="object-cover"
      style={{ objectPosition: focusPosition(settings.image_focus) }}
    />
  ) : builderPreview ? (
    <BleedMediaPlaceholder />
  ) : null;

  return (
    <BleedSplit
      imageSide={settings.image_side === 'end' ? 'end' : 'start'}
      edge="hard"
      minHeightClass="md:min-h-[480px]"
      mobileAspectClass="aspect-[4/3]"
      bg={colors.bg}
      color={colors.text}
      blend={colors.blend}
      media={media}
    >
      {inner}
    </BleedSplit>
  );
}

// Fields of the split layout only.
const SPLIT_ONLY = { key: 'layout', in: ['', 'split'] };

export const progressSpotlightSection: SectionDefinition = {
  schema: {
    id: 'progress-spotlight',
    label: { en: 'Progress spotlight', ar: 'تسليط الضوء على التقدّم' },
    icon: 'target',
    category: 'content',
    description: {
      en: 'A goal with its status and a progress bar calculated from two numbers you enter.',
      ar: 'هدف مع حالته وشريط تقدّم يُحسب من رقمين تُدخلهما.',
    },
    translatable: ['eyebrow', 'heading', 'body', 'item_title', 'item_meta', 'unit_label', 'note', 'cta_text', 'alt'],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'split',
        options: [
          { value: 'split', label: { en: 'Image and text, edge to edge', ar: 'صورة ونص من الحافة إلى الحافة' } },
          { value: 'card', label: { en: 'Compact card', ar: 'بطاقة مدمجة' } },
        ],
      },
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' }, showIf: SPLIT_ONLY },
      {
        key: 'alt',
        type: 'text',
        label: { en: 'Image description (alt text)', ar: 'وصف الصورة (النص البديل)' },
        maxLength: 160,
        showIf: SPLIT_ONLY,
      },
      {
        key: 'image_side',
        type: 'select',
        label: { en: 'Image side', ar: 'جهة الصورة' },
        defaultValue: 'start',
        showIf: SPLIT_ONLY,
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
        ],
      },
      {
        key: 'image_focus',
        type: 'select',
        label: { en: 'Image focus', ar: 'نقطة تركيز الصورة' },
        defaultValue: 'center',
        showIf: SPLIT_ONLY,
        options: [
          { value: 'center', label: { en: 'Centre', ar: 'الوسط' } },
          { value: 'top', label: { en: 'Top', ar: 'الأعلى' } },
          { value: 'bottom', label: { en: 'Bottom', ar: 'الأسفل' } },
        ],
      },
      {
        key: 'tone',
        type: 'select',
        label: { en: 'Background', ar: 'الخلفية' },
        defaultValue: 'surface',
        options: [
          { value: 'none', label: { en: 'None', ar: 'بدون' } },
          { value: 'surface', label: { en: 'Surface', ar: 'لون السطح' } },
          { value: 'primary', label: { en: 'Primary colour', ar: 'اللون الأساسي' } },
          { value: 'accent', label: { en: 'Accent colour', ar: 'لون التمييز' } },
        ],
      },
      { key: 'bg_color', type: 'color', label: { en: 'Background colour', ar: 'لون الخلفية' } },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow (small label)', ar: 'تسمية صغيرة فوق العنوان' }, maxLength: 40 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'body', type: 'textarea', label: { en: 'Text', ar: 'النص' }, maxLength: 400 },
      { key: 'item_title', type: 'text', label: { en: 'Goal name', ar: 'اسم الهدف' }, maxLength: 120 },
      { key: 'item_meta', type: 'text', label: { en: 'Place or date', ar: 'المكان أو التاريخ' }, maxLength: 80 },
      {
        key: 'icon',
        type: 'select',
        label: { en: 'Icon', ar: 'الأيقونة' },
        defaultValue: 'none',
        options: [{ value: 'none', label: { en: 'None', ar: 'بدون' } }, ...TRUST_BADGE_ICON_OPTIONS],
      },
      {
        key: 'status',
        type: 'select',
        label: { en: 'Status', ar: 'الحالة' },
        defaultValue: 'in_progress',
        options: [
          { value: 'none', label: { en: 'None', ar: 'بدون' } },
          { value: 'planned', label: { en: 'Planned', ar: 'مخطَّط' } },
          { value: 'in_progress', label: { en: 'In progress', ar: 'قيد التنفيذ' } },
          { value: 'completed', label: { en: 'Completed', ar: 'مكتمل' } },
        ],
      },
      {
        key: 'goal',
        type: 'number',
        label: { en: 'Goal (number)', ar: 'الهدف (رقم)' },
        description: {
          en: 'The bar is calculated from the two numbers. Without a goal no bar is shown.',
          ar: 'يُحسب الشريط من الرقمين. بدون هدف لا يظهر الشريط.',
        },
        min: 0,
        defaultValue: 100,
      },
      {
        key: 'reached',
        type: 'number',
        label: { en: 'Reached so far (number)', ar: 'المُنجَز حتى الآن (رقم)' },
        description: {
          en: 'Enter only a figure you can back up.',
          ar: 'أدخل فقط رقماً تستطيع إثباته.',
        },
        min: 0,
        defaultValue: 0,
      },
      { key: 'unit_label', type: 'text', label: { en: 'Unit text after the numbers', ar: 'نص الوحدة بعد الأرقام' }, maxLength: 40 },
      { key: 'show_progress', type: 'boolean', label: { en: 'Show the progress bar', ar: 'إظهار شريط التقدّم' }, defaultValue: true },
      { key: 'show_percent', type: 'boolean', label: { en: 'Show the percentage', ar: 'إظهار النسبة المئوية' }, defaultValue: true },
      {
        key: 'note',
        type: 'text',
        label: { en: 'Note (source of the figures, a date)', ar: 'ملاحظة (مصدر الأرقام، تاريخ)' },
        maxLength: 160,
      },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      {
        key: 'cta_tone',
        type: 'select',
        label: { en: 'Button colour', ar: 'لون الزر' },
        defaultValue: 'primary',
        options: [
          { value: 'primary', label: { en: 'Primary colour', ar: 'اللون الأساسي' } },
          { value: 'accent', label: { en: 'Accent colour', ar: 'لون التمييز' } },
        ],
      },
      { key: 'cta_arrow', type: 'boolean', label: { en: 'Arrow on the button', ar: 'سهم على الزر' }, defaultValue: false },
      { key: 'eyebrow_color', type: 'color', label: { en: 'Eyebrow color', ar: 'لون التسمية الصغيرة' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'body_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'bar_color', type: 'color', label: { en: 'Progress bar color', ar: 'لون شريط التقدّم' } },
      { key: 'cta_bg_color', type: 'color', label: { en: 'Button background', ar: 'خلفية الزر' } },
      { key: 'cta_text_color', type: 'color', label: { en: 'Button text color', ar: 'لون نص الزر' } },
      { key: 'cta_border_color', type: 'color', label: { en: 'Button border color', ar: 'لون حدود الزر' } },
      { key: 'cta_border_width', type: 'number', label: { en: 'Button border width (px)', ar: 'سماكة حدود الزر (px)' }, min: 0, max: 8, defaultValue: 0 },
      { key: 'cta_border_radius', type: 'number', label: { en: 'Button corner radius (px)', ar: 'انحناء زوايا الزر (px)' }, min: 0, max: 100 },
    ],
  },
  Component: ProgressSpotlight,
  needsBuilderPreview: true,
  defaultSettings: {
    layout: 'split',
    image_side: 'start',
    image_focus: 'center',
    tone: 'surface',
    icon: 'none',
    status: 'in_progress',
    goal: 100,
    reached: 0,
    show_progress: true,
    show_percent: true,
    cta_tone: 'primary',
    cta_arrow: false,
  },
  defaultContent: {
    eyebrow: 'Our goal',
    heading: 'Follow our progress',
    body: 'Describe what you are working towards and why it matters. The bar is calculated from the two numbers you enter.',
    item_title: 'Name of the goal',
    item_meta: 'Where or when',
    unit_label: 'completed',
    cta_text: 'Learn more',
  },
};
