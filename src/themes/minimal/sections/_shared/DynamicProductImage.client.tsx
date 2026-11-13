'use client';

// `variant_image` dynamic source: the lead image of the product gallery, read
// from the page's shared product state (galleryImages[0]: the selected
// variant's image, else the value-level image of the picked options, else the
// featured image). It follows every variant pick like the gallery block.
// Without a product state provider the server-resolved `fallback` (featured
// image) is shown; with neither, the `placeholder` (builder hint, or nothing
// on the live store).

import type { CSSProperties, ReactNode } from 'react';
import { StoreImage } from '@/components/StoreImage';
import { useOptionalProductPageState } from '@/components/product/state/ProductPageState';
import { isSvgSrc } from '@/lib/storeMedia';

export interface DynamicProductImageProps {
  fallback: { url: string; alt: string } | null;
  /** Owner-entered alt text; wins over the gallery image's own alt. */
  altOverride?: string;
  /** Rendered when there is no image at all (null on the live store). */
  placeholder?: ReactNode;
  /** `fill`: image fills a sized frame. `intrinsic`: natural aspect ratio. */
  mode: 'fill' | 'intrinsic';
  frameClassName?: string;
  frameStyle?: CSSProperties;
  imgClassName?: string;
  imgStyle?: CSSProperties;
  sizes: string;
}

export function DynamicProductImage({
  fallback,
  altOverride,
  placeholder = null,
  mode,
  frameClassName,
  frameStyle,
  imgClassName,
  imgStyle,
  sizes,
}: DynamicProductImageProps) {
  const state = useOptionalProductPageState();
  const lead = state?.galleryImages[0];
  const base = lead?.url ? { url: lead.url, alt: lead.alt || fallback?.alt || '' } : fallback;
  if (!base?.url) return <>{placeholder}</>;
  const img = { url: base.url, alt: altOverride || base.alt || '' };
  if (mode === 'intrinsic') {
    return (
      <div className={frameClassName} style={frameStyle} data-dynamic-image="variant_image">
        <StoreImage
          src={img.url}
          alt={img.alt}
          width={1200}
          height={1200}
          sizes={sizes}
          unoptimized={isSvgSrc(img.url)}
          className={imgClassName}
          style={imgStyle}
        />
      </div>
    );
  }
  return (
    <div className={frameClassName} style={frameStyle} data-dynamic-image="variant_image">
      <StoreImage
        src={img.url}
        alt={img.alt}
        fill
        sizes={sizes}
        unoptimized={isSvgSrc(img.url)}
        className={imgClassName}
        style={imgStyle}
      />
    </div>
  );
}
