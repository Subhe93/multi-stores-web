// Customer story helpers (customer-stories contract section 7.1).
//
// Pure helpers for the `product-stories` product block. Nothing here renders
// or loads a player: video stories become the same GalleryVideoItem the
// product gallery uses, so the block reuses the shared video components.

import { resolveMediaUrl } from '@/lib/api';
import { toGalleryVideoItem, type GalleryVideoItem } from '@/lib/productVideo';

/** One locale's texts of a story (= API `ProductStoryTranslationOut`). */
export interface StorefrontProductStoryTranslation {
  locale: string;
  /** Plain text, may be ''. Never HTML: render as a text child only. */
  quote: string;
  subtitle: string | null;
}

/** A customer story as the storefront API sends it (= API `ProductStoryOut`). */
export interface StorefrontProductStory {
  id: string;
  kind: 'image' | 'file' | 'youtube' | 'vimeo';
  /** image / file: relative "/uploads/..."; youtube / vimeo: canonical watch URL. */
  url: string;
  /** Video poster (relative); always null for 'image'. */
  poster_url: string | null;
  duration_s: number | null;
  width: number | null;
  height: number | null;
  /** Person's display name (not translated). */
  name: string;
  /** 1..5 or null. */
  rating: number | null;
  verified: boolean;
  /** Muted autoplay of a video story while visible (CONTRACT-AUTOPLAY A3). Optional: an older API omits it. */
  autoplay?: boolean;
  /** Loop the autoplaying story video (ignored without autoplay). Optional. */
  loop?: boolean;
  /** Sorted by locale asc. */
  translations: StorefrontProductStoryTranslation[];
}

export interface StoryText {
  quote: string | null;
  subtitle: string | null;
}

const textOrNull = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
};

/**
 * Texts of a story for the visitor: the `lang` translation, else the store
 * primary locale, else the first one. Empty strings become null.
 */
export function resolveStoryText(
  story: Pick<StorefrontProductStory, 'translations'>,
  lang: string,
  primaryLocale: string,
): StoryText {
  const rows = Array.isArray(story.translations) ? story.translations : [];
  const tr =
    rows.find((r) => r?.locale === lang) || rows.find((r) => r?.locale === primaryLocale) || rows[0];
  return { quote: textOrNull(tr?.quote), subtitle: textOrNull(tr?.subtitle) };
}

/** Media of a story card: an image, or the shared gallery video item. */
export type StoryMedia = { type: 'image'; src: string } | (GalleryVideoItem & { type: 'video' });

/**
 * Story -> card media. Returns null for an empty image URL, an unparsable
 * external URL or a file URL that is not an .mp4; such stories are dropped.
 */
export function toStoryMedia(story: StorefrontProductStory, fallbackAlt: string): StoryMedia | null {
  if (!story || typeof story.url !== 'string') return null;
  if (story.kind === 'image') {
    const src = story.url.trim() ? resolveMediaUrl(story.url.trim()) : '';
    return src ? { type: 'image', src } : null;
  }
  if (story.kind !== 'file' && story.kind !== 'youtube' && story.kind !== 'vimeo') return null;
  const item = toGalleryVideoItem(
    {
      id: story.id,
      kind: story.kind,
      url: story.url,
      poster_url: story.poster_url,
      duration_s: story.duration_s,
      width: story.width,
      height: story.height,
      position: 1,
      autoplay: story.autoplay === true,
      loop: story.loop === true,
      alt: textOrNull(story.name),
      created_at: '',
    },
    fallbackAlt,
  );
  return item ? { ...item, type: 'video' } : null;
}

/** A story ready to render. */
export interface StoryCard {
  id: string;
  name: string;
  rating: number | null;
  verified: boolean;
  quote: string | null;
  subtitle: string | null;
  media: StoryMedia;
}

function ratingOrNull(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const r = Math.round(v);
  return r >= 1 && r <= 5 ? r : null;
}

/** Valid story cards in payload order; invalid media is dropped silently. */
export function toStoryCards(
  stories: StorefrontProductStory[] | null | undefined,
  lang: string,
  primaryLocale: string,
): StoryCard[] {
  if (!Array.isArray(stories) || stories.length === 0) return [];
  const out: StoryCard[] = [];
  stories.forEach((story, i) => {
    if (!story) return;
    const name = typeof story.name === 'string' ? story.name.trim() : '';
    const media = toStoryMedia(story, name);
    if (!media) return;
    const text = resolveStoryText(story, lang, primaryLocale);
    out.push({
      id: story.id || `story-${i}`,
      name,
      rating: ratingOrNull(story.rating),
      verified: story.verified === true,
      quote: text.quote,
      subtitle: text.subtitle,
      media,
    });
  });
  return out;
}

// ── Block settings (contract 7.2) ──

export type StoriesLayout = 'slider' | 'grid' | 'overlay';
export type StoriesAspect = 'portrait' | 'square' | 'landscape';
export type StoriesTextPosition = 'below' | 'overlay';

export interface StoriesSettings {
  showHeading: boolean;
  layout: StoriesLayout;
  aspect: StoriesAspect;
  columns: number;
  columnsTablet: number;
  columnsMobile: number;
  /** Effective text position: always 'overlay' for the overlay layout. */
  textPosition: StoriesTextPosition;
  showRating: boolean;
  showSubtitle: boolean;
  showVerified: boolean;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Integer in [min, max]; numeric strings accepted, anything else -> fallback. */
export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function readStoriesSettings(settings: Record<string, unknown> | undefined): StoriesSettings {
  const s = settings ?? {};
  const layout = pick(s.layout, ['slider', 'grid', 'overlay'] as const, 'slider');
  return {
    showHeading: s.show_heading !== false,
    layout,
    aspect: pick(s.card_aspect, ['portrait', 'square', 'landscape'] as const, 'portrait'),
    columns: clampInt(s.columns, 1, 6, 4),
    columnsTablet: clampInt(s.columns_tablet, 1, 4, 3),
    columnsMobile: clampInt(s.columns_mobile, 1, 2, 1),
    textPosition: layout === 'overlay' ? 'overlay' : pick(s.text_position, ['below', 'overlay'] as const, 'below'),
    showRating: s.show_rating !== false,
    showSubtitle: s.show_subtitle !== false,
    showVerified: s.show_verified !== false,
  };
}

/** Share of the row a mobile slider card takes so the next one peeks (~15%). */
export const MOBILE_PEEK = 0.15;

/**
 * `sizes` of a card image from the columns per breakpoint (md = 768px,
 * lg = 1024px, the Tailwind breakpoints the layout uses). A peeking mobile
 * slider card is slightly narrower than 100vw / columns.
 */
export function storySizes(s: Pick<StoriesSettings, 'columns' | 'columnsTablet' | 'columnsMobile'>, peek: boolean): string {
  const vw = (cols: number) => `${Math.ceil(100 / cols)}vw`;
  return `(min-width: 1024px) ${vw(s.columns)}, (min-width: 768px) ${vw(s.columnsTablet)}, ${vw(
    peek ? s.columnsMobile + MOBILE_PEEK : s.columnsMobile,
  )}`;
}
