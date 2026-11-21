// Section "hero-outline": a hero built around one cut-out (a person or a
// product) with the store's word drawn as a thin OUTLINE behind it, a soft
// halo of dots, rings or light in the brand colours, and the copy beside it.
//
// Owner rule: the word is a refined accent at a small or medium size, never
// a screen-filling word.
//
// Motion (behind the gate of css/base.css.ts, so no JavaScript, reduced
// motion, store motion off and the builder all show the finished hero):
// the halo blooms and then breathes slowly, the photo rises from its
// baseline and settles, the strokes of the word draw in letter by letter,
// the heading enters line by line through masks, then the text and the
// buttons. The intro is CSS only and starts with the first paint; below the
// first screen it waits until the section is seen (PlayWhenSeen). After
// hydration the `scrub` behaviour separates word, photo and halo in depth
// while the page scrolls (from 768 px) and `pointer` lets them follow the
// mouse a little (fine pointers).
//
// Every word, image and colour is a setting; the platform ships none.

import { useId, type CSSProperties } from 'react';
import { StoreImage } from '@/components/StoreImage';
import type { SectionRenderProps } from '../../types';
import { Heading } from '../../minimal/sections/_shared/Heading';
import { headingTag } from '../../minimal/sections/_shared/headingLevel';
import { headingLines, multilineStyle } from '../../minimal/sections/_shared/headingLines';
import { accentSize } from '../constants';
import { HERO_OUTLINE_CSS } from '../css/heroOutline.css';
import { emphasisValue, isArabicScript } from '../emphasis';
import { CxSection, EmptyState, Eyebrow, HeadingText } from '../primitives';
import { defineCreativeSection } from '../schemas';
import { at, focusPosition, heroMedia, HeroButtons, hexColor, PlayWhenSeen, scriptOf, str, unoptimized } from './heroShared';

const KEY = 'hero-outline';

interface Stat {
  label: string;
  value: string;
}

function readStats(raw: unknown): Stat[] {
  if (!Array.isArray(raw)) return [];
  const out: Stat[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const stat = { label: str(item.label), value: str(item.value) };
    if (!stat.value && !stat.label) continue;
    out.push(stat);
    if (out.length === 3) break;
  }
  return out;
}

const HALOS = ['dots', 'glow', 'rings'] as const;
const SHAPES = ['circle', 'arch'] as const;

/**
 * The outline word as an SVG text: its strokes can be drawn (a CSS text
 * stroke cannot). Latin letters are separate tspans so they draw one after
 * the other; Arabic stays one run (its letters join) and is a faint fill.
 */
function OutlineWord({ text, look }: { text: string; look: 'outline' | 'faint' }) {
  const arabic = isArabicScript(text);
  const word = arabic ? text : text.toUpperCase();
  const letters = arabic ? [word] : Array.from(word);
  return (
    <svg className="cx-ho-svg" aria-hidden="true" focusable="false" data-cx-look={arabic ? 'faint' : look}>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        direction={arabic ? 'rtl' : 'ltr'}
        data-cx-script={arabic ? 'arabic' : undefined}
      >
        {letters.map((letter, i) => (
          <tspan key={i} className="cx-ho-l" style={{ '--cx-l': i } as CSSProperties}>
            {letter}
          </tspan>
        ))}
      </text>
    </svg>
  );
}

function HeroOutline({ settings, content, locale, primaryLocale, pathPrefix, builderPreview, motion }: SectionRenderProps) {
  const headingId = useId();
  const heading = headingLines(content.heading);
  const image = heroMedia(settings.image);
  if (!heading && !image) return builderPreview ? <EmptyState name={KEY} /> : null;

  const eyebrow = str(content.eyebrow);
  const subheading = str(content.subheading);
  const accentText = str(content.accent_text);
  const accentLook = settings.accent_style === 'faint' ? 'faint' : settings.accent_style === 'none' ? null : 'outline';
  const showWord = !!accentText && accentLook !== null;
  const stats = readStats(content.stats);
  const layout = settings.layout === 'split' ? 'split' : 'center';
  const fit = settings.image_fit === 'cover' ? 'cover' : 'contain';
  const halo = (HALOS as readonly string[]).includes(settings.halo as string) ? (settings.halo as string) : undefined;
  const shape = (SHAPES as readonly string[]).includes(settings.shape as string) ? (settings.shape as string) : undefined;
  const pointer = settings.pointer_parallax !== false;
  // The first section of a page is the LCP candidate; further down the photo loads lazily.
  const priority = motion !== 'scroll';

  const vars: Record<string, string | number> = {};
  const wordColor = hexColor(settings.accent_color);
  const halo1 = hexColor(settings.halo_color_1);
  const halo2 = hexColor(settings.halo_color_2);
  const shapeColor = hexColor(settings.shape_color);
  if (wordColor) vars['--cx-ho-word'] = wordColor;
  if (halo1) vars['--cx-ho-h1'] = halo1;
  if (halo2) vars['--cx-ho-h2'] = halo2;
  if (shapeColor) vars['--cx-ho-shape'] = shapeColor;
  if (showWord) vars['--cx-ho-n'] = Array.from(accentText).length;

  return (
    <CxSection
      name={KEY}
      css={HERO_OUTLINE_CSS}
      className="cx-ho"
      scene={settings.scene}
      sceneBg={settings.scene_bg}
      sceneText={settings.scene_text}
      sceneAccent={settings.scene_accent}
      style={vars as CSSProperties}
      aria-labelledby={heading ? headingId : undefined}
      data-cx-layout={layout}
      data-cx-height={settings.height === 'md' ? 'md' : 'lg'}
      data-cx-fit={fit}
      data-cx-word={showWord ? (settings.accent_position === 'below' ? 'below' : 'behind') : undefined}
      data-cx-wsize={showWord ? accentSize(settings.accent_size) : undefined}
      data-cx-behavior={pointer ? 'scrub pointer' : 'scrub'}
    >
      <div className="cx-ho-in">
        <div className="cx-ho-head">
          <Eyebrow text={eyebrow} intro className="cx-ho-eb" />
          {heading ? (
            <Heading
              level={headingTag(settings.heading_level, 'h1')}
              id={headingId}
              className="cx-ho-h"
              data-cx-script={scriptOf(heading)}
              style={multilineStyle(heading)}
            >
              <HeadingText
                text={heading}
                reveal="intro"
                byLine
                delay={0.25}
                emphasis={emphasisValue(settings.heading_emphasis, 'italic')}
                emphasisColor={hexColor(settings.heading_emphasis_color)}
              />
            </Heading>
          ) : null}
        </div>

        <div className="cx-ho-stage">
          {halo ? (
            <div className="cx-ho-lay cx-ho-halo" aria-hidden="true">
              <div className="cx-ho-px" data-cx-y="-10">
                <div className="cx-ho-px" data-cx-pointer={pointer ? '18' : undefined}>
                  <div className="cx-ho-halo-a" data-cx-halo={halo} data-cx-loop="" />
                </div>
              </div>
            </div>
          ) : null}
          {showWord ? (
            <div className="cx-ho-lay cx-ho-wordl" aria-hidden="true">
              <div className="cx-ho-px" data-cx-x="-36" data-cx-y="14">
                <div className="cx-ho-px" data-cx-pointer={pointer ? '-10' : undefined}>
                  <div className="cx-ho-word-a">
                    <OutlineWord text={accentText} look={accentLook ?? 'outline'} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {shape ? (
            <div className="cx-ho-lay cx-ho-shapel" aria-hidden="true">
              <div className="cx-ho-shape" data-cx-shape={shape} />
            </div>
          ) : null}
          {image ? (
            <div className="cx-ho-lay cx-ho-photol">
              <div className="cx-ho-px" data-cx-y="-5">
                <div className="cx-ho-px" data-cx-pointer={pointer ? '6' : undefined}>
                  <div className="cx-ho-clip">
                    <div className="cx-ho-photo-a">
                      <div className="cx-ho-photo">
                        <StoreImage
                          src={image}
                          alt={str(content.alt)}
                          fill
                          priority={priority}
                          sizes="(min-width: 1024px) 40vw, 90vw"
                          unoptimized={unoptimized(image)}
                          style={{
                            objectFit: fit === 'cover' ? 'cover' : 'contain',
                            objectPosition: fit === 'cover' ? focusPosition(settings.image_focus) : 'center bottom',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {subheading || stats.length || str(content.cta_text) || str(content.cta_secondary_text) ? (
          <div className="cx-ho-aside">
            {subheading ? (
              <p className="cx-ho-sub" data-cx-intro="rise" style={at(0.7)}>
                {subheading}
              </p>
            ) : null}
            <HeroButtons
              className="cx-ho-btns"
              delay={0.82}
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
            {stats.length ? (
              <dl className="cx-ho-stats" data-cx-intro="rise" style={at(1.02)}>
                {stats.map((stat, i) => (
                  <div className="cx-ho-stat" key={i}>
                    <dt data-cx-script={scriptOf(stat.label)}>{stat.label}</dt>
                    <dd>{stat.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}
      </div>
      {settings.scroll_cue === true ? <span className="cx-ho-cue" aria-hidden="true" data-cx-loop="" /> : null}
      <PlayWhenSeen />
    </CxSection>
  );
}

export const heroOutlineSection = defineCreativeSection(KEY, HeroOutline);
