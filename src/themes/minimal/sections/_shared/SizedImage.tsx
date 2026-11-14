// Renders one image with the `image_size` model (../../../imageSizing.ts,
// plans/image-sizing/SPEC.md): scoped responsive CSS + a frame + the image.
// Used by the single-image section and the layout-columns image block when
// their settings carry `image_size`; without it those keep their legacy markup.
//
// Server-safe (no 'use client'): the dynamic `variant_image` source uses the
// client island instead, fed with the same `ResolvedImageSizing`.

import { useId, type CSSProperties, type ReactNode } from 'react';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc, optimizedImageUrl } from '@/lib/storeMedia';
import type { Breakpoint } from '../../../sectionStyle';
import {
  resolveImageSizing,
  type ImageSizeSettings,
  type ResolvedImageSizing,
} from '../../../imageSizing';

/** Unique, CSS-safe scope class for one sized image (call once per image). */
export function useImageSizeScope(): string {
  return `isz-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

export interface SizedImageLayout {
  scope: string;
  resolved: ResolvedImageSizing;
}

/** Resolve `image_size` for a section's container slots. */
export function sizedImageLayout(
  settings: ImageSizeSettings,
  scope: string,
  container: Partial<Record<Breakpoint, string>>,
): SizedImageLayout {
  return { scope, resolved: resolveImageSizing(settings, scope, { container }) };
}

/** The scoped stylesheet; render it once next to the frame. */
export function SizedImageStyle({ css }: { css: string }) {
  return css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null;
}

/** The <img>: next/image with explicit dimensions, or one natural rendition. */
export function SizedImageImg({
  layout,
  src,
  alt,
  style,
}: {
  layout: SizedImageLayout;
  src: string;
  alt: string;
  style?: CSSProperties;
}) {
  const { scope, resolved } = layout;
  const className = `${scope}-img`;
  if (resolved.natural) {
    // Natural size: a single optimizer rendition and no srcset, so the image
    // lays out at its file's pixel width (the optimizer never upscales).
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={optimizedImageUrl(src, 1920)}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={className}
        style={style}
      />
    );
  }
  return (
    <StoreImage
      src={src}
      alt={alt}
      width={resolved.intrinsic.width}
      height={resolved.intrinsic.height}
      sizes={resolved.sizes}
      unoptimized={isSvgSrc(src)}
      className={className}
      style={style}
    />
  );
}

/** A link that becomes the frame itself (so its box matches the image). */
export interface SizedImageLink {
  href: string;
  target?: string;
  rel?: string;
}

/**
 * Style + frame + image. With `link`, the frame is the <a> (display:block),
 * so the clickable area is the image's own box.
 */
export function SizedImage({
  layout,
  src,
  alt,
  frameStyle,
  link,
  dataDynamicImage,
}: {
  layout: SizedImageLayout;
  src: string;
  alt: string;
  frameStyle?: CSSProperties;
  link?: SizedImageLink;
  dataDynamicImage?: string;
}): ReactNode {
  const img = <SizedImageImg layout={layout} src={src} alt={alt} />;
  const data = dataDynamicImage ? { 'data-dynamic-image': dataDynamicImage } : {};
  return (
    <>
      <SizedImageStyle css={layout.resolved.css} />
      {link ? (
        <a
          href={link.href}
          {...(link.target ? { target: link.target } : {})}
          {...(link.rel ? { rel: link.rel } : {})}
          className={layout.scope}
          style={{ display: 'block', ...frameStyle }}
          {...data}
        >
          {img}
        </a>
      ) : (
        <div className={layout.scope} style={frameStyle} {...data}>
          {img}
        </div>
      )}
    </>
  );
}

/** Desktop aspect ratio as a CSS value, for builder placeholders. */
export function placeholderRatio(layout: SizedImageLayout): string {
  const h = layout.resolved.at.desktop.height;
  return h.mode === 'ratio' ? h.ratio.replace(':', '/') : '4/3';
}
