// Section "stage-scenes": one uploaded artwork (a cut-out product or a
// symbol) stays on stage across two to five colour scenes. While the page
// scrolls it travels to the next scene's slot, turns slightly, scales and
// changes side (behaviour "actor", engine/behaviors/actor.ts, GSAP
// ScrollTrigger through the lazy engine; 2D transforms only).
//
// The markup is the complete static page: every scene carries its own
// in-flow image in its slot (same proportions, same tilt), so phones, touch
// screens, reduced motion, store motion off, the builder, no JavaScript and
// a failed chunk all show stacked colour scenes with the artwork in each.
// Only on a desktop with a fine pointer, behind the motion gate, the sticky
// actor layer appears; the behaviour measures the slots, places the artwork
// over the first one and only then marks the stage live (the slot images
// hide, nothing shifts).
//
// Every word, image and colour is a setting; the platform ships none.

import { useId, type CSSProperties } from 'react';
import { StoreImage } from '@/components/StoreImage';
import type { SectionRenderProps } from '../../types';
import { Heading } from '../../minimal/sections/_shared/Heading';
import { headingTag } from '../../minimal/sections/_shared/headingLevel';
import { headingLines, multilineStyle } from '../../minimal/sections/_shared/headingLines';
import { sectionHref } from '../../minimal/sections/_shared/links';
import { accentSize } from '../constants';
import { STAGE_SCENES_CSS } from '../css/stageScenes.css';
import { Pattern } from '../decor/Pattern';
import { emphasisValue } from '../emphasis';
import { CxSection, EmptyState, Eyebrow, HeadingText, PillButton } from '../primitives';
import { sceneProps, sceneValue } from '../scene';
import { defineCreativeSection } from '../schemas';
import { heroMedia, hexColor, scriptOf, str, unoptimized } from './heroShared';

const KEY = 'stage-scenes';
const MAX_SCENES = 5;
const SIDES = ['start', 'end'] as const;
const TILTS = ['none', 'soft', 'strong'] as const;
const SHAPES = ['circle', 'arch', 'blob'] as const;
const PATTERNS = ['dots', 'particles'] as const;

interface Scene {
  scene: string;
  bg: string;
  side: 'start' | 'end';
  tilt: string;
  scale: 'sm' | 'md';
  view: '1' | '2';
  shape?: string;
  shapeColor?: string;
  pattern?: 'dots' | 'particles';
  eyebrow: string;
  heading: string;
  lead: string;
  text: string;
  chips: string[];
  bullets: string[];
  ctaText: string;
  ctaUrl: unknown;
  ctaSecondaryText: string;
  ctaSecondaryUrl: unknown;
}

const pick = <T extends string>(list: readonly T[], raw: unknown): T | undefined =>
  (list as readonly string[]).includes(raw as string) ? (raw as T) : undefined;

/** The stored repeater as clean scenes; an entry with no words is dropped. */
export function readScenes(raw: unknown): Scene[] {
  if (!Array.isArray(raw)) return [];
  const out: Scene[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const heading = headingLines(item.heading);
    const eyebrow = str(item.eyebrow);
    const text = str(item.text);
    const lead = str(item.lead);
    if (!heading && !eyebrow && !text && !lead) continue;
    const index = out.length;
    out.push({
      scene: sceneValue(item.scene) ?? 'dark',
      bg: str(item.scene_bg),
      // Alternate: end, start, end … (the copy takes the other side).
      side: pick(SIDES, item.side) ?? (index % 2 === 0 ? 'end' : 'start'),
      tilt: pick(TILTS, item.tilt) ?? 'soft',
      scale: item.scale === 'sm' ? 'sm' : 'md',
      view: item.view === '2' ? '2' : '1',
      shape: pick(SHAPES, item.shape),
      shapeColor: hexColor(item.shape_color),
      pattern: pick(PATTERNS, item.pattern),
      eyebrow,
      heading,
      lead,
      text,
      // Latin and Arabic commas both separate chips.
      chips: str(item.chips)
        .split(/[,،]/)
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 3),
      bullets: str(item.bullets)
        .split('\n')
        .map((b) => b.trim())
        .filter(Boolean)
        .slice(0, 4),
      ctaText: str(item.cta_text),
      ctaUrl: item.cta_url,
      ctaSecondaryText: str(item.cta_secondary_text),
      ctaSecondaryUrl: item.cta_secondary_url,
    });
    if (out.length === MAX_SCENES) break;
  }
  return out;
}

const SIZES = '(min-width: 1024px) 34vw, 80vw';

function StageScenes({ settings, content, locale, primaryLocale, builderPreview, motion }: SectionRenderProps) {
  const baseId = useId();
  const scenes = readScenes(content.scenes);
  if (!scenes.length) return builderPreview ? <EmptyState name={KEY} /> : null;

  const artwork = heroMedia(settings.artwork);
  const artwork2 = heroMedia(settings.artwork_2);
  const marker = heroMedia(settings.marker_image);
  const alt = str(content.artwork_alt);
  const emphasis = emphasisValue(settings.heading_emphasis, 'italic');
  const emphasisColor = hexColor(settings.heading_emphasis_color);
  // The travelling actor needs an artwork and at least two scenes.
  const live = !!artwork && scenes.length >= 2;
  const viewSrc = (view: '1' | '2') => (view === '2' && artwork2 ? artwork2 : artwork);

  return (
    <CxSection
      name={KEY}
      css={STAGE_SCENES_CSS}
      className="cx-ss"
      data-cx-size={accentSize(settings.artwork_size)}
      data-cx-aspect={settings.artwork_aspect === 'square' ? 'square' : 'portrait'}
      data-cx-height={settings.scene_height === 'md' ? 'md' : 'lg'}
      data-cx-float={settings.float === false ? undefined : ''}
    >
      <div className="cx-ss-stage" data-cx-behavior={live ? 'actor' : undefined}>
        {live ? (
          // The track spans the whole stage, so the sticky layer inside it
          // stops with the last scene.
          <div className="cx-ss-track" aria-hidden="true">
          <div className="cx-ss-actor">
            <div className="cx-ss-actor-o">
              <div className="cx-ss-actor-i" data-cx-loop="">
                <div className="cx-ss-view" data-cx-view="1">
                  <StoreImage src={artwork} alt="" fill sizes={SIZES} unoptimized={unoptimized(artwork)} style={{ objectFit: 'contain' }} />
                </div>
                {artwork2 ? (
                  <div className="cx-ss-view" data-cx-view="2">
                    <StoreImage
                      src={artwork2}
                      alt=""
                      fill
                      sizes={SIZES}
                      unoptimized={unoptimized(artwork2)}
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          </div>
        ) : null}

        {scenes.map((scene, i) => {
          const headingId = `${baseId}-${i}`;
          const sp = sceneProps(sceneValue(scene.scene), { bg: scene.bg });
          const src = viewSrc(scene.view);
          let step = 0;
          const rise = () => ({ 'data-cx-reveal': 'rise', style: { '--cx-i': step++ } as CSSProperties });
          return (
            <section
              key={i}
              className="cx-ss-scene"
              data-cx-scene={sp['data-cx-scene']}
              style={sp.style}
              data-cx-side={scene.side}
              aria-labelledby={scene.heading ? headingId : undefined}
            >
              <div className="cx-ss-grid">
                <div className="cx-ss-copy">
                  {scene.eyebrow ? (
                    <div {...rise()}>
                      <Eyebrow text={scene.eyebrow} />
                    </div>
                  ) : null}
                  {scene.heading ? (
                    <Heading
                      level={i === 0 ? headingTag(settings.heading_level, 'h2') : 'h2'}
                      id={headingId}
                      className="cx-ss-h"
                      data-cx-script={scriptOf(scene.heading)}
                      style={multilineStyle(scene.heading)}
                    >
                      <HeadingText text={scene.heading} reveal="scroll" emphasis={emphasis} emphasisColor={emphasisColor} />
                    </Heading>
                  ) : null}
                  {scene.lead ? (
                    <p className="cx-ss-lead" data-cx-script={scriptOf(scene.lead)} {...rise()}>
                      {scene.lead}
                    </p>
                  ) : null}
                  {scene.text ? (
                    <p className="cx-ss-text" {...rise()}>
                      {scene.text}
                    </p>
                  ) : null}
                  {scene.chips.length ? (
                    <ul className="cx-ss-chips" {...rise()}>
                      {scene.chips.map((chip, c) => (
                        <li key={c} data-cx-script={scriptOf(chip)}>
                          {chip}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {scene.bullets.length ? (
                    <ul className="cx-ss-bullets" data-cx-marker={marker ? 'image' : 'dot'} {...rise()}>
                      {scene.bullets.map((bullet, b) => (
                        <li key={b}>
                          {marker ? (
                            <span className="cx-ss-mark" aria-hidden="true">
                              <StoreImage src={marker} alt="" width={16} height={16} sizes="16px" unoptimized={unoptimized(marker)} />
                            </span>
                          ) : null}
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {scene.ctaText || scene.ctaSecondaryText ? (
                    <div className="cx-ss-btns" {...rise()}>
                      {scene.ctaText ? (
                        <PillButton href={sectionHref(scene.ctaUrl, locale, primaryLocale)}>{scene.ctaText}</PillButton>
                      ) : null}
                      {scene.ctaSecondaryText ? (
                        <PillButton
                          href={sectionHref(scene.ctaSecondaryUrl, locale, primaryLocale)}
                          variant="outline"
                          arrow={false}
                        >
                          {scene.ctaSecondaryText}
                        </PillButton>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div
                  className="cx-ss-slot"
                  data-cx-slot=""
                  data-cx-side={scene.side}
                  data-cx-tilt={scene.tilt}
                  data-cx-scale={scene.scale}
                  data-cx-view={scene.view}
                >
                  {scene.pattern ? (
                    <div className="cx-ss-pat" aria-hidden="true">
                      <Pattern kind={scene.pattern} />
                    </div>
                  ) : null}
                  {scene.shape ? (
                    <div
                      className="cx-ss-shape"
                      aria-hidden="true"
                      data-cx-shape={scene.shape}
                      data-cx-reveal="fade"
                      style={scene.shapeColor ? ({ '--cx-ss-shape': scene.shapeColor } as CSSProperties) : undefined}
                    />
                  ) : null}
                  {src ? (
                    <div className="cx-ss-media">
                      <StoreImage
                        src={src}
                        alt={i === 0 ? alt : ''}
                        fill
                        sizes={SIZES}
                        priority={i === 0 && motion !== 'scroll'}
                        unoptimized={unoptimized(src)}
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </CxSection>
  );
}

export const stageScenesSection = defineCreativeSection(KEY, StageScenes);
