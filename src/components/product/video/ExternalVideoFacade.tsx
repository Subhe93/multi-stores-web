'use client';

import { useRef, type SyntheticEvent } from 'react';
import { useTranslations } from 'next-intl';
import { grantExternalMediaConsent } from '@/lib/consent';
import { consentTextHash } from '@/lib/consentLog';
import { useLocalePath } from '@/hooks/useLocalePath';

// Two-click privacy facade for YouTube / Vimeo (CONTRACT-AUTOPLAY A4 / 6.5).
// Shown over the self-hosted poster, after hydration, while the visitor has
// not allowed external videos for this store. Nothing is requested from the
// provider until a click: [Play video] loads this one embed (nothing stored),
// [Always allow external media] stores the per-store external-media consent
// (consent v2 category external_media) and then loads it. The notice and the
// "always allow" label carry data-consent-text: their sha256 goes into the
// consent-log row of the grant (consent-v2 CONTRACT §5.4). Both buttons are
// equally prominent.

export interface ExternalVideoFacadeProps {
  provider: 'youtube' | 'vimeo';
  watchUrl: string;
  storeSlug: string;
  /** Narrow tiles (story cards): clamped text, stacked buttons. */
  compact?: boolean;
  onPlayOnce(): void;
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

const BUTTON =
  'rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:text-sm';

export function ExternalVideoFacade({ provider, watchUrl, storeSlug, compact = false, onPlayOnce }: ExternalVideoFacadeProps) {
  const t = useTranslations();
  const lp = useLocalePath();
  const name = provider === 'vimeo' ? 'Vimeo' : 'YouTube';
  const company = provider === 'vimeo' ? 'Vimeo' : 'YouTube/Google';
  const groupRef = useRef<HTMLDivElement>(null);

  return (
    // Full-size container so narrow tiles switch to the compact layout via a
    // container query; only the notice box itself takes pointer events.
    <div className="pointer-events-none absolute inset-0 z-20 @container" data-external-video-facade="">
      <div
        ref={groupRef}
        role="group"
        aria-label={t('product.externalVideoTitle', { provider: name })}
        className="pointer-events-auto absolute inset-x-2 bottom-2 rounded-lg bg-black/80 p-3 text-xs leading-relaxed text-white sm:text-sm"
        onClick={stop}
        onPointerDown={stop}
        onTouchStart={stop}
        onTouchEnd={stop}
      >
        <p className={compact ? 'line-clamp-3' : '@max-[15rem]:line-clamp-3'} data-consent-text="">
          {t('product.externalVideoNotice', { provider: name, company })}
        </p>
        <div className={`mt-2 flex gap-2 ${compact ? 'flex-col' : 'flex-wrap @max-[15rem]:flex-col'}`}>
          <button type="button" className={BUTTON} onClick={onPlayOnce}>
            {t('product.externalVideoPlay')}
          </button>
          <button
            type="button"
            className={BUTTON}
            data-consent-text=""
            onClick={() => {
              // The text is read now; the grant is stored at once and its log
              // row carries the hash when it resolves.
              grantExternalMediaConsent(storeSlug, consentTextHash(groupRef.current));
              onPlayOnce();
            }}
          >
            {t('product.externalVideoAlwaysAllow')}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] sm:text-xs">
          <a href={lp('/legal/privacy')} className="underline underline-offset-2">
            {t('product.externalVideoPrivacy')}
          </a>
          <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {provider === 'vimeo' ? t('product.watchOnVimeo') : t('product.watchOnYouTube')}
          </a>
        </div>
      </div>
    </div>
  );
}
