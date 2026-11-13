'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { GalleryVideoItem } from '@/lib/productVideo';
import { ProductVideoSlide } from './ProductVideoSlide';

// Designer products (decision D7): the canvas owns the gallery slot, so the
// product's videos are listed below it. Only one plays at a time: starting
// another remounts the previous one back to its poster.

export function ProductVideoList({
  videos,
  storeSlug,
  className,
}: {
  videos: GalleryVideoItem[];
  storeSlug: string;
  /** Extra classes on the list (the designer layouts set its mobile order). */
  className?: string;
}) {
  const t = useTranslations();
  const [generation, setGeneration] = useState<Record<string, number>>({});
  const activeRef = useRef<string | null>(null);

  const handlePlaying = useCallback((id: string, playing: boolean) => {
    if (playing) {
      const previous = activeRef.current;
      activeRef.current = id;
      if (previous && previous !== id) {
        setGeneration((g) => ({ ...g, [previous]: (g[previous] ?? 0) + 1 }));
      }
    } else if (activeRef.current === id) {
      activeRef.current = null;
    }
  }, []);

  // Stable per-video callbacks so a slide's effects do not re-run each render.
  const callbacks = useRef(new Map<string, (playing: boolean) => void>());
  const callbackFor = (id: string) => {
    let cb = callbacks.current.get(id);
    if (!cb) {
      cb = (playing: boolean) => handlePlaying(id, playing);
      callbacks.current.set(id, cb);
    }
    return cb;
  };

  if (!videos.length) return null;
  return (
    <section aria-label={t('product.productVideos')} className={`mt-4 flex flex-col gap-3${className ? ` ${className}` : ''}`}>
      {videos.map((item) => (
        <div
          key={item.id}
          className="relative w-full overflow-hidden rounded-2xl bg-neutral-900"
          style={{ aspectRatio: item.width && item.height ? `${item.width} / ${item.height}` : '16 / 9' }}
        >
          <ProductVideoSlide
            key={`${item.id}:${generation[item.id] ?? 0}`}
            item={item}
            storeSlug={storeSlug}
            sizes="(min-width: 768px) 50vw, 100vw"
            onPlayingChange={callbackFor(item.id)}
          />
        </div>
      ))}
    </section>
  );
}
