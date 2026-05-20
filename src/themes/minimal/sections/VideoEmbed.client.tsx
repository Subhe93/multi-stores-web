'use client';

// Component implementation. Definition stays in VideoEmbed.tsx so the
// server-side theme registry can read `.Component` as a ClientReference.

import { useState } from 'react';
import { Play } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
import type { SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';

// Turn a YouTube/Vimeo watch URL into an embeddable one. Returns null for
// anything we don't recognise (or a direct file URL handled separately).
function toEmbedUrl(raw: string, autoplay: boolean): { kind: 'iframe' | 'file'; src: string } | null {
  const url = raw.trim();
  if (!url) return null;

  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) {
    const ap = autoplay ? '?autoplay=1&mute=1' : '';
    return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}${ap}` };
  }

  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    const ap = autoplay ? '?autoplay=1&muted=1' : '';
    return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}${ap}` };
  }

  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
    return { kind: 'file', src: resolveMediaUrl(url) };
  }

  // Fall back to embedding the raw URL in an iframe (custom embeds).
  return { kind: 'iframe', src: url };
}

export function VideoEmbed({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const videoUrl = (settings.video_url as string) || '';
  const poster = settings.poster as string | undefined;
  const ratio = (settings.aspect_ratio as '16/9' | '4/3' | '1/1' | '9/16') || '16/9';

  // Click-to-play: until the user clicks the poster we render nothing heavy.
  // With no poster the embed loads immediately.
  const [playing, setPlaying] = useState(false);

  const embed = toEmbedUrl(videoUrl, true);
  const hasPoster = typeof poster === 'string' && !!poster;

  return (
    <section className="py-12">
      {(heading || subheading) && (
        <div className="text-center mb-8 max-w-2xl mx-auto">
          {heading && (
            <h2
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h2)',
                fontWeight: 'var(--theme-weight-heading)',
                lineHeight: 'var(--theme-line-heading)',
                color: colorOr(settings.heading_color, 'var(--theme-colors-text)'),
              }}
            >
              {heading}
            </h2>
          )}
          {subheading && (
            <p className="text-sm mt-2" style={{ color: colorOr(settings.subheading_color, 'var(--theme-colors-muted)') }}>
              {subheading}
            </p>
          )}
        </div>
      )}

      <div
        className="relative w-full overflow-hidden mx-auto"
        style={{
          aspectRatio: ratio.replace('/', ' / '),
          maxWidth: '900px',
          backgroundColor: 'var(--theme-colors-surface)',
          borderRadius: 'var(--theme-radius-md)',
        }}
      >
        {!embed ? (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
            <p className="text-sm" style={{ color: 'var(--theme-colors-muted)' }}>
              {locale === 'ar' ? 'أضف رابط فيديو من البيلدر.' : 'Add a video URL from the builder.'}
            </p>
          </div>
        ) : hasPoster && !playing ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full group"
            aria-label={locale === 'ar' ? 'تشغيل الفيديو' : 'Play video'}
          >
            <img src={resolveMediaUrl(poster!)} alt="" className="w-full h-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
              <span
                className="size-16 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
                style={{ backgroundColor: 'var(--theme-colors-primary)' }}
              >
                <Play className="size-7 text-white ms-1" fill="currentColor" />
              </span>
            </span>
          </button>
        ) : embed.kind === 'file' ? (
          <video src={embed.src} controls autoPlay={playing} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <iframe
            src={embed.src}
            title={heading || 'Video'}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    </section>
  );
}
