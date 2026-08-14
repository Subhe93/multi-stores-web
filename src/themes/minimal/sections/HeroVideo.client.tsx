'use client';

// Component implementation. Definition lives in HeroVideo.tsx so the
// server-side theme registry resolves `.Component` to a ClientReference.
// Client-side because the <video> needs an onError fallback to the poster.

import { useState } from 'react';
import { resolveMediaUrl } from '@/lib/api';
import { buttonStyles, colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';
import type { SectionRenderProps } from '../../types';

type Height = 'md' | 'lg' | 'full';
const HEIGHT_CLASS: Record<Height, string> = {
  md: 'min-h-[480px]',
  lg: 'min-h-[640px]',
  full: 'min-h-[calc(100vh-80px)]',
};

export function HeroVideo({ settings, content }: SectionRenderProps) {
  const videoUrl = (settings.video_url as string) || '';
  const posterImage = (settings.poster_image as string) || '';
  const overlayOpacity = typeof settings.overlay_opacity === 'number' ? settings.overlay_opacity : 0.35;
  const height = (settings.height as Height) || 'lg';
  const alignment = (settings.alignment as 'left' | 'center' | 'right') || 'center';

  const eyebrow = (content.eyebrow as string) || '';
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const ctaText = (content.cta_text as string) || '';
  const ctaUrl = (content.cta_url as string) || (settings.cta_url as string) || '#';

  const resolvedVideo = videoUrl ? resolveMediaUrl(videoUrl) : '';
  const resolvedPoster = posterImage ? resolveMediaUrl(posterImage) : '';

  // Graceful fallback: when the video fails to load (bad URL, unsupported
  // codec, blocked network) we drop to the poster image instead.
  const [videoFailed, setVideoFailed] = useState(false);
  const showVideo = !!resolvedVideo && !videoFailed;

  // Text sits on dark media, so defaults lean light.
  const eyebrowColor = colorOr(settings.eyebrow_color, 'var(--theme-colors-accent)');
  const headingColor = colorOr(settings.heading_color, '#fff');
  const subheadingColor = colorOr(settings.subheading_color, 'rgba(255,255,255,0.85)');

  const ctaBtn = buttonStyles(
    {
      bg: settings.cta_bg_color,
      text: settings.cta_text_color,
      borderColor: settings.cta_border_color,
      borderWidth: settings.cta_border_width,
      borderRadius: settings.cta_border_radius,
    },
    {
      bg: 'var(--theme-colors-primary)',
      text: 'var(--theme-colors-primaryContrast, #fff)',
      radius: 'var(--theme-radius-full)',
    },
  );

  const alignClass =
    alignment === 'left'
      ? 'text-left items-start'
      : alignment === 'right'
        ? 'text-right items-end'
        : 'text-center items-center';
  const justifyClass =
    alignment === 'center' ? 'justify-center' : alignment === 'right' ? 'justify-end' : 'justify-start';

  return (
    <section
      className={`relative overflow-hidden flex items-center px-6 sm:px-12 ${HEIGHT_CLASS[height]}`}
      style={{
        color: '#fff',
        // Neutral dark ground behind the media so text stays readable while
        // the video buffers (and when neither video nor poster is set).
        backgroundColor: '#101014',
        width: '100vw',
        maxWidth: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        marginRight: 'calc(50% - 50vw)',
      }}
    >
      {showVideo ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={resolvedVideo}
          poster={resolvedPoster || undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          onError={() => setVideoFailed(true)}
        />
      ) : resolvedPoster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolvedPoster} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}

      {/* Dark overlay — slightly lighter at the top so faces/products in the video keep detail. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,${overlayOpacity * 0.7}) 0%, rgba(0,0,0,${overlayOpacity}) 100%)`,
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <div className={`flex w-full ${justifyClass}`}>
          <StaggerGroup step={0.1} className={`flex max-w-2xl flex-col gap-4 ${alignClass}`}>
            {eyebrow && (
              <StaggerItem>
                <span
                  className="text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{ color: eyebrowColor }}
                >
                  {eyebrow}
                </span>
              </StaggerItem>
            )}
            {heading && (
              <StaggerItem>
                <h1
                  className="leading-[1.05]"
                  style={{
                    fontFamily: 'var(--theme-font-heading)',
                    fontSize: 'var(--theme-scale-h1)',
                    fontWeight: 'var(--theme-weight-heading)',
                    letterSpacing: 'var(--theme-tracking-heading)',
                    color: headingColor,
                  }}
                >
                  {heading}
                </h1>
              </StaggerItem>
            )}
            {subheading && (
              <StaggerItem>
                <p
                  className="max-w-prose"
                  style={{
                    fontSize: 'var(--theme-scale-body)',
                    lineHeight: 'var(--theme-line-body)',
                    color: subheadingColor,
                  }}
                >
                  {subheading}
                </p>
              </StaggerItem>
            )}
            {ctaText && (
              <StaggerItem className={`flex ${justifyClass}`}>
                <a
                  href={ctaUrl}
                  className="inline-flex items-center justify-center px-8 py-3 transition-all duration-300 hover:opacity-90 hover:-translate-y-px"
                  style={{
                    ...ctaBtn,
                    fontWeight: 'var(--theme-weight-bold)',
                    boxShadow: 'var(--theme-shadow-md)',
                  }}
                >
                  {ctaText}
                </a>
              </StaggerItem>
            )}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}
