import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import {
  DynamicSourceHint,
  dynamicImageSource,
  isDynamicPreview,
  productHasAnyImage,
  resolveDynamicImage,
} from './_shared/dynamicSource';
import { IMAGE_SOURCE_FIELDS, STATIC_IMAGE_SHOW_IF } from './_shared/dynamicSourceFields';
import { DynamicProductImage } from './_shared/lazyDynamic';
import { hasImageSize, type ImageSizeSettings } from '../../imageSizing';
import {
  SizedImage,
  SizedImageStyle,
  placeholderRatio,
  sizedImageLayout,
  useImageSizeScope,
} from './_shared/SizedImage';

// `single-image`: one image, nothing else. Fits anywhere in a layout
// container. On a PRODUCT_TEMPLATE its image can come from the product
// (`image_source`, see ./_shared/dynamicSource.tsx), including the selected
// variant's image.

type Aspect = 'auto' | 'square' | 'portrait' | 'landscape' | 'wide';

const ASPECT_CLASS: Record<Exclude<Aspect, 'auto'>, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
  wide: 'aspect-[16/9]',
};

const SIZES = '(min-width: 1024px) 50vw, 100vw';
// The same slots as SIZES, as image_size container widths.
const CONTAINER = { desktop: '50vw', tablet: '100vw' } as const;

function SingleImage(props: SectionRenderProps) {
  // With `image_size` the sized renderer is used; without it the legacy
  // markup below stays byte-identical (saved sections, live stores).
  if (hasImageSize(props.settings.image_size)) return <SingleImageSized {...props} />;
  return <SingleImageLegacy {...props} />;
}

/** `image_size` path (plans/image-sizing/SPEC.md); legacy aspect/fit are ignored. */
function SingleImageSized({ settings, content, product, locale, builderPreview }: SectionRenderProps) {
  const scope = useImageSizeScope();
  const layout = sizedImageLayout(settings.image_size as ImageSizeSettings, scope, CONTAINER);
  const { resolved } = layout;
  const rounded = settings.rounded !== false;
  const linkUrl = typeof settings.link_url === 'string' ? settings.link_url.trim() : '';
  const altText = typeof content.alt === 'string' ? content.alt.trim() : '';
  const source = dynamicImageSource(settings);
  const preview = isDynamicPreview(builderPreview);
  const frameStyle = {
    borderRadius: rounded ? 'var(--theme-radius-lg)' : '0',
    overflow: 'hidden' as const,
  };
  const link = linkUrl ? { href: linkUrl } : undefined;
  const ratio = placeholderRatio(layout);

  let image = null;
  if (!source) {
    const url = resolveMediaUrl((settings.image as string) || '');
    if (url) {
      // The frame is the link itself, so the clickable area is the image.
      return <SizedImage layout={layout} src={url} alt={altText} frameStyle={frameStyle} link={link} />;
    }
    if (preview) {
      // Builder only: an upload box. The live store renders nothing.
      image = (
        <div
          className="flex items-center justify-center"
          style={{
            aspectRatio: ratio,
            backgroundColor: 'var(--theme-colors-surface)',
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-lg)',
          }}
        >
          <span className="text-xs" style={{ color: 'var(--theme-colors-muted)' }}>
            {locale === 'ar' ? 'ارفع صورة' : 'Upload an image'}
          </span>
        </div>
      );
    }
  } else {
    const hint = preview ? (
      <DynamicSourceHint
        source={source}
        locale={locale}
        hasProduct={!!product}
        className="flex flex-col items-center justify-center"
        style={{ aspectRatio: ratio }}
      />
    ) : null;
    const resolvedImg = product ? resolveDynamicImage(source, product, settings, locale) : null;
    const dynamicAlt = (img: { alt: string } | null) => altText || img?.alt || '';
    if (!product) {
      image = hint;
    } else if (source === 'variant_image') {
      if (!productHasAnyImage(product)) {
        image = hint;
      } else {
        // The frame is the link itself (as for the other sources), so the
        // clickable area is the image box, not the whole row.
        return (
          <>
            <SizedImageStyle css={resolved.css} />
            <DynamicProductImage
              mode={resolved.natural ? 'natural' : 'intrinsic'}
              width={resolved.intrinsic.width}
              height={resolved.intrinsic.height}
              fallback={resolvedImg ? { url: resolvedImg.url, alt: dynamicAlt(resolvedImg) } : null}
              altOverride={altText || undefined}
              placeholder={hint}
              frameClassName={scope}
              frameStyle={frameStyle}
              imgClassName={`${scope}-img`}
              sizes={resolved.sizes}
              link={link}
            />
          </>
        );
      }
    } else if (resolvedImg) {
      return (
        <SizedImage
          layout={layout}
          src={resolvedImg.url}
          alt={dynamicAlt(resolvedImg)}
          frameStyle={frameStyle}
          link={link}
          dataDynamicImage={source}
        />
      );
    } else {
      image = hint;
    }
  }

  if (!image) return null;
  return linkUrl ? (
    <a href={linkUrl} className="block">
      {image}
    </a>
  ) : (
    image
  );
}

function SingleImageLegacy({ settings, content, product, locale, builderPreview }: SectionRenderProps) {
  const aspect = ((settings.aspect as Aspect) in ASPECT_CLASS ? settings.aspect : 'auto') as Aspect;
  const fit = settings.fit === 'contain' ? 'object-contain' : 'object-cover';
  const rounded = settings.rounded !== false;
  const linkUrl = typeof settings.link_url === 'string' ? settings.link_url.trim() : '';
  const altText = typeof content.alt === 'string' ? content.alt.trim() : '';
  const source = dynamicImageSource(settings);
  const preview = isDynamicPreview(builderPreview);
  const frameStyle = {
    borderRadius: rounded ? 'var(--theme-radius-lg)' : '0',
    overflow: 'hidden' as const,
  };
  const frameClass = aspect === 'auto' ? 'relative w-full' : `relative w-full ${ASPECT_CLASS[aspect]}`;
  const mode = aspect === 'auto' ? ('intrinsic' as const) : ('fill' as const);
  const imgClass = aspect === 'auto' ? 'w-full h-auto' : fit;

  let image = null;
  if (!source) {
    const url = resolveMediaUrl((settings.image as string) || '');
    if (url) {
      image = (
        <div className={frameClass} style={frameStyle}>
          {mode === 'fill' ? (
            <StoreImage src={url} alt={altText} fill sizes={SIZES} unoptimized={isSvgSrc(url)} className={imgClass} />
          ) : (
            <StoreImage src={url} alt={altText} width={1200} height={1200} sizes={SIZES} unoptimized={isSvgSrc(url)} className={imgClass} />
          )}
        </div>
      );
    } else if (preview) {
      // Builder only: an upload box. The live store renders nothing.
      image = (
        <div
          className={`${aspect === 'auto' ? 'aspect-[4/3]' : ASPECT_CLASS[aspect]} flex items-center justify-center`}
          style={{
            backgroundColor: 'var(--theme-colors-surface)',
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-lg)',
          }}
        >
          <span className="text-xs" style={{ color: 'var(--theme-colors-muted)' }}>
            {locale === 'ar' ? 'ارفع صورة' : 'Upload an image'}
          </span>
        </div>
      );
    }
  } else {
    const hint = preview ? (
      <DynamicSourceHint
        source={source}
        locale={locale}
        hasProduct={!!product}
        className={`${aspect === 'auto' ? 'aspect-[4/3]' : ASPECT_CLASS[aspect]} flex flex-col items-center justify-center`}
      />
    ) : null;
    const resolved = product ? resolveDynamicImage(source, product, settings, locale) : null;
    const dynamicAlt = (img: { alt: string } | null) => altText || img?.alt || '';
    if (!product) {
      image = hint;
    } else if (source === 'variant_image') {
      image = productHasAnyImage(product) ? (
        <DynamicProductImage
          mode={mode}
          fallback={resolved ? { url: resolved.url, alt: dynamicAlt(resolved) } : null}
          altOverride={altText || undefined}
          placeholder={hint}
          frameClassName={frameClass}
          frameStyle={frameStyle}
          imgClassName={imgClass}
          sizes={SIZES}
        />
      ) : (
        hint
      );
    } else if (resolved) {
      image = (
        <div className={frameClass} style={frameStyle} data-dynamic-image={source}>
          {mode === 'fill' ? (
            <StoreImage src={resolved.url} alt={dynamicAlt(resolved)} fill sizes={SIZES} unoptimized={isSvgSrc(resolved.url)} className={imgClass} />
          ) : (
            <StoreImage
              src={resolved.url}
              alt={dynamicAlt(resolved)}
              width={1200}
              height={1200}
              sizes={SIZES}
              unoptimized={isSvgSrc(resolved.url)}
              className={imgClass}
            />
          )}
        </div>
      );
    } else {
      image = hint;
    }
  }

  if (!image) return null;
  return linkUrl ? (
    <a href={linkUrl} className="block">
      {image}
    </a>
  ) : (
    image
  );
}

export const singleImageSection: SectionDefinition = {
  schema: {
    id: 'single-image',
    label: { en: 'Image', ar: 'صورة' },
    icon: 'image',
    category: 'content',
    description: {
      en: 'A single image. On the product template it can show the product or selected variant image.',
      ar: 'صورة واحدة. في قالب المنتج يمكن أن تعرض صورة المنتج أو صورة الخيار المحدد.',
    },
    translatable: ['alt'],
    schema: [
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' }, showIf: STATIC_IMAGE_SHOW_IF },
      ...IMAGE_SOURCE_FIELDS,
      // Width / height / ratio / fit / alignment per breakpoint. Replaces the
      // legacy `aspect` + `fit` fields; stored legacy values are still read
      // by the legacy render path while `image_size` is empty.
      { key: 'image_size', type: 'imageSize', label: { en: 'Image size', ar: 'حجم الصورة' } },
      { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'زوايا مستديرة' }, defaultValue: true },
      { key: 'link_url', type: 'url', label: { en: 'Link', ar: 'الرابط' } },
      { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'النص البديل' } },
    ],
  },
  Component: SingleImage,
  // Gets the explicit builder flag for its empty-image placeholder.
  needsBuilderPreview: true,
  defaultSettings: { image_source: 'static', aspect: 'auto', fit: 'cover', rounded: true },
};
