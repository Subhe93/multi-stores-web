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
import { isSvgSrc, optimizedImageUrl } from '@/lib/storeMedia';

export interface DynamicProductImageProps {
  fallback: { url: string; alt: string } | null;
  /** Owner-entered alt text; wins over the gallery image's own alt. */
  altOverride?: string;
  /** Rendered when there is no image at all (null on the live store). */
  placeholder?: ReactNode;
  /**
   * `fill`: image fills a sized frame. `intrinsic`: natural aspect ratio.
   * `natural`: a plain <img> with one optimizer rendition and no srcset, laid
   * out at the file's own pixel width (image_size width_mode 'auto').
   */
  mode: 'fill' | 'intrinsic' | 'natural';
  /** next/image dimensions in `intrinsic` mode (default 1200x1200). */
  width?: number;
  height?: number;
  frameClassName?: string;
  frameStyle?: CSSProperties;
  imgClassName?: string;
  imgStyle?: CSSProperties;
  sizes: string;
  /**
   * Makes the frame itself the link (display:block), so the clickable area is
   * the image box. Used by the image_size path; the legacy path wraps instead.
   */
  link?: { href: string };
}

/** The image frame: a <div>, or the <a> itself when `link` is set. */
function Frame({
  className,
  style,
  link,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  link?: { href: string };
  children: ReactNode;
}) {
  if (link) {
    return (
      <a href={link.href} className={className} style={{ display: 'block', ...style }} data-dynamic-image="variant_image">
        {children}
      </a>
    );
  }
  return (
    <div className={className} style={style} data-dynamic-image="variant_image">
      {children}
    </div>
  );
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
  width = 1200,
  height = 1200,
  link,
}: DynamicProductImageProps) {
  const state = useOptionalProductPageState();
  const lead = state?.galleryImages[0];
  const base = lead?.url ? { url: lead.url, alt: lead.alt || fallback?.alt || '' } : fallback;
  if (!base?.url) return <>{placeholder}</>;
  const img = { url: base.url, alt: altOverride || base.alt || '' };
  if (mode === 'natural') {
    return (
      <Frame className={frameClassName} style={frameStyle} link={link}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={optimizedImageUrl(img.url, 1920)}
          alt={img.alt}
          loading="lazy"
          decoding="async"
          className={imgClassName}
          style={imgStyle}
        />
      </Frame>
    );
  }
  if (mode === 'intrinsic') {
    return (
      <Frame className={frameClassName} style={frameStyle} link={link}>
        <StoreImage
          src={img.url}
          alt={img.alt}
          width={width}
          height={height}
          sizes={sizes}
          unoptimized={isSvgSrc(img.url)}
          className={imgClassName}
          style={imgStyle}
        />
      </Frame>
    );
  }
  return (
    <Frame className={frameClassName} style={frameStyle} link={link}>
      <StoreImage
        src={img.url}
        alt={img.alt}
        fill
        sizes={sizes}
        unoptimized={isSvgSrc(img.url)}
        className={imgClassName}
        style={imgStyle}
      />
    </Frame>
  );
}
