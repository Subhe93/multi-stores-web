// Section "hero-sunrise": the owner's own artwork rises into place on load.
// Two uploaded layers make the scene: the rising artwork (a sun, a symbol,
// optionally its rays as a separate image) and a foreground it rises from
// behind (a ridge along the bottom of the section, or an emblem drawn in the
// same square box as the artwork and registered with it). An optional photo
// card sits beside the copy.
//
// Motion (behind the gate of css/base.css.ts; without it the scene is at
// rest and complete): a soft light blooms, the artwork rises from behind the
// foreground while light rays open around it, then the eyebrow, the heading
// (line by line, through masks), the text and the buttons follow. The intro
// is CSS only and waits until the section is seen when it starts below the
// first screen. After hydration `scrub` keeps the artwork rising slowly as
// the page scrolls and lets the layers separate in depth (from 768 px).
//
// Every word, image and colour is a setting; the platform ships none.

import { useId, type CSSProperties } from 'react';
import { StoreImage } from '@/components/StoreImage';
import type { SectionRenderProps } from '../../types';
import { Heading } from '../../minimal/sections/_shared/Heading';
import { headingTag } from '../../minimal/sections/_shared/headingLevel';
import { headingLines, multilineStyle } from '../../minimal/sections/_shared/headingLines';
import { accentSize } from '../constants';
import { HERO_SUNRISE_CSS } from '../css/heroSunrise.css';
import { emphasisValue } from '../emphasis';
import { CxSection, EmptyState, Eyebrow, HeadingText } from '../primitives';
import { defineCreativeSection } from '../schemas';
import { at, focusPosition, heroMedia, HeroButtons, hexColor, PlayWhenSeen, scriptOf, str, unoptimized } from './heroShared';

const KEY = 'hero-sunrise';
const POSITIONS = ['start', 'center', 'end', 'seam'] as const;

/** One artwork layer filling its box (decorative). */
function Art({ src, sizes }: { src: string; sizes: string }) {
  return (
    <StoreImage src={src} alt="" fill sizes={sizes} unoptimized={unoptimized(src)} style={{ objectFit: 'contain' }} />
  );
}

function HeroSunrise({ settings, content, locale, primaryLocale, pathPrefix, builderPreview, motion }: SectionRenderProps) {
  const headingId = useId();
  const heading = headingLines(content.heading);
  const core = heroMedia(settings.sun_core);
  const rays = heroMedia(settings.sun_rays);
  const foreground = heroMedia(settings.foreground);
  const photo = heroMedia(settings.image);
  if (!heading && !core && !photo) return builderPreview ? <EmptyState name={KEY} /> : null;

  const eyebrow = str(content.eyebrow);
  const subheading = str(content.subheading);
  const mode = settings.foreground_mode === 'emblem' ? 'emblem' : 'ridge';
  const requested = (POSITIONS as readonly string[]).includes(settings.sun_position as string)
    ? (settings.sun_position as string)
    : 'center';
  // The seam needs a photo corner to sit on.
  const position = requested === 'seam' && !photo ? 'center' : requested;
  const plate = settings.plate === 'disc';
  const glow = settings.glow !== false;
  const raysMotion = settings.rays_motion === 'pulse' ? 'pulse' : settings.rays_motion === 'none' ? 'none' : 'rotate';
  const parallax = settings.scroll_parallax !== false;
  const emblemForeground = mode === 'emblem' && !!foreground;
  const ridge = mode === 'ridge' && !!foreground;
  const hasSun = !!(core || rays || emblemForeground);
  const priority = motion !== 'scroll';
  const size = accentSize(settings.sun_size);
  const sunSizes = size === 'sm' ? '(min-width: 1024px) 280px, 46vw' : '(min-width: 1024px) 420px, 62vw';

  const vars: Record<string, string> = {};
  const glowColor = hexColor(settings.glow_color);
  const plateColor = hexColor(settings.plate_color);
  if (glowColor) vars['--cx-hs-glow'] = glowColor;
  if (plateColor) vars['--cx-hs-plate'] = plateColor;

  // Scroll depth of each layer (percent of its own height, degrees for rotation).
  const depth = (value: string): string | undefined => (parallax ? value : undefined);

  const sun = hasSun ? (
    <div className="cx-hs-sun" aria-hidden="true">
      <div className="cx-hs-px" data-cx-y={mode === 'emblem' ? depth('-8') : undefined}>
        {glow ? (
          <div className="cx-hs-glow" data-cx-rotate={depth('25')}>
            <div className="cx-hs-glow-a" data-cx-loop="" />
            <div className="cx-hs-beams">
              <div className="cx-hs-beams-a">
                <div className="cx-hs-beams-l" data-cx-loop="" />
              </div>
            </div>
          </div>
        ) : null}
        {rays ? (
          <div className="cx-hs-px cx-hs-rays" data-cx-rotate={depth('25')}>
            <div className="cx-hs-rays-a">
              <div className="cx-hs-rays-l" data-cx-loop="">
                <Art src={rays} sizes={sunSizes} />
              </div>
            </div>
          </div>
        ) : null}
        {plate ? <div className="cx-hs-plate" /> : null}
        <div className="cx-hs-disc">
          {core ? (
            <div className="cx-hs-px" data-cx-y={depth(mode === 'emblem' ? '-5' : '-22')}>
              <div className="cx-hs-core-a">
                <Art src={core} sizes={sunSizes} />
              </div>
            </div>
          ) : null}
          {emblemForeground ? (
            <div className="cx-hs-px" data-cx-y={depth('3')}>
              <div className="cx-hs-fg-a">
                <Art src={foreground} sizes={sunSizes} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <CxSection
      name={KEY}
      css={HERO_SUNRISE_CSS}
      className="cx-hs"
      scene={settings.scene ?? 'light'}
      sceneBg={settings.scene_bg}
      sceneText={settings.scene_text}
      sceneAccent={settings.scene_accent}
      style={vars as CSSProperties}
      aria-labelledby={heading ? headingId : undefined}
      data-cx-mode={mode}
      data-cx-pos={position}
      data-cx-size={size}
      data-cx-photo={photo ? '' : undefined}
      data-cx-ridge={ridge ? (settings.foreground_height === 'sm' ? 'sm' : 'md') : undefined}
      data-cx-rays={raysMotion}
      data-cx-order={settings.mobile_order === 'text-first' ? 'text' : undefined}
      data-cx-behavior={parallax ? 'scrub' : undefined}
    >
      <div className="cx-hs-in">
        <div className="cx-hs-copy">
          <Eyebrow text={eyebrow} intro className="cx-hs-eb" />
          {heading ? (
            <Heading
              level={headingTag(settings.heading_level, 'h1')}
              id={headingId}
              className="cx-hs-h"
              data-cx-script={scriptOf(heading)}
              style={multilineStyle(heading)}
            >
              <HeadingText
                text={heading}
                reveal="intro"
                byLine
                delay={1.05}
                emphasis={emphasisValue(settings.heading_emphasis, 'italic')}
                emphasisColor={hexColor(settings.heading_emphasis_color)}
              />
            </Heading>
          ) : null}
          {subheading ? (
            <p className="cx-hs-sub" data-cx-intro="rise" style={at(1.45)}>
              {subheading}
            </p>
          ) : null}
          <HeroButtons
            className="cx-hs-btns"
            delay={1.6}
            locale={locale}
            primaryLocale={primaryLocale}
            pathPrefix={pathPrefix}
            cta={{
              text: str(content.cta_text),
              url: settings.cta_url,
              secondaryText: str(content.cta_secondary_text),
              secondaryUrl: settings.cta_secondary_url,
              tone: settings.cta_tone,
            }}
          />
        </div>

        {photo || sun ? (
          <div className="cx-hs-art">
            {photo ? (
              <div className="cx-hs-figure">
                {sun}
                <div className="cx-hs-card">
                  <div className="cx-hs-px" data-cx-y={depth('-4')}>
                    <div className="cx-hs-card-a">
                      <StoreImage
                        src={photo}
                        alt={str(content.alt)}
                        fill
                        priority={priority}
                        sizes="(min-width: 1024px) 34vw, 90vw"
                        unoptimized={unoptimized(photo)}
                        style={{ objectFit: 'cover', objectPosition: focusPosition(settings.image_focus) }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              sun
            )}
          </div>
        ) : null}
      </div>

      {ridge ? (
        <div className="cx-hs-ridge" aria-hidden="true">
          <div className="cx-hs-px" data-cx-y={depth('10')}>
            <div className="cx-hs-ridge-a">
              <StoreImage
                src={foreground}
                alt=""
                fill
                sizes="100vw"
                unoptimized={unoptimized(foreground)}
                style={{ objectFit: 'fill', objectPosition: 'center bottom' }}
              />
            </div>
          </div>
        </div>
      ) : null}
      <PlayWhenSeen />
    </CxSection>
  );
}

export const heroSunriseSection = defineCreativeSection(KEY, HeroSunrise);
