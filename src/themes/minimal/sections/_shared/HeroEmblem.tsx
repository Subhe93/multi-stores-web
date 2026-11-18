// The optional hero emblem (settings of emblemFields.ts): a small brand mark
// in a fixed square box, in flow above the eyebrow. Decoration only
// (aria-hidden, empty alt), never mirrored. Renders nothing while no image
// is set. Without the store motion style it is a still image; with it the
// box enters with the hero text and the mark inside drifts a few pixels (or
// turns a few degrees) while the hero scrolls past, on desktops only.
//
// No hooks: used by server sections.

import { resolveMediaUrl } from '@/lib/api';
import { isSvgSrc } from '@/lib/storeMedia';
import { StoreImage } from '@/components/StoreImage';
import { drift, fade, rise, type MotionProp } from '../../../creative/recipes';
import { emblemMotionValue, emblemPositionValue, emblemSizeValue, type EmblemSize } from './emblemFields';

// Fixed boxes, so nothing shifts when the image loads: 44 / 56 px and
// 64 / 88 px (phone / from 768 px).
const SIZE_CLASS: Record<EmblemSize, string> = {
  sm: 'size-11 md:size-14',
  md: 'size-16 md:size-[88px]',
};

interface HeroEmblemProps {
  settings: Record<string, unknown>;
  motion?: MotionProp;
  /** The text block is centred: the emblem is centred too, whatever its stored side. */
  centered?: boolean;
  className?: string;
}

export function HeroEmblem({ settings, motion, centered = false, className }: HeroEmblemProps) {
  const image = typeof settings.emblem_image === 'string' ? settings.emblem_image.trim() : '';
  if (!image) return null;
  const src = resolveMediaUrl(image);
  const kind = emblemMotionValue(settings.emblem_motion);
  const size = emblemSizeValue(settings.emblem_size);
  // Auto margins place the box in a flex column and in a plain block alike.
  const side = centered ? 'mx-auto' : emblemPositionValue(settings.emblem_position) === 'end' ? 'ms-auto' : 'me-auto';
  // Two elements: the entrance (a stylesheet animation) and the scroll drift
  // (an inline transform written by the engine) must not share one.
  const enter = kind === 'rise' ? rise(motion) : kind === 'turn' ? fade(motion) : {};
  const travel =
    kind === 'rise' ? drift(motion, { y: -12 }) : kind === 'turn' ? drift(motion, { y: -4, rotate: 8 }) : {};
  return (
    <div
      aria-hidden="true"
      className={['block shrink-0', SIZE_CLASS[size], side, className].filter(Boolean).join(' ')}
      data-hero-emblem={kind}
      {...enter}
    >
      <div className="relative size-full" {...travel}>
        <StoreImage
          src={src}
          alt=""
          fill
          sizes="88px"
          unoptimized={isSvgSrc(src)}
          className="object-contain"
        />
      </div>
    </div>
  );
}
