'use client';

import { resolveMediaUrl } from '@/lib/api';
import type { SectionRenderProps } from '../../types';
import { Slider } from './_shared/Slider.client';

interface GalleryItem {
  url?: string;
  alt?: string;
  caption?: string;
  href?: string;
}

type Aspect = 'square' | 'portrait' | 'landscape' | 'wide';

const ASPECT_CLASS: Record<Aspect, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
  wide: 'aspect-[16/9]',
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function GallerySlider({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const items = ((content.items as GalleryItem[]) || []).filter((i) => !!i.url);

  const spvDesktop = clamp((settings.slides_per_view as number) ?? 3, 1, 6);
  const spvTablet = clamp((settings.slides_per_view_tablet as number) ?? 2, 1, 6);
  const spvMobile = clamp((settings.slides_per_view_mobile as number) ?? 1, 1, 6);
  const gapPx = clamp((settings.gap_px as number) ?? 16, 0, 64);
  const aspect = (settings.aspect as Aspect) || 'square';
  const rounded = settings.rounded !== false;
  const showCaption = settings.show_caption !== false;
  const autoplayMs = (settings.autoplay_ms as number) || 0;
  const showArrows = settings.show_arrows !== false;
  const showDots = settings.show_dots !== false;
  const loop = settings.loop !== false;
  const dir: 'ltr' | 'rtl' = locale === 'ar' ? 'rtl' : 'ltr';

  const radiusStyle = rounded ? { borderRadius: 'var(--theme-radius-md)' } : undefined;

  const slideNodes = items.map((item, i) => {
    const inner = (
      <div className="group relative overflow-hidden h-full" style={radiusStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveMediaUrl(item.url || '')}
          alt={item.alt || ''}
          loading="lazy"
          className={`w-full ${ASPECT_CLASS[aspect]} object-cover transition-transform duration-500 group-hover:scale-105`}
        />
        {showCaption && item.caption && (
          <div
            className="absolute inset-x-0 bottom-0 p-3 text-white text-xs translate-y-full group-hover:translate-y-0 transition-transform duration-300"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65), transparent)' }}
          >
            {item.caption}
          </div>
        )}
      </div>
    );
    return item.href ? (
      <a key={i} href={item.href} className="block">
        {inner}
      </a>
    ) : (
      <div key={i}>{inner}</div>
    );
  });

  return (
    <section className="py-10">
      {(heading || subheading) && (
        <div className="text-center mb-8 space-y-2">
          {heading && (
            <h2
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h2)',
                fontWeight: 'var(--theme-weight-heading)',
                lineHeight: 'var(--theme-line-heading)',
              }}
            >
              {heading}
            </h2>
          )}
          {subheading && (
            <p className="max-w-2xl mx-auto" style={{ color: 'var(--theme-colors-muted)' }}>
              {subheading}
            </p>
          )}
        </div>
      )}

      {slideNodes.length === 0 ? (
        <div
          className="text-center py-10 px-4"
          style={{
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
            color: 'var(--theme-colors-muted)',
          }}
        >
          <p className="text-sm">
            {locale === 'ar'
              ? 'لا توجد صور بعد. أضف صورًا من البيلدر.'
              : 'No images yet. Add some from the builder.'}
          </p>
        </div>
      ) : (
        <Slider
          slides={slideNodes}
          slidesPerView={spvDesktop}
          slidesPerViewTablet={spvTablet}
          slidesPerViewMobile={spvMobile}
          gapPx={gapPx}
          autoplayMs={autoplayMs > 0 ? autoplayMs : undefined}
          showArrows={showArrows}
          showDots={showDots}
          loop={loop}
          dir={dir}
          ariaLabel={locale === 'ar' ? 'سلايدر معرض الصور' : 'Image gallery slider'}
        />
      )}
    </section>
  );
}
