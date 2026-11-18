// Section "motion-path" (contract 4.6): stops along a drawn vertical line; a
// small artwork travels down the line as the page scrolls and the trail
// fills behind it.
//
// The markup below is the complete static page: line and trail fully drawn,
// the artwork parked at the end, every card visible. The `path` behaviour
// (engine/behaviors/path.ts) only takes over after it has measured
// everything (data-cx-live). Synchronous and client-safe: it also renders
// inside the client builder preview.

import { useId, type CSSProperties } from 'react';
import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import type { SectionRenderProps } from '../../types';
import { Heading } from '../../minimal/sections/_shared/Heading';
import { headingTag } from '../../minimal/sections/_shared/headingLevel';
import { headingLines, multilineStyle } from '../../minimal/sections/_shared/headingLines';
import { FOCUS_RING, sectionHref } from '../../minimal/sections/_shared/links';
import { accentSize } from '../constants';
import { MOTION_PATH_CSS } from '../css/motionPath.css';
import { patternColor } from '../decor/Pattern';
import { emphasisValue, isArabicScript } from '../emphasis';
import { CxSection, EmptyState, Eyebrow, HeadingText } from '../primitives';
import { defineCreativeSection } from '../schemas';
import { buildPath, pathShape, pathStyle, PATH_MAX_STOPS, type PathGeometry } from './pathPresets';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

interface Stop {
  label: string;
  title: string;
  text: string;
  image: string;
  imageAlt: string;
  ctaText: string;
  ctaUrl: string;
}

/** The stored repeater as clean stops; an entry with nothing to show is dropped. */
function readStops(raw: unknown): Stop[] {
  if (!Array.isArray(raw)) return [];
  const stops: Stop[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const stop: Stop = {
      label: str(item.label),
      title: str(item.title),
      text: str(item.text),
      image: str(item.image),
      imageAlt: str(item.image_alt),
      ctaText: str(item.cta_text),
      ctaUrl: str(item.cta_url),
    };
    if (!stop.label && !stop.title && !stop.text && !stop.image) continue;
    stops.push(stop);
    if (stops.length === PATH_MAX_STOPS) break;
  }
  return stops;
}

// Travelling artwork box in px (the two sizes of the schema).
const ARTWORK_PX = { sm: 40, md: 64 } as const;

/** One layer of the line: the plain vertical line and, from 1024 px, the chosen shape. */
function PathSvg({ geometry, shaped }: { geometry: PathGeometry; shaped: boolean }) {
  return (
    <svg
      className="cx-mp-svg"
      viewBox={geometry.viewBox}
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className="cx-mp-p cx-mp-p-line" d={geometry.line} vectorEffect="non-scaling-stroke" />
      {shaped ? <path className="cx-mp-p cx-mp-p-shape" d={geometry.d} vectorEffect="non-scaling-stroke" /> : null}
    </svg>
  );
}

function MotionPath({ settings, content, locale, primaryLocale, builderPreview }: SectionRenderProps) {
  const headingId = useId();
  const heading = headingLines(content.heading);
  const eyebrow = str(content.eyebrow);
  const subheading = str(content.subheading);
  const stops = readStops(content.stops);

  // Nothing on the live store; a dashed placeholder in the builder only.
  if (!heading && !eyebrow && !subheading && !stops.length) {
    return builderPreview ? <EmptyState name="motion-path" /> : null;
  }

  const shape = pathShape(settings.path_shape);
  const style = pathStyle(settings.path_style);
  const sticky = settings.heading_position === 'sticky';
  // Beside a sticky heading the cards always use one side.
  const layout = sticky || settings.cards_side === 'one-side' ? 'side' : 'alternate';
  const geometry = buildPath(shape, stops.length);
  const shaped = shape !== 'straight';

  const size = accentSize(settings.artwork_size);
  const artworkSrc = resolveMediaUrl(str(settings.artwork));
  const rotate = settings.artwork_rotate === true;
  const flip = settings.artwork_flip_rtl === true;

  const vars: Record<string, string | number> = {
    '--cx-n': stops.length,
    '--cx-mp-art': `${ARTWORK_PX[size]}px`,
  };
  const pathColor = patternColor(settings.path_color);
  const trailColor = patternColor(settings.trail_color);
  const markerColor = patternColor(settings.marker_color);
  if (pathColor) vars['--cx-mp-path'] = pathColor;
  if (trailColor) vars['--cx-mp-trail'] = trailColor;
  if (markerColor) vars['--cx-mp-marker'] = markerColor;

  const hasHead = !!(heading || eyebrow || subheading);

  return (
    <CxSection
      name="motion-path"
      css={MOTION_PATH_CSS}
      className="cx-mp"
      scene={settings.scene}
      sceneBg={settings.scene_bg}
      sceneText={settings.scene_text}
      sceneAccent={settings.scene_accent}
      aria-labelledby={heading ? headingId : undefined}
    >
      <div className="cx-mp-in" data-cx-head={sticky ? 'sticky' : 'above'} data-cx-layout={layout}>
        {hasHead ? (
          <div className="cx-mp-head">
            <Eyebrow text={eyebrow} />
            {heading ? (
              <Heading
                level={headingTag(settings.heading_level, 'h2')}
                id={headingId}
                className="cx-mp-heading"
                style={{
                  fontFamily: 'var(--theme-font-heading)',
                  fontSize: 'var(--theme-scale-h2)',
                  fontWeight: 'var(--theme-weight-heading)',
                  lineHeight: 'var(--theme-line-heading)',
                  ...multilineStyle(heading),
                }}
              >
                <HeadingText
                  text={heading}
                  reveal="scroll"
                  emphasis={emphasisValue(settings.heading_emphasis, 'italic')}
                  emphasisColor={patternColor(settings.heading_emphasis_color)}
                />
              </Heading>
            ) : null}
            {subheading ? (
              <p className="cx-mp-sub" data-cx-reveal="rise" style={{ '--cx-delay': '.15s' } as CSSProperties}>
                {subheading}
              </p>
            ) : null}
          </div>
        ) : null}

        {stops.length ? (
          <div
            className="cx-mp-body"
            data-cx-behavior={geometry ? 'path' : undefined}
            data-cx-style={style}
            data-cx-shaped={geometry && shaped ? '' : undefined}
            data-cx-rotate={rotate ? '' : undefined}
            style={vars as CSSProperties}
          >
            {geometry ? (
              <div className="cx-mp-rail" aria-hidden="true">
                <div className="cx-mp-layer cx-mp-base">
                  <PathSvg geometry={geometry} shaped={shaped} />
                </div>
                <div className="cx-mp-layer cx-mp-trail">
                  <PathSvg geometry={geometry} shaped={shaped} />
                </div>
                {/* Outer box: moved by the behaviour. Inner: turned by it. Innermost: the CSS mirror. */}
                <div className="cx-mp-art">
                  <div className="cx-mp-art-in">
                    {artworkSrc ? (
                      <div className="cx-mp-art-img" data-cx-flip={flip ? '' : undefined}>
                        <StoreImage
                          src={artworkSrc}
                          alt=""
                          width={ARTWORK_PX[size]}
                          height={ARTWORK_PX[size]}
                          sizes={`${ARTWORK_PX[size]}px`}
                          unoptimized={isSvgSrc(artworkSrc)}
                          style={{ inlineSize: '100%', blockSize: '100%', objectFit: 'contain' }}
                        />
                      </div>
                    ) : (
                      <div className="cx-mp-bead" />
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <ol className="cx-mp-stops">
              {stops.map((stop, i) => {
                const image = resolveMediaUrl(stop.image);
                const side = layout === 'alternate' && i % 2 === 0 ? 'start' : 'end';
                return (
                  <li className="cx-mp-stop" data-cx-side={side} key={i}>
                    <div className="cx-mp-dot" aria-hidden="true" />
                    <div className="cx-mp-card">
                      {image ? (
                        <div className="cx-mp-media">
                          <StoreImage
                            src={image}
                            alt={stop.imageAlt}
                            fill
                            sizes="(min-width: 1024px) 26rem, 80vw"
                            unoptimized={isSvgSrc(image)}
                            style={{ objectFit: 'cover' }}
                          />
                        </div>
                      ) : null}
                      {stop.label ? (
                        <p className="cx-mp-label" data-cx-script={isArabicScript(stop.label) ? 'arabic' : undefined}>
                          {stop.label}
                        </p>
                      ) : null}
                      {stop.title ? <h3 className="cx-mp-title">{stop.title}</h3> : null}
                      {stop.text ? <p className="cx-mp-text">{stop.text}</p> : null}
                      {stop.ctaText && stop.ctaUrl ? (
                        <a className={`cx-mp-link ${FOCUS_RING}`} href={sectionHref(stop.ctaUrl, locale, primaryLocale)}>
                          {stop.ctaText}
                          <svg
                            className="cx-mp-arrow"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            focusable="false"
                          >
                            <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />
                          </svg>
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </div>
    </CxSection>
  );
}

export const motionPathSection = defineCreativeSection('motion-path', MotionPath);
