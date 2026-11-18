// Shared parts of the creative hero compositions (hero-outline, hero-sunrise)
// and the travelling stage (stage-scenes). Plain functions without hooks:
// safe in a server component and inside the client builder preview.

import type { CSSProperties } from 'react';
import { resolveMediaUrl } from '@/lib/api';
import { isSvgSrc } from '@/lib/storeMedia';
import { sectionHref } from '../../minimal/sections/_shared/links';
import { isArabicScript } from '../emphasis';
import { PillButton } from '../primitives/parts';

export const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export const scriptOf = (text: string): 'arabic' | undefined => (isArabicScript(text) ? 'arabic' : undefined);

const DATA_IMAGE = /^data:image\/(?:svg\+xml|png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/;

/**
 * Source of an owner image: an inline base64 image as it is, anything else
 * (stored /uploads paths) through the media origin.
 */
export function heroMedia(raw: unknown): string {
  const src = str(raw);
  if (!src) return '';
  if (src.startsWith('data:')) return DATA_IMAGE.test(src) ? src : '';
  return resolveMediaUrl(src);
}

/** SVG and inline sources skip the image optimizer. */
export const unoptimized = (src: string): boolean => isSvgSrc(src) || src.startsWith('data:');

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** A hex colour from a colour setting, or undefined. */
export function hexColor(raw: unknown): string | undefined {
  const v = str(raw);
  return HEX.test(v) ? v : undefined;
}

/** Physical object-position of a photo (photos are never mirrored). */
export function focusPosition(raw: unknown): string {
  return raw === 'top' ? 'center top' : raw === 'bottom' ? 'center bottom' : 'center center';
}

/**
 * Inline script placed as the LAST child of a composition root. The intro of
 * these sections is pure CSS and plays on load; when the section sits below
 * the first screen, the script marks the root data-cx-wait (every animation
 * inside holds its first frame, behind the motion gate) and an observer
 * releases it when the section comes into view. No observer support, no
 * motion gate or an error: nothing is marked and the section is static and
 * complete. A client-side render never runs it: the intro then plays at
 * mount, which is where a navigation lands anyway.
 */
export const PLAY_WHEN_SEEN_SCRIPT =
  "(function(){try{var s=document.currentScript,r=s&&s.parentElement,h=document.documentElement;" +
  "if(!r||!h.hasAttribute('data-cx-motion')||typeof IntersectionObserver==='undefined')return;" +
  "var v=window.innerHeight||h.clientHeight;if(r.getBoundingClientRect().top<v*0.9)return;" +
  "r.setAttribute('data-cx-wait','');var io=new IntersectionObserver(function(es){for(var i=0;i<es.length;i++){" +
  "if(es[i].isIntersecting){r.removeAttribute('data-cx-wait');io.disconnect();return}}},{rootMargin:'0px 0px -18% 0px'});" +
  'io.observe(r)}catch(e){}})()';

export function PlayWhenSeen() {
  return <script dangerouslySetInnerHTML={{ __html: PLAY_WHEN_SEEN_SCRIPT }} />;
}

/** Delay of an intro step, as the inline variable the shared intro rules read. */
export const at = (seconds: number): CSSProperties => ({ '--cx-delay': `${seconds}s` }) as CSSProperties;

export interface HeroCta {
  text: string;
  url: unknown;
  secondaryText: string;
  secondaryUrl: unknown;
  tone: unknown;
}

/** The two pill buttons of a hero, each rising in on its own beat. */
export function HeroButtons({
  cta,
  locale,
  primaryLocale,
  delay,
  className,
}: {
  cta: HeroCta;
  locale: string;
  primaryLocale: string;
  /** Intro delay of the first button in seconds; the second follows 0.1 s later. */
  delay: number;
  className: string;
}) {
  if (!cta.text && !cta.secondaryText) return null;
  const tone = cta.tone === 'accent' ? 'accent' : 'primary';
  return (
    <div className={className}>
      {cta.text ? (
        <span className="cx-hero-b" data-cx-intro="rise" style={at(delay)}>
          <PillButton href={sectionHref(cta.url, locale, primaryLocale)} tone={tone}>
            {cta.text}
          </PillButton>
        </span>
      ) : null}
      {cta.secondaryText ? (
        <span className="cx-hero-b" data-cx-intro="rise" style={at(delay + 0.1)}>
          <PillButton href={sectionHref(cta.secondaryUrl, locale, primaryLocale)} variant="outline" arrow={false}>
            {cta.secondaryText}
          </PillButton>
        </span>
      ) : null}
    </div>
  );
}
