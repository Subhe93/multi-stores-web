'use client';

// Component implementation. Definition stays in VideoEmbed.tsx so the
// server-side theme registry can read `.Component` as a ClientReference.

import { useState, useSyncExternalStore } from 'react';
import { Play } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import { subscribeConsent } from '@/lib/consent';
import {
  embedAllowed,
  parseExternalVideoUrl,
  toEmbedUrl as toPrivacyEmbedUrl,
  type ParsedExternalVideo,
} from '@/lib/productVideo';
import { ExternalVideoFacade } from '@/components/product/video/ExternalVideoFacade';
import type { SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';
import { headingTag, textTag } from './_shared/headingLevel';
import { Heading } from './_shared/Heading';

type Embed =
  | { kind: 'external'; video: ParsedExternalVideo }
  | { kind: 'file'; src: string }
  | { kind: 'iframe'; src: string };

// YouTube / Vimeo go through the same privacy rules as product videos
// (CONTRACT-AUTOPLAY A4): youtube-nocookie / Vimeo dnt=1, and nothing is
// requested from the provider before a click on the two-click facade unless
// the visitor chose "Always allow external videos". Returns null when empty.
function resolveEmbed(raw: string): Embed | null {
  const url = raw.trim();
  if (!url) return null;

  const video = parseExternalVideoUrl(url);
  if (video) return { kind: 'external', video };

  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
    return { kind: 'file', src: resolveMediaUrl(url) };
  }

  // Fall back to embedding the raw URL in an iframe (custom embeds).
  return { kind: 'iframe', src: url };
}

const noopSubscribe = () => () => {};

export function VideoEmbed({ settings, content, locale, storeSlug }: SectionRenderProps) {
  const headingLevel = headingTag(settings.heading_level, 'h2');
  const subheadingTag = textTag(settings.subheading_tag, 'p');
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const videoUrl = (settings.video_url as string) || '';
  const poster = settings.poster as string | undefined;
  const ratio = (settings.aspect_ratio as '16/9' | '4/3' | '1/1' | '9/16') || '16/9';

  // Click-to-play: until the user clicks the poster we render nothing heavy.
  // With no poster a file / custom embed loads immediately; a YouTube / Vimeo
  // video only when the visitor allowed external videos (muted autoplay).
  const [playing, setPlaying] = useState(false);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // Server snapshot false: SSR never renders a third-party iframe.
  const allowed = useSyncExternalStore(subscribeConsent, () => embedAllowed(storeSlug), () => false);
  // [Play video] on the facade: this one embed may load without the grant.
  const [oneOff, setOneOff] = useState(false);

  const embed = resolveEmbed(videoUrl);
  const hasPoster = typeof poster === 'string' && !!poster;
  const external = embed?.kind === 'external' ? embed.video : null;
  // Iframe src of an external video that may load now, else null.
  const externalSrc = !external
    ? null
    : playing && (allowed || oneOff)
      ? toPrivacyEmbedUrl(external)
      : !hasPoster && allowed
        ? toPrivacyEmbedUrl(external, { autoplayMuted: true })
        : null;
  const playLabel = locale === 'ar' ? 'تشغيل الفيديو' : 'Play video';

  return (
    <section className="py-12">
      {(heading || subheading) && (
        <div className="text-center mb-8 max-w-2xl mx-auto">
          {heading && (
            <Heading level={headingLevel}
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h2)',
                fontWeight: 'var(--theme-weight-heading)',
                lineHeight: 'var(--theme-line-heading)',
                color: colorOr(settings.heading_color, 'var(--theme-colors-text)'),
              }}
            >
              {heading}
            </Heading>
          )}
          {subheading && (
            <Heading level={subheadingTag} look="body" className="text-sm mt-2" style={{ color: colorOr(settings.subheading_color, 'var(--theme-colors-muted)') }}>
              {subheading}
            </Heading>
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
        ) : external && !externalSrc ? (
          // Two-click facade over the self-hosted poster (or a plain surface).
          <>
            {hasPoster && (
              <StoreImage src={resolveMediaUrl(poster!)} alt="" fill sizes="(min-width: 900px) 900px, 100vw" unoptimized={isSvgSrc(resolveMediaUrl(poster!))} className="object-cover" />
            )}
            {hydrated && !allowed ? (
              <ExternalVideoFacade
                provider={external.kind}
                watchUrl={external.canonicalUrl}
                storeSlug={storeSlug}
                onPlayOnce={() => {
                  setOneOff(true);
                  setPlaying(true);
                }}
              />
            ) : (
              <PlayButton label={playLabel} onClick={() => setPlaying(true)} />
            )}
          </>
        ) : externalSrc ? (
          <iframe
            src={externalSrc}
            title={heading || 'Video'}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : hasPoster && !playing ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full group"
            aria-label={locale === 'ar' ? 'تشغيل الفيديو' : 'Play video'}
          >
            <StoreImage src={resolveMediaUrl(poster!)} alt="" fill sizes="(min-width: 900px) 900px, 100vw" unoptimized={isSvgSrc(resolveMediaUrl(poster!))} className="object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
              <span
                className="size-16 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
                style={{ backgroundColor: 'var(--theme-colors-primary)', color: 'var(--theme-colors-primaryContrast, #fff)' }}
              >
                <Play className="size-7 ms-1" fill="currentColor" />
              </span>
            </span>
          </button>
        ) : embed.kind === 'file' ? (
          <video src={embed.src} controls autoPlay={playing} className="absolute inset-0 w-full h-full object-cover" />
        ) : embed.kind === 'iframe' ? (
          <iframe
            src={embed.src}
            title={heading || 'Video'}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : null}
      </div>
    </section>
  );
}

function PlayButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button type="button" onClick={onClick} className="absolute inset-0 w-full h-full group" aria-label={label}>
      <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
        <span
          className="size-16 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
          style={{ backgroundColor: 'var(--theme-colors-primary)', color: 'var(--theme-colors-primaryContrast, #fff)' }}
        >
          <Play className="size-7 ms-1" fill="currentColor" />
        </span>
      </span>
    </button>
  );
}
