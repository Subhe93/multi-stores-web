'use client';

import type { SyntheticEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';

// Pause / play and mute / unmute toggles of a muted autoplaying video
// (CONTRACT-AUTOPLAY A3, WCAG 2.2.2). Clicks never reach the slide (no
// lightbox, no switch to the full player). Icons are not mirrored in RTL.

export interface VideoAutoplayControlsProps {
  paused: boolean;
  muted: boolean;
  onTogglePaused(): void;
  onToggleMuted(): void;
  /** Position classes (default bottom-2 start-2). */
  className?: string;
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

const BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40';

export function VideoAutoplayControls({
  paused,
  muted,
  onTogglePaused,
  onToggleMuted,
  className = 'bottom-2 start-2',
}: VideoAutoplayControlsProps) {
  const t = useTranslations();
  return (
    <div
      className={`absolute z-30 flex gap-2 ${className}`}
      data-video-autoplay-controls=""
      onClick={stop}
      onPointerDown={stop}
      onTouchStart={stop}
      onTouchEnd={stop}
    >
      <button
        type="button"
        className={BUTTON}
        aria-label={paused ? t('product.videoResume') : t('product.videoPause')}
        aria-pressed={paused}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePaused();
        }}
      >
        {paused ? (
          <Play className="h-4 w-4 translate-x-px fill-current" aria-hidden="true" />
        ) : (
          <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className={BUTTON}
        aria-label={muted ? t('product.videoUnmute') : t('product.videoMute')}
        aria-pressed={!muted}
        onClick={(e) => {
          e.stopPropagation();
          onToggleMuted();
        }}
      >
        {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
