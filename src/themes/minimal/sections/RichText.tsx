import type { SectionDefinition, SectionRenderProps } from '../../types';
import { CONTENT_SOURCE_FIELDS, STATIC_CONTENT_SHOW_IF } from './_shared/dynamicSourceFields';
import { headingTag, textTag } from './_shared/headingLevel';
import { Heading } from './_shared/Heading';
import {
  DynamicSourceHint,
  PRODUCT_PROSE_CLASS,
  SpecsTable,
  dynamicContentSource,
  isDynamicPreview,
  resolveDynamicText,
  type DynamicContentSource,
} from './_shared/dynamicSource';

/**
 * Rich text whose body comes from the current product (settings
 * `content_source`). Same wrapper as the static rich text; only the body
 * differs. Eyebrow and heading stay static and translatable.
 */
function DynamicRichText({
  source,
  settings,
  content,
  product,
  locale,
  builderPreview,
}: SectionRenderProps & { source: DynamicContentSource }) {
  const preview = isDynamicPreview(builderPreview);
  const resolved = resolveDynamicText(source, product, settings, locale);
  const headingLevel = headingTag(settings.heading_level, 'h2');
  const eyebrowTag = textTag(settings.eyebrow_tag, 'p');
  const heading = (content.heading as string) || '';
  const eyebrow = (content.eyebrow as string) || '';
  // Live store with nothing to show: no empty box.
  if (!resolved && !preview && !heading && !eyebrow) return null;
  const width = (settings.width as 'narrow' | 'normal' | 'wide' | 'full') || 'normal';
  const alignment = (settings.alignment as 'left' | 'center') || 'left';
  const padding = (settings.padding as 'none' | 'small' | 'medium' | 'large') || 'medium';
  const surface = settings.surface === true;
  const widthClass =
    width === 'narrow' ? 'max-w-2xl' : width === 'wide' ? 'max-w-5xl' : width === 'full' ? 'max-w-none' : 'max-w-3xl';
  const padClass =
    padding === 'none' ? '' : padding === 'small' ? 'py-6' : padding === 'large' ? 'py-20' : 'py-12';

  let body = null;
  if (resolved?.kind === 'html') {
    // Product HTML is sanitized by the API on every write (sanitizeCreatorHtml)
    // and injected exactly as the product page's description tab does.
    body = (
      <div
        data-dynamic-source={source}
        className={PRODUCT_PROSE_CLASS}
        dangerouslySetInnerHTML={{ __html: resolved.html }}
      />
    );
  } else if (resolved?.kind === 'text') {
    body = (
      <div
        data-dynamic-source={source}
        className="prose prose-lg max-w-none"
        style={{ color: 'var(--theme-colors-text)' }}
      >
        <p className={resolved.swatch ? 'flex items-center gap-2' : undefined}>
          {resolved.swatch && (
            <span
              className="w-4 h-4 border border-gray-200 inline-block"
              style={{ backgroundColor: resolved.swatch, borderRadius: 'var(--theme-swatch-radius, 9999px)' }}
            />
          )}
          {resolved.text}
        </p>
      </div>
    );
  } else if (resolved?.kind === 'specs') {
    body = (
      <div data-dynamic-source={source} className={alignment === 'center' ? 'flex justify-center text-start' : undefined}>
        <SpecsTable rows={resolved.rows} />
      </div>
    );
  } else if (preview) {
    body = <DynamicSourceHint source={source} locale={locale} hasProduct={!!product} />;
  }

  return (
    <section className={padClass}>
      <div
        className={`${widthClass} mx-auto ${alignment === 'center' ? 'text-center' : ''} ${
          surface ? 'p-8' : ''
        }`}
        style={
          surface
            ? {
                backgroundColor: 'var(--theme-colors-surface)',
                border: '1px solid var(--theme-colors-border)',
                borderRadius: 'var(--theme-radius-md)',
              }
            : undefined
        }
      >
        {eyebrow && (
          <Heading level={eyebrowTag} look="body"
            className="text-xs font-semibold uppercase tracking-[0.2em] mb-3"
            style={{ color: 'var(--theme-colors-accent)' }}
          >
            {eyebrow}
          </Heading>
        )}
        {heading && (
          <Heading level={headingLevel}
            className="mb-5"
            style={{
              fontFamily: 'var(--theme-font-heading)',
              fontSize: 'var(--theme-scale-h2)',
              fontWeight: 'var(--theme-weight-heading)',
              lineHeight: 'var(--theme-line-heading)',
              color: 'var(--theme-colors-text)',
            }}
          >
            {heading}
          </Heading>
        )}
        {body}
      </div>
    </section>
  );
}

function RichText(props: SectionRenderProps) {
  // A missing / 'static' / unknown content_source keeps the original render.
  const source = dynamicContentSource(props.settings);
  if (source) return <DynamicRichText {...props} source={source} />;
  return <StaticRichText {...props} />;
}

function StaticRichText({ settings, content }: SectionRenderProps) {
  const headingLevel = headingTag(settings.heading_level, 'h2');
  const eyebrowTag = textTag(settings.eyebrow_tag, 'p');
  const html = (content.html as string) || '';
  const heading = (content.heading as string) || '';
  const eyebrow = (content.eyebrow as string) || '';
  const width = (settings.width as 'narrow' | 'normal' | 'wide' | 'full') || 'normal';
  const alignment = (settings.alignment as 'left' | 'center') || 'left';
  const padding = (settings.padding as 'none' | 'small' | 'medium' | 'large') || 'medium';
  const surface = settings.surface === true;

  // 'full' drops the cap: the text spans the page container like other
  // sections (the container supplies the side padding).
  const widthClass =
    width === 'narrow' ? 'max-w-2xl' : width === 'wide' ? 'max-w-5xl' : width === 'full' ? 'max-w-none' : 'max-w-3xl';
  const padClass =
    padding === 'none' ? '' : padding === 'small' ? 'py-6' : padding === 'large' ? 'py-20' : 'py-12';

  return (
    <section className={padClass}>
      <div
        className={`${widthClass} mx-auto ${alignment === 'center' ? 'text-center' : ''} ${
          surface ? 'p-8' : ''
        }`}
        style={
          surface
            ? {
                backgroundColor: 'var(--theme-colors-surface)',
                border: '1px solid var(--theme-colors-border)',
                borderRadius: 'var(--theme-radius-md)',
              }
            : undefined
        }
      >
        {eyebrow && (
          <Heading level={eyebrowTag} look="body"
            className="text-xs font-semibold uppercase tracking-[0.2em] mb-3"
            style={{ color: 'var(--theme-colors-accent)' }}
          >
            {eyebrow}
          </Heading>
        )}
        {heading && (
          <Heading level={headingLevel}
            className="mb-5"
            style={{
              fontFamily: 'var(--theme-font-heading)',
              fontSize: 'var(--theme-scale-h2)',
              fontWeight: 'var(--theme-weight-heading)',
              lineHeight: 'var(--theme-line-heading)',
              color: 'var(--theme-colors-text)',
            }}
          >
            {heading}
          </Heading>
        )}
        {html && (
          <div
            className="prose prose-lg max-w-none [&_a]:text-[var(--theme-colors-primary)] [&_strong]:text-[var(--theme-colors-text)]"
            style={{ color: 'var(--theme-colors-text)' }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </section>
  );
}

export const richTextSection: SectionDefinition = {
  schema: {
    id: 'rich-text',
    label: { en: 'Rich Text', ar: 'نص منسّق' },
    icon: 'text',
    category: 'content',
    description: {
      en: 'Long-form content with optional eyebrow, heading, and surface card style.',
      ar: 'محتوى مطوّل مع تسمية صغيرة وعنوان وخيار البطاقة الملوّنة.',
    },
    translatable: ['eyebrow', 'heading', 'html'],
    schema: [
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow (small label)', ar: 'تسمية صغيرة' } },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'html', type: 'richtext', label: { en: 'Content', ar: 'المحتوى' }, showIf: STATIC_CONTENT_SHOW_IF },
      ...CONTENT_SOURCE_FIELDS,
      {
        key: 'width',
        type: 'select',
        label: { en: 'Content width', ar: 'عرض المحتوى' },
        defaultValue: 'normal',
        options: [
          { value: 'narrow', label: { en: 'Narrow', ar: 'ضيّق' } },
          { value: 'normal', label: { en: 'Normal', ar: 'عادي' } },
          { value: 'wide', label: { en: 'Wide', ar: 'واسع' } },
          { value: 'full', label: { en: 'Full width', ar: 'كامل العرض' } },
        ],
      },
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Alignment', ar: 'المحاذاة' },
        defaultValue: 'left',
        options: [
          { value: 'left', label: { en: 'Left', ar: 'يسار' } },
          { value: 'center', label: { en: 'Center', ar: 'وسط' } },
        ],
      },
      {
        key: 'padding',
        type: 'select',
        label: { en: 'Vertical padding', ar: 'الحشو العمودي' },
        defaultValue: 'medium',
        options: [
          { value: 'none', label: { en: 'None', ar: 'بدون' } },
          { value: 'small', label: { en: 'Small', ar: 'صغير' } },
          { value: 'medium', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'large', label: { en: 'Large', ar: 'كبير' } },
        ],
      },
      { key: 'surface', type: 'boolean', label: { en: 'Card background', ar: 'خلفية بطاقة' }, defaultValue: false },
    ],
  },
  Component: RichText,
  defaultSettings: { width: 'normal', alignment: 'left', padding: 'medium', surface: false },
};
