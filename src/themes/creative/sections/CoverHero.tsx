// Section "cover-hero": the first screen composed like the cover of a
// printed issue. A masthead rule with up to three small labels and the
// store's seal sitting on it, two photographs of unequal size on different
// baselines, a woven edge along the large one, and a caption under the small
// one that links to a product and prints its live price.
//
// Everything is owner content: words (content), photographs, seal and edge
// artwork (image settings), colours (colour settings, empty = theme token).
// The platform ships no word and no artwork.
//
// Motion comes only from the shared recipes, driven by the `motion` prop.
// Without it no reveal attribute is rendered and the section is complete and
// static. The large photograph is the LCP element: on the first section it
// only settles and is never clipped or transparent.
//
// Photographs, seal and edge are never mirrored in right-to-left pages; the
// grid mirrors by itself.

import type { CSSProperties, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { resolveMediaUrl } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { isSvgSrc } from '@/lib/storeMedia';
import { PriceTaxSuffix } from '@/components/product/PriceTaxSuffix';
import { StoreImage } from '@/components/StoreImage';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { headingLines, headingOneLine } from '../../minimal/sections/_shared/headingLines';
import { sectionHref } from '../../minimal/sections/_shared/links';
import { picked as sharedPicked, pickedHref } from '../data/pickedProducts';
import { COVER_HERO_CSS } from '../css/coverHero.css';
import { isArabicScript } from '../emphasis';
import { CxSection } from '../primitives/CxSection';
import { EmptyState } from '../primitives/EmptyState';
import { MotionMedia, MotionText } from '../primitives/Motion';
import { drift, fade, hover, line, magnetic, parallax, rise, type MotionProp } from '../recipes';
import { entry } from '../schemas/cover-hero.schema';

const KEY = 'cover-hero';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const script = (text: string) => (isArabicScript(text) ? 'arabic' : undefined);

// ── Media ───────────────────────────────────────────────────────────────

const DATA_IMAGE = /^data:image\/(?:svg\+xml|png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/;

/** Source of an owner image: an inline data image as it is, anything else through the media origin. */
export function coverMedia(raw: unknown): string {
  const src = str(raw);
  if (!src) return '';
  if (src.startsWith('data:')) return DATA_IMAGE.test(src) ? src : '';
  return resolveMediaUrl(src);
}

/**
 * `url("…")` of the woven edge for an inline style, or '' when the stored
 * value is not a plain image address. Accepted: root-relative paths, https
 * URLs and base64 data images; a quote, backslash, bracket or line break
 * rejects the value.
 */
export function coverEdgeCss(raw: unknown): string {
  const src = str(raw);
  if (!src || /["'\\()\s]/.test(src)) return '';
  if (src.startsWith('data:')) return DATA_IMAGE.test(src) ? `url("${src}")` : '';
  const rootRelative = src.startsWith('/') && !src.startsWith('//');
  if (!rootRelative && !src.startsWith('https://')) return '';
  let encoded: string;
  try {
    encoded = encodeURI(decodeURI(resolveMediaUrl(src)));
  } catch {
    return '';
  }
  return /["'\\()\s]/.test(encoded) ? '' : `url("${encoded}")`;
}

const FOCUS_X: Record<string, string> = { left: 'left', center: 'center', right: 'right' };
const FOCUS_Y: Record<string, string> = { top: 'top', center: 'center', bottom: 'bottom' };

/** Physical `object-position` of the large photograph (never mirrored). */
export function coverFocus(x: unknown, y: unknown): string {
  return `${FOCUS_X[str(x)] || 'center'} ${FOCUS_Y[str(y)] || 'top'}`;
}

// ── Live product of the caption ─────────────────────────────────────────
// Read through the shared reader of data/pickedProducts.ts (M165: typed
// slugs and product references).

interface PickedProduct {
  title?: unknown;
  /** Canonical path of the rendered locale (M163). */
  url?: unknown;
  price?: unknown;
  currency?: unknown;
  available?: unknown;
}

/** Slug of a `/products/<slug>` link (optional locale prefix, query or hash); anything else is null. */
export function coverProductSlug(url: unknown): string | null {
  const path = str(url).split(/[?#]/)[0];
  const match = /^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?products\/([^/]+)\/?$/.exec(path);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Preloaded product of a pick value (typed url or `product:<id>` reference). */
function picked(preloaded: unknown, url: unknown): PickedProduct | null {
  return sharedPicked(preloaded, url);
}

// ── Colours ─────────────────────────────────────────────────────────────

/** Readable text colour on an owner accent given as a hex value; other notations keep the theme contrast. */
export function contrastOn(color: string): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? '#111111' : '#ffffff';
}

// ── Parts ───────────────────────────────────────────────────────────────

interface Caption {
  label: string;
  title: string;
  price: string;
  soldOut: boolean;
  href: string;
}

function CaptionBlock({ caption, motion, alt }: { caption: Caption; motion: MotionProp; alt?: boolean }) {
  const t = useTranslations('product');
  const body: ReactNode = (
    <>
      {caption.label && (
        <span className="cx-ch-lb" data-cx-script={script(caption.label)}>
          {caption.label}
        </span>
      )}
      <span className="cx-ch-cl">
        <span className="cx-ch-ct">{caption.title}</span>
        {caption.price && (
          <span className="cx-ch-price">
            {caption.price} <PriceTaxSuffix className="cx-ch-note" />
          </span>
        )}
        {caption.soldOut && <span className="cx-ch-note">{t('outOfStock')}</span>}
      </span>
    </>
  );
  return (
    <div className={alt ? 'cx-ch-capw cx-ch-capw-alt' : 'cx-ch-capw'} {...fade(motion, { d: 8 })}>
      {caption.href ? (
        <a className="cx-ch-cap" href={caption.href} {...hover(motion, 'underline')}>
          {body}
        </a>
      ) : (
        <div className="cx-ch-cap">{body}</div>
      )}
    </div>
  );
}

function CoverHero(props: SectionRenderProps) {
  const { settings, content, locale, primaryLocale, pathPrefix, motion, builderPreview, preloaded } = props;

  const heading = headingLines(content.heading);
  if (!heading) return builderPreview ? <EmptyState name={KEY} /> : null;

  const mastStart = str(content.masthead_start);
  const mastCenter = str(content.masthead_center);
  const mastEnd = str(content.masthead_end);
  const eyebrow = str(content.eyebrow);
  const subheading = str(content.subheading);
  const ctaText = str(content.cta_text);
  const ctaSecondaryText = str(content.cta_secondary_text);

  const image = coverMedia(settings.image);
  const detailImage = coverMedia(settings.detail_image);
  const sealImage = coverMedia(settings.seal_image);
  const edgeCss = image ? coverEdgeCss(settings.edge_image) : '';
  const sealSize = settings.seal_size === 'sm' ? 'sm' : 'md';

  // Caption: manual title, else the live one; the price is the live price
  // only. Without a title there is no caption.
  const detailUrl = str(settings.detail_url);
  const live = picked(preloaded, detailUrl);
  const captionTitle = str(content.detail_title) || str(live?.title);
  const livePrice = typeof live?.price === 'number' && Number.isFinite(live.price) && live.price >= 0 ? live.price : null;
  const caption: Caption | null = captionTitle
    ? {
        label: str(content.detail_label),
        title: captionTitle,
        price:
          livePrice === null ? '' : formatPrice(livePrice, str(live?.currency) || props.currency || 'EUR', 'en'),
        soldOut: live?.available === false,
        // The live product's canonical path of this locale (M163), else the owner URL.
        href: detailUrl ? sectionHref(pickedHref(detailUrl, live), { locale, primaryLocale, pathPrefix }) : '',
      }
    : null;

  const HeadingTag = settings.heading_level === 'h2' ? 'h2' : 'h1';
  const flat = headingOneLine(heading);

  const vars: Record<string, string> = {};
  const bg = str(settings.bg_color);
  const text = str(settings.text_color);
  const accent = str(settings.accent_color);
  if (bg) vars['--cx-ch-bg'] = bg;
  if (text) vars['--cx-ch-text'] = text;
  if (accent) {
    vars['--cx-ch-accent'] = accent;
    const fg = contrastOn(accent);
    if (fg) vars['--cx-ch-accent-fg'] = fg;
  }

  // The first section paints its photograph at once; further down the page
  // it opens towards the text side.
  const first = motion !== 'scroll';
  // Class hooks of the hero rules (css/hero.css.ts): a text that rises to its
  // own resting values, one transition list for a pressed, magnetic button.
  const t = motion ? ' cx-hero-t' : '';
  const b = motion ? ' cx-hero-t cx-hero-btn' : '';
  const mast = mastCenter ? 'center' : mastStart ? 'start' : undefined;
  const hasMast = !!(mastStart || mastCenter || mastEnd);

  return (
    <CxSection
      name={KEY}
      css={COVER_HERO_CSS}
      island={false}
      className="cx-ch"
      style={vars as CSSProperties}
      data-cx-tone={settings.cta_tone === 'primary' ? 'primary' : 'accent'}
      data-cx-order={settings.mobile_order === 'text-first' ? 'text' : undefined}
      data-cx-detail={image && detailImage ? '' : undefined}
      data-cx-seal={image && sealImage ? sealSize : undefined}
    >
      <div className="cx-ch-in">
        <div className="cx-ch-mast" data-cx-mast={mast}>
          {mastStart && (
            <p className="cx-ch-lb cx-ch-ms" data-cx-script={script(mastStart)} {...fade(motion, { d: 2 })}>
              {mastStart}
            </p>
          )}
          {mastCenter && (
            <p className="cx-ch-lb cx-ch-mc" data-cx-script={script(mastCenter)} {...fade(motion, { d: 2 })}>
              {mastCenter}
            </p>
          )}
          {mastEnd && (
            <p className="cx-ch-lb cx-ch-me" data-cx-script={script(mastEnd)} {...fade(motion, { d: 2 })}>
              {mastEnd}
            </p>
          )}
          {(hasMast || !!image) && <span className="cx-ch-hair" aria-hidden="true" {...line(motion)} />}
        </div>

        <div className="cx-ch-cover">
          <div className="cx-ch-text">
            {eyebrow && (
              <p className={`cx-ch-lb cx-ch-eb${t}`} data-cx-script={script(eyebrow)} {...rise(motion, { i: 0 })}>
                {eyebrow}
              </p>
            )}
            <HeadingTag className="cx-ch-h" data-cx-script={script(heading)}>
              <MotionText motion={motion} text={heading} />
            </HeadingTag>
            {(subheading || ctaText || ctaSecondaryText) && (
              <span className="cx-ch-rule" aria-hidden="true" {...line(motion, { d: 6 })} />
            )}
            {subheading && (
              <p className={`cx-ch-sub${t}`} {...rise(motion, { i: 2 })}>
                {subheading}
              </p>
            )}
            {(ctaText || ctaSecondaryText) && (
              <div className="cx-ch-btns">
                {ctaText && (
                  <a
                    className={`cx-ch-btn${b}`}
                    href={sectionHref(settings.cta_url, { locale, primaryLocale, pathPrefix })}
                    data-cx-script={script(ctaText)}
                    {...rise(motion, { i: 3 })}
                    {...hover(motion, 'press')}
                    {...magnetic(motion)}
                  >
                    {ctaText}
                  </a>
                )}
                {ctaSecondaryText && (
                  <a
                    className={`cx-ch-btn${b}`}
                    href={sectionHref(settings.cta_secondary_url, { locale, primaryLocale, pathPrefix })}
                    data-cx-variant="outline"
                    data-cx-script={script(ctaSecondaryText)}
                    {...rise(motion, { i: 4 })}
                    {...hover(motion, 'press')}
                    {...magnetic(motion)}
                  >
                    {ctaSecondaryText}
                  </a>
                )}
              </div>
            )}
            {/* Under the buttons wherever the small photograph is not shown. */}
            {caption && <CaptionBlock caption={caption} motion={motion} alt />}
          </div>

          {image && (
            <div className="cx-ch-photo">
              <div className="cx-ch-frame">
                <MotionMedia motion={motion} priority={first} dir="end" fill className="cx-hero-media">
                  <div className="cx-ch-fill" {...parallax(motion, -6)}>
                    <StoreImage
                      src={image}
                      alt={str(content.alt) || flat}
                      fill
                      priority={first}
                      sizes="(min-width: 1024px) 34vw, (min-width: 768px) 50vw, 100vw"
                      unoptimized={isSvgSrc(image) || image.startsWith('data:')}
                      style={{ objectFit: 'cover', objectPosition: coverFocus(settings.image_focus_x, settings.image_focus_y) }}
                    />
                  </div>
                </MotionMedia>
              </div>
              {edgeCss && (
                <span
                  className="cx-ch-edge"
                  aria-hidden="true"
                  style={{ backgroundImage: edgeCss }}
                  {...fade(motion, { d: 4 })}
                />
              )}
              {sealImage && (
                <div className="cx-ch-seal" aria-hidden="true" {...fade(motion, { d: 6 })}>
                  {/* Two elements: the entrance and the scroll drift must not share one. */}
                  <div className="cx-ch-seal-in" {...drift(motion, { y: -4, rotate: 8 })}>
                    <StoreImage
                      src={sealImage}
                      alt=""
                      fill
                      sizes="72px"
                      unoptimized={isSvgSrc(sealImage) || sealImage.startsWith('data:')}
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {image && detailImage && (
            <div className="cx-ch-detail">
              <div className="cx-ch-detail-in">
                <div className="cx-ch-dimg">
                  <MotionMedia motion={motion} dir="up" fill style={{ '--cx-delay': '.5s' } as CSSProperties}>
                    <StoreImage
                      src={detailImage}
                      alt={str(content.detail_alt) || captionTitle}
                      fill
                      sizes="(min-width: 1024px) 15vw, 38vw"
                      unoptimized={isSvgSrc(detailImage) || detailImage.startsWith('data:')}
                      style={{ objectFit: 'cover' }}
                    />
                  </MotionMedia>
                </div>
                {caption && <CaptionBlock caption={caption} motion={motion} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </CxSection>
  );
}

// Same shape defineCreativeSection() returns, built from this section's own
// schema entry (defineCreativeSection needs the key in the shared registry).
export const coverHeroSection: SectionDefinition = {
  needsBuilderPreview: true,
  schema: entry.schema,
  Component: CoverHero,
  defaultSettings: entry.defaultSettings,
  defaultContent: entry.defaultContent,
};
