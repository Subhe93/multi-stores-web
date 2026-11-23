// Section "look-spread": a look taken apart into the pieces you can buy.
// Two photographs of unequal size carry small numbered markers; the same
// numbers return in a ruled buy list with thumbnail, name and live price.
// The list may also hold pieces without a marker (a diamond instead of a
// number). Nothing opens and nothing pulses: every price is on the page.
//
// Product data: a row links a product through an ordinary url field
// (/products/<slug>). Title and thumbnail fall back to the live product, the
// price is ONLY the live one (never typed by hand), read from the
// `preloaded` prop ({ products: { <slug>: … } }). Without it the section is
// complete with its manual texts and links, just without prices.
//
// Markers are anchors to their list row: the pairing works without
// JavaScript, and the hover response is CSS (:has) behind the motion gate.
// Marker coordinates are physical percentages of the photograph in every
// direction; photographs are never mirrored.

import { useId, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { PriceTaxSuffix } from '@/components/product/PriceTaxSuffix';
import { StoreImage } from '@/components/StoreImage';
import { resolveMediaUrl } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { isSvgSrc } from '@/lib/storeMedia';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { sectionHref } from '../../minimal/sections/_shared/links';
import { picked as sharedPicked, pickedHref } from '../data/pickedProducts';
import { LOOK_SPREAD_CSS } from '../css/lookSpread.css';
import { CxSection, EmptyState, MotionMedia, MotionText } from '../primitives';
import { drift, fade, hover, item, line, rise, stagger, type MotionProp } from '../recipes';
import { entry, LOOK_SPREAD_MAX_ITEMS } from '../schemas/look-spread.schema';

// ── Live product data (contract of spec 1.1) ────────────────────────────
// Read through the shared reader of data/pickedProducts.ts (M165: typed
// slugs and product references).

type PickedProduct = {
  slug: string;
  title: string;
  url: string;
  image?: string;
  price?: number;
  compareAt?: number;
  currency?: string;
  available?: boolean;
};

// Kept as a re-export for the section tests (shared reader since M165).
export { productSlugFromUrl } from '../data/pickedProducts';

/** Preloaded product of a pick value (typed url or `product:<id>` reference). */
function picked(preloaded: unknown, url: unknown): PickedProduct | null {
  return sharedPicked(preloaded, url);
}

// ── Reading the owner's values ──────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** A percentage 0..100 from a number or a numeric string; anything else is null. */
function percent(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 10) / 10;
}

type Photo = 'a' | 'b';

interface Row {
  /** Place in the list, 1..6: the row anchor and the hover pairing. */
  n: number;
  /** Number printed on the marker and in the list; 0 = no marker. */
  mark: number;
  title: string;
  note: string;
  href: string | null;
  image: string;
  price: string;
  soldOut: boolean;
  photo: Photo | null;
  x: number;
  y: number;
}

function readRows(
  raw: unknown,
  ctx: { preloaded: unknown; locale: string; primaryLocale: string; pathPrefix?: string; currency?: string; hasA: boolean; hasB: boolean },
): Row[] {
  const rows: Row[] = [];
  let mark = 0;
  for (const entryRaw of Array.isArray(raw) ? raw : []) {
    if (rows.length >= LOOK_SPREAD_MAX_ITEMS) break;
    if (!entryRaw || typeof entryRaw !== 'object') continue;
    const it = entryRaw as Record<string, unknown>;
    const live = picked(ctx.preloaded, it.url);
    const title = str(it.title) || (live ? str(live.title) : '');
    // Neither a manual title nor live data: nothing honest to print.
    if (!title) continue;

    const x = percent(it.x);
    const y = percent(it.y);
    const wanted = it.photo === 'a' || it.photo === 'b' ? (it.photo as Photo) : null;
    const onPhoto = wanted && x !== null && y !== null && (wanted === 'a' ? ctx.hasA : ctx.hasB) ? wanted : null;
    const url = str(it.url);
    const hasPrice = !!live && typeof live.price === 'number' && Number.isFinite(live.price);

    rows.push({
      n: rows.length + 1,
      mark: onPhoto ? ++mark : 0,
      title,
      note: str(it.note),
      // The live product's canonical path of this locale (M163), else the owner URL.
      href: url
        ? sectionHref(pickedHref(url, live), { locale: ctx.locale, primaryLocale: ctx.primaryLocale, pathPrefix: ctx.pathPrefix })
        : null,
      image: str(it.image) || (live ? str(live.image) : ''),
      // Same formatting as the product card (Latin digits in every locale).
      price: hasPrice ? formatPrice(live!.price as number, live!.currency || ctx.currency || 'EUR', 'en') : '',
      soldOut: !!live && live.available === false,
      photo: onPhoto,
      x: x ?? 0,
      y: y ?? 0,
    });
  }
  return rows;
}

// ── Parts ───────────────────────────────────────────────────────────────

function Markers({ rows, photo, uid, motion }: { rows: Row[]; photo: Photo; uid: string; motion: MotionProp }) {
  return rows
    .filter((r) => r.photo === photo)
    .map((r) => (
      <a
        key={r.n}
        className="cx-ls-m"
        href={`#${uid}-item-${r.n}`}
        aria-label={`${r.mark}. ${r.title}`}
        data-ls-n={r.n}
        // Physical on purpose: a point on the photograph, the same in RTL.
        style={{ left: `${r.x}%`, top: `${r.y}%` }}
        // After the mask has opened, one by one.
        {...fade(motion, { d: 9 + r.mark - 1 })}
      >
        <span className="cx-ls-mi" aria-hidden="true">
          {r.mark}
        </span>
      </a>
    ));
}

function Picture({ src: raw, alt, sizes }: { src: string; alt: string; sizes: string }) {
  // Root-relative uploads go through the media origin (data: and absolute URLs stay as they are).
  const src = resolveMediaUrl(raw);
  return <StoreImage src={src} alt={alt} fill sizes={sizes} unoptimized={isSvgSrc(src)} className="cx-ls-img" />;
}

const ARROW = (
  <svg
    className="cx-ls-arrow"
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

function LookSpread({
  settings,
  content,
  locale,
  primaryLocale,
  pathPrefix,
  currency,
  preloaded,
  motion,
  builderPreview,
  sectionId,
}: SectionRenderProps) {
  const t = useTranslations('product');
  const reactId = useId();
  const uid = `cx-ls-${(sectionId || reactId).replace(/[^A-Za-z0-9_-]/g, '')}`;

  const imageA = str(settings.image_a);
  const imageB = str(settings.image_b);
  const eyebrow = str(content.eyebrow);
  const heading = str(content.heading);
  const note = str(content.note);
  const linkLabel = str(content.link_label);
  const linkUrl = str(settings.link_url);
  const rows = readRows(content.items, {
    preloaded,
    locale,
    primaryLocale,
    pathPrefix,
    currency,
    hasA: !!imageA,
    hasB: !!imageB,
  });

  if (!heading && !imageA && rows.length === 0) {
    return builderPreview ? <EmptyState name="look-spread" /> : null;
  }

  const vars: Record<string, string> = {};
  const bg = str(settings.bg_color);
  const text = str(settings.text_color);
  const mark = str(settings.marker_color);
  const markText = str(settings.marker_text_color);
  if (bg) vars['--cx-ls-bg'] = bg;
  if (text) vars['--cx-ls-text'] = text;
  if (mark) vars['--cx-ls-mark'] = mark;
  if (markText) vars['--cx-ls-mark-text'] = markText;

  const hasHead = !!(eyebrow || heading || note);

  return (
    <CxSection
      name="look-spread"
      css={LOOK_SPREAD_CSS}
      island={false}
      className="cx-ls"
      style={vars as CSSProperties}
      data-cx-list={settings.list_side === 'start' ? 'start' : 'end'}
      data-cx-b={imageA && imageB ? '' : undefined}
    >
      <div className="cx-ls-in">
        {hasHead && (
          <header className="cx-ls-head">
            <div className="cx-ls-head-main">
              {eyebrow && (
                <p className="cx-ls-label" {...rise(motion, { i: 0 })}>
                  {eyebrow}
                </p>
              )}
              {heading && (
                <h2 className="cx-ls-heading">
                  <MotionText motion={motion} text={heading} />
                </h2>
              )}
            </div>
            {note && (
              <p className="cx-ls-note" {...rise(motion, { i: 2 })}>
                {note}
              </p>
            )}
          </header>
        )}

        <div className="cx-ls-spread">
          {imageA && (
            <div className="cx-ls-photos">
              <figure className="cx-ls-a">
                <div className="cx-ls-frame">
                  {/* Opens towards the list. */}
                  <MotionMedia motion={motion} fill dir="end">
                    <Picture src={imageA} alt={str(content.alt_a)} sizes="(min-width: 1024px) 50vw, (min-width: 768px) 58vw, 100vw" />
                  </MotionMedia>
                </div>
                <Markers rows={rows} photo="a" uid={uid} motion={motion} />
              </figure>
              {imageB && (
                // The small photograph moves slightly against the large one (768 px and up).
                <div className="cx-ls-b" {...drift(motion, { y: -6 })}>
                  <div className="cx-ls-bframe">
                    <div className="cx-ls-frame">
                      <MotionMedia motion={motion} fill dir="up" style={{ '--cx-delay': '.2s' } as CSSProperties}>
                        <Picture src={imageB} alt={str(content.alt_b)} sizes="(min-width: 1024px) 22vw, 56vw" />
                      </MotionMedia>
                      <Markers rows={rows} photo="b" uid={uid} motion={motion} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {(rows.length > 0 || linkLabel) && (
            <div className="cx-ls-side">
              {rows.length > 0 && (
                <ol className="cx-ls-list" {...stagger(motion)}>
                  {rows.map((r, index) => {
                    const cells = (
                      <>
                        {r.mark ? (
                          <span className="cx-ls-num">{r.mark}</span>
                        ) : (
                          <span className="cx-ls-dot" aria-hidden="true" />
                        )}
                        <span className="cx-ls-thumb" {...hover(motion, 'media')}>
                          {r.image && <Picture src={r.image} alt="" sizes="64px" />}
                        </span>
                        <span className="cx-ls-text">
                          <span className="cx-ls-title">{r.title}</span>
                          {r.note && <span className="cx-ls-meta">{r.note}</span>}
                          {r.soldOut && <span className="cx-ls-meta">{t('soldOut')}</span>}
                        </span>
                        {r.price ? (
                          <span className="cx-ls-pricebox">
                            <span className="cx-ls-price">{r.price}</span>
                            <PriceTaxSuffix className="cx-ls-vat" />
                          </span>
                        ) : (
                          <span />
                        )}
                      </>
                    );
                    return (
                      <li key={r.n} id={`${uid}-item-${r.n}`} className="cx-ls-row" data-ls-n={r.n} {...item(motion, index)}>
                        <span className="cx-ls-hair" aria-hidden="true" {...line(motion)} />
                        {r.href ? (
                          <a className="cx-ls-link" href={r.href}>
                            {cells}
                          </a>
                        ) : (
                          <div className="cx-ls-link">{cells}</div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {linkLabel && linkUrl && (
                <a className="cx-ls-more" href={sectionHref(linkUrl, { locale, primaryLocale, pathPrefix })}>
                  <span className="cx-ls-more-l" {...hover(motion, 'underline')}>
                    {linkLabel}
                  </span>
                  {ARROW}
                </a>
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
export const lookSpreadSection: SectionDefinition = {
  needsBuilderPreview: true,
  schema: entry.schema,
  Component: LookSpread,
  defaultSettings: entry.defaultSettings,
  defaultContent: entry.defaultContent,
};
