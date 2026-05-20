import Image, { type ImageProps } from 'next/image';

/**
 * Storefront image wrapper over next/image. Centralises responsive `sizes`
 * defaults and the optimizer config so callers don't repeat boilerplate.
 * Media is served from the API origin, which is allowed in next.config
 * `images.remotePatterns`. Pass `fill` (with a sized, relative parent) or
 * explicit `width`/`height`; always pass an accurate `sizes` for fill images.
 */
export function StoreImage({ sizes, alt, ...props }: ImageProps) {
  return <Image alt={alt} sizes={sizes ?? '100vw'} {...props} />;
}
