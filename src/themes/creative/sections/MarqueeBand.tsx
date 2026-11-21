// Section "marquee-band": one or two rows of words, chips or cards gliding
// past, with the store's symbol as separator. Zero JavaScript (no island):
// the motion is a CSS animation behind the gate attribute, the pause control
// is a checkbox. Without the gate the items simply wrap on centred rows.
//
// Synchronous and client-safe: it also renders inside the builder preview.

import { useId, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import type { SectionRenderProps } from '../../types';
import { FOCUS_RING, sectionHref } from '../../minimal/sections/_shared/links';
import { accentSize, type AccentSize } from '../constants';
import { MARQUEE_BAND_CSS } from '../css/marqueeBand.css';
import { isArabicScript } from '../emphasis';
import { CxSection, EmptyState } from '../primitives';
import { defineCreativeSection } from '../schemas';

const MAX_ITEMS = 16;
type ItemStyle = 'text' | 'pill' | 'card';
type TextStyle = 'solid' | 'outline' | 'mixed';

// Seconds one loop takes at the reference width below.
const SPEED: Record<string, number> = { slow: 60, normal: 40, fast: 26 };
// One half of a track must be wider than the viewport, or the loop shows a
// gap: the list is repeated until its estimated width reaches this.
const HALF_MIN_PX = 2600;
const MAX_REPEATS = 10;

const IMAGE_PX: Record<ItemStyle, Record<AccentSize, number>> = {
  text: { sm: 20, md: 28 },
  pill: { sm: 24, md: 36 },
  card: { sm: 44, md: 56 },
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

interface BandItem {
  text: string;
  image: string;
  imageAlt: string;
  url: string;
}

function readItems(raw: unknown): BandItem[] {
  if (!Array.isArray(raw)) return [];
  const items: BandItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const item = { text: str(o.text), image: str(o.image), imageAlt: str(o.image_alt), url: str(o.url) };
    if (!item.text && !item.image) continue;
    items.push(item);
    if (items.length === MAX_ITEMS) break;
  }
  return items;
}

/** Rough rendered width of the list once, in px (only decides how often it repeats). */
function estimateWidth(items: BandItem[], itemStyle: ItemStyle, size: AccentSize): number {
  const charPx = size === 'sm' ? 9.5 : 15;
  const framePx = itemStyle === 'text' ? (size === 'sm' ? 46 : 78) : size === 'sm' ? 54 : 74;
  let width = 0;
  for (const item of items) {
    width += item.text.length * charPx + framePx + (item.image ? IMAGE_PX[itemStyle][size] + 12 : 0);
  }
  return Math.max(width, 80);
}

function MarqueeBand({ settings, content, locale, primaryLocale, pathPrefix, builderPreview }: SectionRenderProps) {
  const t = useTranslations('creative');
  const toggleId = useId();
  const items = readItems(content.items ?? settings.items);

  // Nothing on the live store; a dashed placeholder in the builder only.
  if (!items.length) return builderPreview ? <EmptyState name="marquee-band" /> : null;

  const heading = str(content.heading);
  const rows = settings.rows === '1' || settings.rows === 1 ? 1 : 2;
  const itemStyle: ItemStyle = settings.item_style === 'pill' || settings.item_style === 'card' ? settings.item_style : 'text';
  // sm / md only: anything else stored (lg, xl, junk) reads as md.
  const size = accentSize(settings.size);
  const textStyle: TextStyle =
    settings.text_style === 'outline' || settings.text_style === 'mixed' ? settings.text_style : 'solid';
  const speed = SPEED[typeof settings.speed === 'string' ? settings.speed : ''] ?? SPEED.slow;
  const separatorImage = str(settings.separator_image);
  const resolvedSeparator = separatorImage ? resolveMediaUrl(separatorImage) : '';
  // Unset = the default bullet; an empty string = no glyph, the gap only.
  const separator = typeof settings.separator === 'string' ? settings.separator.trim().slice(0, 3) : '•';
  // Chips and cards are separated by their own outline.
  const withSeparator = itemStyle === 'text' && Boolean(resolvedSeparator || separator);
  const textColor = str(settings.text_color);
  const borderColor = str(settings.border_color);
  const imagePx = IMAGE_PX[itemStyle][size];
  const separatorPx = size === 'sm' ? 14 : 20;

  const listWidth = estimateWidth(items, itemStyle, size);
  const repeats = Math.min(MAX_REPEATS, Math.max(1, Math.ceil(HALF_MIN_PX / listWidth)));
  // Same travel speed whatever the content length.
  const duration = Math.round(speed * Math.max(1, (repeats * listWidth) / HALF_MIN_PX) * 10) / 10;

  const style: Record<string, string> = { '--cx-mq-dur': `${duration}s` };
  if (textColor) style['--cx-mq-fg'] = textColor;
  if (borderColor) style['--cx-mq-bd'] = borderColor;

  const renderList = (list: BandItem[], copy: boolean, key: string) => (
    <ul
      key={key}
      className={copy ? 'cx-mq-list cx-mq-copy' : 'cx-mq-list'}
      // Copies exist for the loop only: hidden from assistive technology and from the tab order.
      aria-hidden={copy ? 'true' : undefined}
      inert={copy ? true : undefined}
    >
      {list.map((item, i) => {
        const image = item.image ? resolveMediaUrl(item.image) : '';
        const arabic = isArabicScript(item.text);
        const outlined = textStyle === 'outline' || (textStyle === 'mixed' && i % 2 === 1);
        const inner = (
          <>
            {image && (
              <StoreImage
                src={image}
                // Copies are decorative; so is an image without a description.
                alt={copy ? '' : item.imageAlt}
                width={imagePx}
                height={imagePx}
                sizes={`${imagePx}px`}
                loading="lazy"
                unoptimized={isSvgSrc(image)}
                style={{ inlineSize: imagePx, blockSize: imagePx }}
              />
            )}
            {item.text && (
              <span
                className="cx-mq-t"
                // Arabic letters are joined: never outlined.
                data-cx-look={outlined && !arabic ? 'outline' : undefined}
                data-cx-script={arabic ? 'arabic' : undefined}
              >
                {item.text}
              </span>
            )}
          </>
        );
        return (
          <li key={i} className="cx-mq-item">
            {item.url ? (
              <a
                href={sectionHref(item.url, { locale, primaryLocale, pathPrefix })}
                className={`cx-mq-c ${FOCUS_RING}`}
                data-cx-img={image ? '' : undefined}
              >
                {inner}
              </a>
            ) : (
              <span className="cx-mq-c" data-cx-img={image ? '' : undefined}>
                {inner}
              </span>
            )}
            {withSeparator && (
              <span className="cx-mq-sep" aria-hidden="true">
                {resolvedSeparator ? (
                  <StoreImage
                    src={resolvedSeparator}
                    alt=""
                    width={separatorPx}
                    height={separatorPx}
                    sizes={`${separatorPx}px`}
                    loading="lazy"
                    unoptimized={isSvgSrc(resolvedSeparator)}
                    style={{ inlineSize: separatorPx, blockSize: separatorPx, objectFit: 'contain' }}
                  />
                ) : (
                  <span className="cx-mq-sg">{separator}</span>
                )}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );

  // Row 2 starts half-way through the list so the two rows never line up.
  const shift = Math.ceil(items.length / 2);
  const rowItems = [items, [...items.slice(shift), ...items.slice(0, shift)]];

  return (
    <CxSection
      name="marquee-band"
      css={MARQUEE_BAND_CSS}
      as={heading ? 'section' : 'div'}
      island={false}
      scene={settings.scene}
      sceneBg={settings.scene_bg}
      sceneText={settings.scene_text}
      sceneAccent={settings.scene_accent}
      className="cx-mq"
      style={style as CSSProperties}
      aria-label={heading || undefined}
      data-cx-item={itemStyle}
      data-cx-size={size}
      data-cx-fade={settings.edge_fade !== false ? '' : undefined}
      data-cx-gray={settings.grayscale_images === true ? '' : undefined}
    >
      {heading && (
        <p className="cx-mq-h" data-cx-script={isArabicScript(heading) ? 'arabic' : undefined}>
          {heading}
        </p>
      )}
      <div className="cx-mq-rows">
        {/* CSS-only pause control; it exists visually only while the band moves. */}
        <input type="checkbox" id={toggleId} className="cx-mq-toggle" />
        <label htmlFor={toggleId} className="cx-mq-ctl">
          <span className="cx-mq-pause">
            <svg viewBox="0 0 10 10" fill="currentColor" aria-hidden="true" focusable="false">
              <rect x="1.5" y="1" width="2.5" height="8" rx=".5" />
              <rect x="6" y="1" width="2.5" height="8" rx=".5" />
            </svg>
            <span className="cx-mq-sr">{t('marqueePause')}</span>
          </span>
          <span className="cx-mq-play">
            <svg viewBox="0 0 10 10" fill="currentColor" aria-hidden="true" focusable="false">
              <path d="M2.5 1.2v7.6a.4.4 0 0 0 .6.35l6-3.8a.4.4 0 0 0 0-.7l-6-3.8a.4.4 0 0 0-.6.35Z" />
            </svg>
            <span className="cx-mq-sr">{t('marqueePlay')}</span>
          </span>
        </label>
        {rowItems.slice(0, rows).map((list, r) => (
          <div
            key={r}
            className="cx-mq-row"
            data-cx-row={String(r + 1)}
            // The second row repeats the first one's items: decoration only.
            aria-hidden={r > 0 ? 'true' : undefined}
            inert={r > 0 ? true : undefined}
          >
            <div className="cx-mq-track" data-cx-loop="">
              {Array.from({ length: repeats * 2 }, (_, c) => renderList(list, r > 0 || c > 0, `${r}-${c}`))}
            </div>
          </div>
        ))}
      </div>
    </CxSection>
  );
}

export const marqueeBandSection = defineCreativeSection('marquee-band', MarqueeBand);
