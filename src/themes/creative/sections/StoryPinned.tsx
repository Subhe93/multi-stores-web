// Section "story-pinned": a row of story cards. The static page (no
// JavaScript, phones, touch, reduced motion, store motion off, builder) is a
// native swipe row with scroll snap, or a stack on phones. On a desktop with
// motion allowed the section pins (CSS position: sticky in a tall track) and
// the `track` behaviour moves the row sideways with the scroll.
//
// Synchronous and client-safe: it also renders inside the builder preview.

import { useId, type CSSProperties, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import type { SectionRenderProps } from '../../types';
import { Heading } from '../../minimal/sections/_shared/Heading';
import { headingTag } from '../../minimal/sections/_shared/headingLevel';
import { headingLines, multilineStyle } from '../../minimal/sections/_shared/headingLines';
import { FOCUS_RING, sectionHref } from '../../minimal/sections/_shared/links';
import { STORY_PINNED_CSS } from '../css/storyPinned.css';
import { emphasisValue, isArabicScript } from '../emphasis';
import { CxSection, EmptyState, Eyebrow, HeadingText, MaskReveal, Numeral } from '../primitives';
import { defineCreativeSection } from '../schemas';

const MAX_ITEMS = 8;
const CARD_WIDTH = { sm: 22, md: 28, lg: 36 } as const;
type CardWidth = keyof typeof CARD_WIDTH;
type CardStyle = 'editorial' | 'overlay' | 'panel';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
const two = (n: number): string => String(n).padStart(2, '0');

interface StoryItem {
  image: string;
  imageAlt: string;
  icon: string;
  label: string;
  title: string;
  text: string;
  ctaText: string;
  ctaUrl: unknown;
}

function readItems(raw: unknown, withImages: boolean): StoryItem[] {
  if (!Array.isArray(raw)) return [];
  const items: StoryItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const item: StoryItem = {
      image: withImages ? str(o.image) : '',
      imageAlt: str(o.image_alt),
      icon: str(o.icon),
      label: str(o.label),
      title: str(o.title),
      text: str(o.text),
      ctaText: str(o.cta_text),
      ctaUrl: o.cta_url,
    };
    // A card with nothing to show is skipped.
    if (!item.image && !item.title && !item.text && !item.label) continue;
    items.push(item);
    if (items.length === MAX_ITEMS) break;
  }
  return items;
}

const Arrow = () => (
  <svg
    className="cx-btn-arrow"
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
);

function StoryPinned({ settings, content, locale, primaryLocale, pathPrefix, builderPreview }: SectionRenderProps) {
  const t = useTranslations('creative');
  const uid = useId();
  const headingId = `${uid}-h`;
  const endId = `${uid}-end`;

  const cardStyle = pick<CardStyle>(settings.card_style, ['editorial', 'overlay', 'panel'], 'editorial');
  const items = readItems(content.items ?? settings.items, cardStyle !== 'panel');

  // Nothing on the live store; a dashed placeholder in the builder only.
  if (!items.length) return builderPreview ? <EmptyState name="story-pinned" /> : null;

  const heading = headingLines(content.heading);
  const eyebrow = str(content.eyebrow);
  const subheading = str(content.subheading);
  const hasHead = Boolean(heading || eyebrow || subheading);

  const cardWidth = pick<CardWidth>(settings.card_width, ['sm', 'md', 'lg'], 'md');
  const aspect = pick(settings.image_aspect, ['portrait', 'square', 'landscape'] as const, 'portrait');
  const numerals = pick(settings.numerals, ['none', 'small', 'outline'] as const, 'small');
  const progress = pick(settings.progress, ['bar', 'counter', 'both', 'none'] as const, 'bar');
  const headStart = settings.heading_position === 'start' && hasHead;
  const mobile = settings.mobile_layout === 'stack' ? 'stack' : 'swipe';
  const hint = settings.hint !== false;
  const accent = str(settings.accent_color);

  const showBar = progress === 'bar' || progress === 'both';
  const showCount = progress === 'counter' || progress === 'both';
  const total = items.length;
  const widthRem = CARD_WIDTH[cardWidth];
  const sizes = `(min-width: 1024px) ${widthRem * 16}px, 85vw`;

  const head = hasHead ? (
    <div className="cx-sp-head">
      {eyebrow && (
        <div data-cx-reveal="fade">
          <Eyebrow text={eyebrow} color={accent || undefined} />
        </div>
      )}
      {heading && (
        <Heading
          level={headingTag(settings.heading_level, 'h2')}
          id={headingId}
          className="cx-sp-h"
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
        <p className="cx-sp-sub" data-cx-reveal="rise" style={{ '--cx-delay': '.15s' } as CSSProperties}>
          {subheading}
        </p>
      )}
    </div>
  ) : null;

  // "{current} / {total}" with the current number in its own element, which
  // the behaviour updates. Latin digits in every locale.
  let counter: ReactNode = null;
  if (showCount) {
    const MARK = '\u0001';
    const parts = t('storyProgress', { current: MARK, total: two(total) }).split(MARK);
    const current = <span data-cx-current="">{two(1)}</span>;
    counter = (
      <span className="cx-sp-count">
        {parts.length === 2 ? (
          <>
            {parts[0]}
            {current}
            {parts[1]}
          </>
        ) : (
          <>
            {current}
            {` / ${two(total)}`}
          </>
        )}
      </span>
    );
  }
  const hintText = hint ? t('storyHint') : '';
  const hasProgress = showBar || showCount || Boolean(hintText);

  return (
    <CxSection
      name="story-pinned"
      css={STORY_PINNED_CSS}
      scene={settings.scene}
      sceneBg={settings.scene_bg}
      sceneText={settings.scene_text}
      sceneAccent={settings.scene_accent}
      className="cx-sp"
      style={accent ? ({ '--cx-sp-ac': accent } as CSSProperties) : undefined}
      aria-labelledby={heading ? headingId : undefined}
      data-cx-card={cardStyle}
      data-cx-aspect={aspect}
      data-cx-mobile={mobile}
    >
      <a href={`#${endId}`} className={`cx-sp-skip ${FOCUS_RING}`}>
        {t('storySkip')}
      </a>
      <div
        className="cx-track"
        data-cx-behavior="track"
        style={{ '--cx-n': total + (headStart ? 1 : 0), '--cx-card-w': `${widthRem}rem` } as CSSProperties}
      >
        <div className="cx-track-stage">
          {(head && !headStart) || hasProgress ? (
            <div className="cx-sp-top" data-cx-bare={head && !headStart ? undefined : ''}>
              {!headStart && head}
              {hasProgress && (
                // Decorative: only meaningful while the section is pinned.
                <div className="cx-sp-prog" aria-hidden="true">
                  {showBar && (
                    <span className="cx-sp-bar">
                      <span />
                    </span>
                  )}
                  {(counter || hintText) && (
                    <span className="cx-sp-pmeta">
                      {counter}
                      {hintText && (
                        <span className="cx-sp-hint" data-cx-script={isArabicScript(hintText) ? 'arabic' : undefined}>
                          {hintText}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : null}
          <div className="cx-track-view">
            <ol className="cx-track-row">
              {headStart && <li className="cx-sp-intro">{head}</li>}
              {items.map((item, i) => {
                const image = item.image ? resolveMediaUrl(item.image) : '';
                const icon = item.icon ? resolveMediaUrl(item.icon) : '';
                const hasMeta = numerals !== 'none' || Boolean(item.label) || Boolean(icon);
                const hasBody = Boolean(item.title || item.text || item.ctaText);
                return (
                  <li
                    key={i}
                    className="cx-sp-card"
                    data-cx-card-item=""
                    data-cx-reveal="rise"
                    // The first cards arrive in a short cascade; later ones as they slide in.
                    style={i > 0 && i < 4 ? ({ '--cx-delay': `${(i * 0.12).toFixed(2)}s` } as CSSProperties) : undefined}
                  >
                    {image && (
                      <MaskReveal mode="scroll" className="cx-sp-media">
                        <StoreImage
                          src={image}
                          // Empty alt = decorative.
                          alt={item.imageAlt}
                          fill
                          sizes={sizes}
                          loading="lazy"
                          unoptimized={isSvgSrc(image)}
                          style={{ objectFit: 'cover' }}
                        />
                      </MaskReveal>
                    )}
                    {hasMeta && (
                      <div className="cx-sp-meta">
                        {numerals === 'small' && (
                          <span className="cx-sp-n" aria-hidden="true">
                            {two(i + 1)}
                          </span>
                        )}
                        {numerals === 'outline' && <Numeral n={i + 1} look="outline" size="md" />}
                        {item.label && (
                          <span className="cx-sp-label" data-cx-script={isArabicScript(item.label) ? 'arabic' : undefined}>
                            {item.label}
                          </span>
                        )}
                        {icon && (
                          <span className="cx-sp-icon" aria-hidden="true">
                            <StoreImage
                              src={icon}
                              alt=""
                              width={20}
                              height={20}
                              sizes="20px"
                              loading="lazy"
                              unoptimized={isSvgSrc(icon)}
                            />
                          </span>
                        )}
                      </div>
                    )}
                    {hasBody && (
                      <div className="cx-sp-body">
                        {item.title && <h3 className="cx-sp-title">{item.title}</h3>}
                        {item.text && <p className="cx-sp-text">{item.text}</p>}
                        {item.ctaText && (
                          <a href={sectionHref(item.ctaUrl, { locale, primaryLocale, pathPrefix })} className={`cx-sp-link ${FOCUS_RING}`}>
                            {item.ctaText}
                            <Arrow />
                          </a>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
      <span id={endId} className="cx-sp-end" tabIndex={-1} />
    </CxSection>
  );
}

export const storyPinnedSection = defineCreativeSection('story-pinned', StoryPinned);
