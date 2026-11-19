// Section "impact-arc": a goal drawn as a half circle over a horizon. The
// filled part of the arc is the reached figure (reached / goal), a small
// mark rests where the progress stands, the figure sits inside the arc and
// up to three steps follow under the horizon. A gauge, not a journey: the
// arc fills once to its value, nothing is linked to the scroll position.
//
// Honest states: without a reached figure, or with the status "planned",
// the track is dashed, no progress is drawn and the mark rests at the start.
// Without a goal there is no gauge at all and the steps remain.
//
// Every word, picture and colour is owner content. Artwork is never
// mirrored: in a right-to-left store the arc PATH is generated from the
// other end (impactArcGeometry.ts) and overlay positions are physical
// percentages of the gauge box.
//
// No JavaScript of its own: the markup is the final state (the dash array
// is the real fraction). The reveal comes from the store motion recipes
// through the `motion` prop; without it no reveal attribute is rendered.

import type { CSSProperties } from 'react';
import { StoreImage } from '@/components/StoreImage';
import { isRtl } from '@/i18n/config';
import { resolveMediaUrl } from '@/lib/api';
import { isSvgSrc } from '@/lib/storeMedia';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { Counter } from '../../_motion';
import { sectionHref } from '../../minimal/sections/_shared/links';
import { IMPACT_ARC_CSS } from '../css/impactArc.css';
import { CxSection } from '../primitives/CxSection';
import { EmptyState } from '../primitives/EmptyState';
import { MotionText } from '../primitives/Motion';
import { fade, hover, item, magnetic, rise, stagger } from '../recipes';
import { entry, IMPACT_ARC_MAX_STEPS } from '../schemas/impact-arc.schema';
import { ARC, arcFraction, arcPath, arcPoint, arcTick, goalValue, reachedValue, toPercent } from './impactArcGeometry';
import { formatLocale } from '@/lib/storeLocales';

export const IMPACT_ARC_KEY = 'impact-arc';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Owner image as a usable source; inline `data:image/` artwork passes through. */
function mediaSrc(raw: unknown): string {
  const url = str(raw);
  if (!url) return '';
  return url.startsWith('data:image/') ? url : resolveMediaUrl(url);
}

function numberFormat(locale: string): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(formatLocale(locale));
  } catch {
    return new Intl.NumberFormat('en');
  }
}

type Step = { title: string; text: string };

function stepsOf(raw: unknown): Step[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
      return { title: str(r.title), text: str(r.text) };
    })
    .filter((s) => s.title || s.text)
    .slice(0, IMPACT_ARC_MAX_STEPS);
}

// Marks at 0, 25, 50, 75 and 100 %; the quarter marks are dropped on phones.
const TICKS = [0, 0.25, 0.5, 0.75, 1];

function ImpactArc({ settings, content, locale, primaryLocale, builderPreview, motion }: SectionRenderProps) {
  const m = motion;
  const rtl = isRtl(locale);

  const eyebrow = str(content.eyebrow);
  const heading = str(content.heading);
  const body = str(content.body);
  const statusLabel = str(content.status_label);
  const unitLabel = str(content.unit_label);
  const itemTitle = str(content.item_title);
  const itemMeta = str(content.item_meta);
  const note = str(content.note);
  const ctaText = str(content.cta_text);
  const steps = stepsOf(content.steps);

  const goal = goalValue(settings.goal);
  const reached = reachedValue(settings.reached);
  const status = settings.status === 'active' || settings.status === 'completed' ? settings.status : 'planned';
  // No verified figure, or a planned goal: the honest state has no progress.
  const planned = reached === null || status === 'planned';
  const fraction = planned ? 0 : arcFraction(reached, goal);

  if (!eyebrow && !heading && !body && !itemTitle && !note && !ctaText && steps.length === 0 && goal === null) {
    return builderPreview ? <EmptyState name={IMPACT_ARC_KEY} /> : null;
  }

  const nf = numberFormat(locale);
  const goalText = goal !== null ? nf.format(goal) : '';
  const reachedText = !planned && reached !== null ? nf.format(reached) : '';
  const horizonSrc = mediaSrc(settings.horizon_image);
  const markerSrc = mediaSrc(settings.marker_image);

  const vars: Record<string, string> = {};
  const bg = str(settings.bg_color);
  const fg = str(settings.text_color);
  const arc = str(settings.arc_color);
  if (bg) vars['--cx-ia-bg'] = bg;
  if (fg) vars['--cx-ia-fg'] = fg;
  if (arc) vars['--cx-ia-arc'] = arc;

  // Read out in place of the drawing: name, figure, unit, status.
  const figureSpoken = planned ? goalText : `${reachedText} / ${goalText}`;
  const gaugeLabel = [itemTitle, itemMeta, [figureSpoken, unitLabel].filter(Boolean).join(' '), statusLabel]
    .filter(Boolean)
    .join(', ');

  const itemBlock =
    itemTitle || itemMeta ? (
      <>
        {itemTitle && <span className="cx-ia-title">{itemTitle}</span>}
        {itemMeta && <span className="cx-ia-meta">{itemMeta}</span>}
      </>
    ) : null;

  const mark = toPercent(arcPoint(fraction, rtl));

  return (
    <CxSection
      name={IMPACT_ARC_KEY}
      css={IMPACT_ARC_CSS}
      island={false}
      className="cx-ia"
      style={vars as CSSProperties}
      data-cx-ridge={goal !== null && horizonSrc ? '' : undefined}
    >
      <div className="cx-ia-in">
        {(eyebrow || heading || body) && (
          <header className="cx-ia-head">
            {eyebrow && (
              <p className="cx-ia-label cx-ia-eyebrow" {...rise(m, { i: 0 })}>
                {eyebrow}
              </p>
            )}
            {heading && (
              <h2 className="cx-ia-h">
                <MotionText motion={m} text={heading} />
              </h2>
            )}
            {body && (
              <p className="cx-ia-body" {...rise(m, { i: 2 })}>
                {body}
              </p>
            )}
          </header>
        )}

        {goal !== null && (
          <div
            className="cx-ia-stage"
            role="img"
            aria-label={gaugeLabel}
            data-cx-planned={planned ? '' : undefined}
            {...fade(m)}
          >
            <div className="cx-ia-sky">
              <div className="cx-ia-gauge">
                {horizonSrc && (
                  <div
                    className="cx-ia-ridge"
                    data-cx-vector={isSvgSrc(horizonSrc) ? '' : undefined}
                    {...rise(m, { d: 3 })}
                  >
                    <StoreImage
                      src={horizonSrc}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 800px, 100vw"
                      unoptimized={isSvgSrc(horizonSrc)}
                    />
                  </div>
                )}
                <svg
                  className="cx-ia-svg"
                  viewBox={`0 0 ${ARC.width} ${ARC.height}`}
                  aria-hidden="true"
                  focusable="false"
                  fill="none"
                >
                  <path className="cx-ia-track" d={arcPath(rtl)} />
                  {TICKS.map((t) => {
                    const k = arcTick(t, rtl);
                    return (
                      <line
                        key={t}
                        className="cx-ia-tick"
                        data-cx-minor={t === 0.25 || t === 0.75 ? '' : undefined}
                        x1={k.x1}
                        y1={k.y1}
                        x2={k.x2}
                        y2={k.y2}
                      />
                    );
                  })}
                  {fraction > 0 && (
                    <path
                      className="cx-ia-prog"
                      d={arcPath(rtl)}
                      pathLength={1}
                      strokeDasharray={`${fraction} 1`}
                      style={{ '--cx-ia-f': fraction } as CSSProperties}
                    />
                  )}
                </svg>
                {/* Physical position on the gauge box: already computed for the direction. */}
                <span className="cx-ia-mark" style={{ left: mark.left, top: mark.top }}>
                  {markerSrc ? (
                    <StoreImage src={markerSrc} alt="" width={32} height={32} unoptimized={isSvgSrc(markerSrc)} />
                  ) : (
                    <span className="cx-ia-disc" />
                  )}
                </span>
                <div className="cx-ia-core">
                  {statusLabel && <span className="cx-ia-label cx-ia-chip">{statusLabel}</span>}
                  {/* Digits and the slash keep their order in every direction. */}
                  <p className="cx-ia-fig" dir="ltr">
                    {planned ? (
                      <span className="cx-ia-num">{goalText}</span>
                    ) : (
                      <>
                        {/* Reserved width: the count-up never shifts the line. */}
                        <span className="cx-ia-num" style={{ minInlineSize: `${reachedText.length}ch` }}>
                          {m ? <Counter value={reachedText} /> : reachedText}
                        </span>
                        <span className="cx-ia-of">/ {goalText}</span>
                      </>
                    )}
                  </p>
                  {unitLabel && <p className="cx-ia-unit">{unitLabel}</p>}
                  {itemBlock && <p className="cx-ia-item">{itemBlock}</p>}
                </div>
              </div>
              <span className="cx-ia-horizon" />
            </div>
            <div className="cx-ia-ends">
              <span className="cx-ia-end">{nf.format(0)}</span>
              {/* Phones: the name sits under the horizon (the arc is too small to hold it). */}
              {itemBlock && (
                <p className="cx-ia-item" aria-hidden="true">
                  {itemBlock}
                </p>
              )}
              <span className="cx-ia-end">{goalText}</span>
            </div>
          </div>
        )}

        {steps.length > 0 && (
          <ol className="cx-ia-steps" style={{ '--cx-ia-n': steps.length } as CSSProperties} {...stagger(m)}>
            {steps.map((step, i) => (
              <li key={i} className="cx-ia-step" {...item(m, i)}>
                {i > 0 && (
                  <svg className="cx-ia-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none">
                    <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.25" />
                  </svg>
                )}
                <span className="cx-ia-n" aria-hidden="true">
                  {nf.format(i + 1)}
                </span>
                <div>
                  {step.title && <p className="cx-ia-st">{step.title}</p>}
                  {step.text && <p className="cx-ia-sx">{step.text}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}

        {(note || ctaText) && (
          <div className="cx-ia-foot">
            {note && (
              <p className="cx-ia-note" {...fade(m)}>
                {note}
              </p>
            )}
            {ctaText && (
              <div className="cx-ia-cta" {...rise(m)}>
                <a
                  className="cx-ia-btn"
                  href={sectionHref(settings.cta_url, locale, primaryLocale)}
                  {...hover(m, 'press')}
                  {...magnetic(m)}
                >
                  {ctaText}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </CxSection>
  );
}

// Same shape defineCreativeSection() returns, built from this section's own
// schema entry (the shared registry does not have to know the key first).
export const impactArcSection: SectionDefinition = {
  needsBuilderPreview: true,
  schema: entry.schema,
  Component: ImpactArc,
  defaultSettings: entry.defaultSettings,
  defaultContent: entry.defaultContent,
};
