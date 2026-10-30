import { getImageProps } from 'next/image';

/**
 * True for SVG sources. next/image refuses to optimize SVG without
 * dangerouslyAllowSVG, so callers pass `unoptimized` for these.
 */
export function isSvgSrc(src: string): boolean {
  return /\.svg(?:[?#]|$)/i.test(src) || src.startsWith('data:image/svg');
}

/**
 * Optimizer URL (/_next/image, modern format) for places that can't render
 * next/image, e.g. CSS backgrounds or a <video> poster. The optimizer never
 * upscales, so `width` is an upper bound. SVG/data/blob sources pass through.
 */
export function optimizedImageUrl(src: string, width = 1920): string {
  if (!src || isSvgSrc(src) || src.startsWith('data:') || src.startsWith('blob:')) return src;
  // Without `sizes`, the returned src is the 2x candidate, so request half.
  const half = Math.max(1, Math.round(width / 2));
  return getImageProps({ src, alt: '', width: half, height: half }).props.src;
}

/**
 * Responsive src/srcSet/sizes for a plain <img> whose box is sized by CSS or
 * by the image's natural ratio (no fixed width/height to give next/image).
 * Spread onto the <img>; layout stays exactly as before.
 */
export function responsiveImgProps(
  src: string,
  sizes: string,
): { src: string; srcSet?: string; sizes?: string } {
  if (!src || isSvgSrc(src) || src.startsWith('data:') || src.startsWith('blob:')) return { src };
  const { props } = getImageProps({ src, alt: '', fill: true, sizes });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}
