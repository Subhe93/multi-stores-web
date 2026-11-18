// Section "sticky-steps": a heading that stays in view (plain CSS sticky, from
// 1024 px) beside a numbered list of steps with a progress line. The static
// page shows the line full and every step at full strength; the `steps`
// behaviour ties the line and the steps to the scroll position.
//
// Synchronous and client-safe: it also renders inside the builder preview.

import { useId, type CSSProperties } from 'react';
import type { SectionRenderProps } from '../../types';
import { Heading } from '../../minimal/sections/_shared/Heading';
import { headingTag } from '../../minimal/sections/_shared/headingLevel';
import { headingLines, multilineStyle } from '../../minimal/sections/_shared/headingLines';
import { sectionHref } from '../../minimal/sections/_shared/links';
import { accentSize } from '../constants';
import { STICKY_STEPS_CSS } from '../css/stickySteps.css';
import { emphasisValue } from '../emphasis';
import { CxSection, EmptyState, Eyebrow, HeadingText, Numeral, PillButton } from '../primitives';
import { defineCreativeSection } from '../schemas';

const MAX_ITEMS = 8;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

interface Step {
  title: string;
  text: string;
}

function readSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw)) return [];
  const steps: Step[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const step = { title: str(o.title), text: str(o.text) };
    if (!step.title && !step.text) continue;
    steps.push(step);
    if (steps.length === MAX_ITEMS) break;
  }
  return steps;
}

function StickySteps({ settings, content, locale, primaryLocale, builderPreview }: SectionRenderProps) {
  const headingId = useId();
  const heading = headingLines(content.heading);
  const eyebrow = str(content.eyebrow);
  const subheading = str(content.subheading);
  const ctaText = str(content.cta_text);
  const steps = readSteps(content.items ?? settings.items);

  // Nothing on the live store; a dashed placeholder in the builder only.
  if (!steps.length) return builderPreview ? <EmptyState name="sticky-steps" /> : null;

  const numeralStyle =
    settings.numeral_style === 'solid' || settings.numeral_style === 'none' ? settings.numeral_style : 'outline';
  // sm / md only: anything else stored reads as md.
  const numeralSize = accentSize(settings.numeral_size);
  const line = settings.progress_line !== false;
  const side = settings.heading_side === 'end' ? 'end' : 'start';
  const spacing = settings.spacing === 'sm' ? 'sm' : 'md';
  const accent = str(settings.accent_color);
  const hasHead = Boolean(heading || eyebrow || subheading || ctaText);

  return (
    <CxSection
      name="sticky-steps"
      css={STICKY_STEPS_CSS}
      scene={settings.scene}
      sceneBg={settings.scene_bg}
      sceneText={settings.scene_text}
      sceneAccent={settings.scene_accent}
      className="cx-st"
      style={accent ? ({ '--cx-st-ac': accent } as CSSProperties) : undefined}
      aria-labelledby={heading ? headingId : undefined}
      data-cx-side={side}
      data-cx-spacing={spacing}
    >
      <div className="cx-st-in" data-cx-solo={hasHead ? undefined : ''}>
        {hasHead && (
          <div className="cx-st-head">
            {eyebrow && (
              <div data-cx-reveal="fade">
                <Eyebrow text={eyebrow} color={accent || undefined} />
              </div>
            )}
            {heading && (
              <Heading
                level={headingTag(settings.heading_level, 'h2')}
                id={headingId}
                className="cx-st-h"
                style={{
                  fontFamily: 'var(--theme-font-heading)',
                  fontSize: 'var(--theme-scale-h2)',
                  fontWeight: 'var(--theme-weight-heading)',
                  lineHeight: 'var(--theme-line-heading)',
                  letterSpacing: 'var(--theme-tracking-heading)',
                  ...multilineStyle(heading),
                }}
              >
                <HeadingText
                  text={heading}
                  reveal="scroll"
                  emphasis={emphasisValue(settings.heading_emphasis, 'italic')}
                  emphasisColor={str(settings.heading_emphasis_color) || accent || undefined}
                />
              </Heading>
            )}
            {subheading && (
              <p className="cx-st-sub" data-cx-reveal="rise" style={{ '--cx-delay': '.15s' } as CSSProperties}>
                {subheading}
              </p>
            )}
            {ctaText && (
              <div className="cx-st-cta" data-cx-reveal="rise" style={{ '--cx-delay': '.25s' } as CSSProperties}>
                <PillButton href={sectionHref(settings.cta_url, locale, primaryLocale)}>{ctaText}</PillButton>
              </div>
            )}
          </div>
        )}
        <ol
          className="cx-st-list"
          data-cx-behavior="steps"
          data-cx-line={line ? '' : undefined}
          data-cx-nsize={numeralStyle === 'none' ? 'none' : numeralSize}
        >
          {steps.map((step, i) => (
            <li key={i} className="cx-st-step" data-cx-reveal="rise">
              <span className="cx-st-dot" aria-hidden="true" />
              {/* Inner layer: the behaviour dims it; the reveal owns the <li>. */}
              <div className="cx-st-c">
                {numeralStyle !== 'none' && <Numeral n={i + 1} look={numeralStyle} size={numeralSize} />}
                <div className="cx-st-tx">
                  {step.title && <h3 className="cx-st-title">{step.title}</h3>}
                  {step.text && <p className="cx-st-text">{step.text}</p>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </CxSection>
  );
}

export const stickyStepsSection = defineCreativeSection('sticky-steps', StickySteps);
