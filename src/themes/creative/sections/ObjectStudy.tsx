// Section "object-study": one product looked at closely, like a plate in a
// museum catalogue. The object stands alone on a ground under a label line;
// thin leader lines run from points on it to short notes in the margins;
// title, text, live price and a link to the product sit under the plate.
//
// Product data: the owner links a product through an ordinary url field
// (/products/<slug>). Title and photograph fall back to the live product,
// the price is ONLY the live one (never typed by hand), read from the
// `preloaded` prop ({ products: { <slug>: … } }). On a product template an
// empty link means the product of the page (`props.product`). Without live
// data the section is complete with its manual texts, just without a price.
//
// The points (x, y) are physical percentages of the plate in every writing
// direction, and a note stays on the side of the point it describes: the
// photograph is never mirrored. Geometry: ./objectStudyGeometry.
//
// Below 980 px there are no lines: the points carry their numbers and the
// notes follow as a numbered list (same markup, see css/objectStudy.css.ts).

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { PriceTaxSuffix } from '@/components/product/PriceTaxSuffix';
import { StoreImage } from '@/components/StoreImage';
import { formatPrice } from '@/lib/format';
import { isSvgSrc } from '@/lib/storeMedia';
import { sectionHref } from '../../minimal/sections/_shared/links';
import type { ProductContext, SectionDefinition, SectionRenderProps } from '../../types';
import { OBJECT_STUDY_CSS } from '../css/objectStudy.css';
import { isArabicScript } from '../emphasis';
import { CxSection, EmptyState, MotionMedia, MotionText } from '../primitives';
import { fade, hover, line, rise } from '../recipes';
import { entry, OBJECT_STUDY_MAX_NOTES } from '../schemas/object-study.schema';
import { leaderStrokes, percent, placeNotes, type LeaderStroke, type PlacedNote } from './objectStudyGeometry';

// ── Live product data (contract of spec 1.1) ────────────────────────────
// TODO(integrator): replace with the shared reader of data/pickedProducts.ts
// once it exists; the shape below is the one that module exports.

interface LiveProduct {
  title: string;
  image?: string;
  price?: number;
  compareAt?: number;
  currency?: string;
  available?: boolean;
}

/** `/products/<slug>` with an optional locale prefix, query or hash; anything else is null. */
export function productSlugFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const path = url.trim().split(/[?#]/)[0];
  const m = /^\/(?:[a-z]{2}\/)?products\/([A-Za-z0-9][A-Za-z0-9_-]*)\/?$/.exec(path);
  return m ? m[1] : null;
}

function picked(preloaded: unknown, url: unknown): LiveProduct | null {
  const slug = productSlugFromUrl(url);
  if (!slug || !preloaded || typeof preloaded !== 'object') return null;
  const products = (preloaded as { products?: unknown }).products;
  if (!products || typeof products !== 'object') return null;
  const hit = (products as Record<string, unknown>)[slug];
  if (!hit || typeof hit !== 'object') return null;
  const p = hit as LiveProduct;
  return typeof p.title === 'string' ? p : null;
}

/** The product of a product template page, in the same shape. */
function fromPageProduct(product: ProductContext | undefined, locale: string, primaryLocale: string): LiveProduct | null {
  if (!product || !Array.isArray(product.translations)) return null;
  const tr =
    product.translations.find((t) => t.locale === locale) ||
    product.translations.find((t) => t.locale === primaryLocale) ||
    product.translations[0];
  const title = typeof tr?.title === 'string' ? tr.title.trim() : '';
  if (!title) return null;
  const images = Array.isArray(product.images) ? [...product.images] : [];
  images.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return {
    title,
    image: images[0]?.url,
    price: typeof product.base_price === 'number' ? product.base_price : undefined,
    compareAt: typeof product.compare_at_price === 'number' ? product.compare_at_price : undefined,
  };
}

// ── Reading the owner's values ──────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const script = (text: string) => (isArabicScript(text) ? 'arabic' : undefined);

interface Note {
  title: string;
  text: string;
  place: PlacedNote;
}

function readNotes(raw: unknown): Note[] {
  const rows: Array<{ title: string; text: string; x: number; y: number }> = [];
  for (const rowRaw of Array.isArray(raw) ? raw : []) {
    if (rows.length >= OBJECT_STUDY_MAX_NOTES) break;
    if (!rowRaw || typeof rowRaw !== 'object') continue;
    const row = rowRaw as Record<string, unknown>;
    const title = str(row.title);
    const text = str(row.text);
    if (!title && !text) continue;
    rows.push({ title, text, x: percent(row.x) ?? 50, y: percent(row.y) ?? 50 });
  }
  const placed = placeNotes(rows);
  return rows.map((row, i) => ({ title: row.title, text: row.text, place: placed[i] }));
}

// ── Leader lines ────────────────────────────────────────────────────────

const strokeStyle = (s: LeaderStroke) => ({ '--cx-b': `${s.begin}s`, '--cx-t': `${s.dur}s` }) as CSSProperties;

/**
 * One leader: the stroke on the plate in percentages of it, the strokes in
 * the gutter in pixels from the plate edge (a nested <svg> anchored on that
 * edge). The outer <svg> has no viewBox, so nothing is ever scaled.
 */
function Leader({ note }: { note: PlacedNote }) {
  const strokes = leaderStrokes(note);
  const out = note.side === 'left' ? -1 : 1;
  return (
    <g style={{ '--cx-k': note.index } as CSSProperties}>
      {strokes
        .filter((s) => s.space === 'plate')
        .map((s, i) => (
          <line
            key={i}
            className="cx-os-l"
            x1={`${s.x1}%`}
            y1={`${s.y1}%`}
            x2={`${s.x2}%`}
            y2={`${s.y2}%`}
            pathLength={1}
            style={strokeStyle(s)}
          />
        ))}
      <svg x={note.side === 'left' ? '0' : '100%'} overflow="visible">
        {strokes
          .filter((s) => s.space === 'gutter')
          .map((s, i) => (
            <line
              key={i}
              className="cx-os-l"
              x1={out * s.x1}
              y1={`${s.y1}%`}
              x2={out * s.x2}
              y2={`${s.y2}%`}
              pathLength={1}
              style={strokeStyle(s)}
            />
          ))}
      </svg>
    </g>
  );
}

// ── Section ─────────────────────────────────────────────────────────────

function ObjectStudy({
  settings,
  content,
  locale,
  primaryLocale,
  currency,
  product,
  preloaded,
  builderPreview,
  motion,
}: SectionRenderProps) {
  const t = useTranslations('product');
  const m = motion;

  const productUrl = str(settings.product_url);
  // A linked product wins; with no link, a product template shows its own product.
  const live = productUrl ? picked(preloaded, productUrl) : fromPageProduct(product, locale, primaryLocale);
  const href = productUrl ? sectionHref(productUrl, locale, primaryLocale) : null;

  const image = str(settings.image) || str(live?.image);
  if (!image) return builderPreview ? <EmptyState name="object-study" /> : null;

  const title = str(content.heading) || str(live?.title);
  const body = str(content.body);
  const cta = str(content.cta_text);
  const plateLabel = str(content.plate_label);
  const categoryLabel = str(content.category_label);
  const notes = readNotes(content.notes);

  const money = live?.currency || currency || 'EUR';
  const hasPrice = settings.show_price !== false && typeof live?.price === 'number' && Number.isFinite(live.price);
  // Same formatter as the product card.
  const price = hasPrice ? formatPrice(live!.price as number, money, 'en') : '';
  const was =
    hasPrice && typeof live?.compareAt === 'number' && live.compareAt > (live.price as number)
      ? formatPrice(live.compareAt, money, 'en')
      : '';
  const soldOut = !!live && live.available === false;

  const vars: Record<string, string> = {};
  const bg = str(settings.bg_color);
  const ground = str(settings.ground_color);
  const text = str(settings.text_color);
  const lineColor = str(settings.line_color);
  if (bg) vars['--cx-os-bg'] = bg;
  if (ground) vars['--cx-os-ground'] = ground;
  if (text) vars['--cx-os-text'] = text;
  if (lineColor) vars['--cx-os-lc'] = lineColor;

  const showButton = !!href && !!cta;

  return (
    <CxSection
      name="object-study"
      css={OBJECT_STUDY_CSS}
      island={false}
      className="cx-os"
      style={vars as CSSProperties}
      data-cx-aspect={settings.aspect === 'square' ? 'square' : 'portrait'}
      data-cx-fit={settings.fit === 'cover' ? 'cover' : 'contain'}
    >
      <div className="cx-os-in">
        <div className="cx-os-flow">
          {(plateLabel || categoryLabel) && (
            <div className="cx-os-grid">
              <div className="cx-os-mid">
                <div className="cx-os-head" {...fade(m, { d: 2 })}>
                  {plateLabel && (
                    <p className="cx-os-label" data-cx-script={script(plateLabel)}>
                      {plateLabel}
                    </p>
                  )}
                  {categoryLabel && (
                    <p className="cx-os-label" data-cx-quiet="" data-cx-script={script(categoryLabel)}>
                      {categoryLabel}
                    </p>
                  )}
                </div>
                <div className="cx-os-rule" {...line(m)} />
              </div>
            </div>
          )}

          {/* Plate and notes. Laid out left to right in every language: the sides are physical. */}
          <div className="cx-os-frame cx-os-grid">
            <div className="cx-os-plate cx-os-mid">
              <MotionMedia motion={m} dir="up" fill>
                <StoreImage
                  src={image}
                  alt={str(content.alt) || title}
                  fill
                  sizes="(min-width: 1024px) 600px, (min-width: 980px) 66vw, (min-width: 640px) 560px, 100vw"
                  unoptimized={isSvgSrc(image)}
                  className="cx-os-img"
                />
              </MotionMedia>
              {notes.length > 0 && (
                // No delay on the wrapper: the strokes wait on their own (1.1 s) and draw at full strength.
                <div className="cx-os-lines" aria-hidden="true" {...fade(m)}>
                  <svg focusable="false">
                    {notes.map((n) => (
                      <Leader key={n.place.index} note={n.place} />
                    ))}
                  </svg>
                </div>
              )}
              {notes.map((n) => (
                <span
                  key={n.place.index}
                  className="cx-os-dot"
                  aria-hidden="true"
                  style={{ left: `${n.place.x}%`, top: `${n.place.y}%` }}
                  {...fade(m, { d: 10 })}
                >
                  <span className="cx-os-dot-n">{n.place.index + 1}</span>
                </span>
              ))}
            </div>
            {notes.length > 0 && (
              <ol className="cx-os-notes">
                {notes.map((n) => (
                  <li
                    key={n.place.index}
                    className="cx-os-note"
                    data-cx-side={n.place.side}
                    style={{ '--cx-os-ny': `${n.place.noteY}%` } as CSSProperties}
                    {...rise(m, { i: n.place.index, d: 12 })}
                  >
                    {/* Latin digits in every locale: the number is a reference, not text. */}
                    <span className="cx-os-n">
                      {n.place.index + 1}
                    </span>
                    <div className="cx-os-nb">
                      {n.title && <h3 className="cx-os-nt">{n.title}</h3>}
                      {n.text && <p className="cx-os-nx">{n.text}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {(title || body || price || showButton) && (
            <div className="cx-os-buy">
              {title && (
                <h2 className="cx-os-h" data-cx-script={script(title)}>
                  <MotionText motion={m} text={title} />
                </h2>
              )}
              {body && (
                <p className="cx-os-body" {...rise(m, { i: 1 })}>
                  {body}
                </p>
              )}
              {(price || showButton) && (
                <div className="cx-os-row" {...rise(m, { i: 2 })}>
                  {price && (
                    <p className="cx-os-price">
                      <span className="cx-os-amount">{price}</span>
                      {was && <span className="cx-os-was">{was}</span>}
                      <PriceTaxSuffix className="cx-os-vat" />
                      {soldOut && <span className="cx-os-meta">{t('outOfStock')}</span>}
                    </p>
                  )}
                  {/* A link to the product page (variants are chosen there), so no magnetic pull. */}
                  {showButton && (
                    <a className="cx-btn cx-os-btn" data-cx-tone="accent" href={href!} {...hover(m, 'press')}>
                      <span className="cx-btn-in">
                        <span className="cx-btn-l">{cta}</span>
                      </span>
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </CxSection>
  );
}

// Built from the section's own schema entry (same result as
// defineCreativeSection, which needs the key in the shared registry).
export const objectStudySection: SectionDefinition = {
  needsBuilderPreview: true,
  schema: entry.schema,
  Component: ObjectStudy,
  defaultSettings: entry.defaultSettings,
  defaultContent: entry.defaultContent,
};
