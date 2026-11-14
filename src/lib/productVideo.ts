// Product video helpers (product-video contract section 6.1).
//
// Pure helpers shared by the product page state, the video components and
// the JSON-LD builder. Nothing here renders or loads a player: the gallery
// stays image-only for products without video, and `buildGalleryMedia`
// returns the exact image items unchanged in that case.

import { resolveMediaUrl } from '@/lib/api';
import { readExternalMediaConsent } from '@/lib/consent';

/** A product video as the storefront API sends it (= API `ProductVideoOut`). */
export interface StorefrontProductVideo {
  id: string;
  kind: 'file' | 'youtube' | 'vimeo';
  /** file: "/uploads/products/<uuid>.mp4"; external: canonical watch URL. */
  url: string;
  poster_url: string | null;
  duration_s: number | null;
  width: number | null;
  height: number | null;
  /** Number of product-level images shown before this video; >= 0; 0 = featured (first gallery slot). */
  position: number;
  alt: string | null;
  /** Muted autoplay while visible (CONTRACT-AUTOPLAY A3). Optional: an older API omits it. */
  autoplay?: boolean;
  /** Loop the autoplaying video (ignored without autoplay). Optional: an older API omits it. */
  loop?: boolean;
  /** ISO 8601 (JSON-LD uploadDate). */
  created_at: string;
}

export interface GalleryImageItem {
  kind: 'image';
  id: string;
  url: string;
  alt: string;
}

export type GalleryVideoSource =
  | { type: 'file'; src: string; mime: 'video/mp4' }
  | { type: 'youtube' | 'vimeo'; videoId: string; hash?: string; watchUrl: string; embedUrl: string };

export interface GalleryVideoItem {
  kind: 'video';
  id: string;
  /** Poster: resolveMediaUrl(poster_url), or '' for a neutral dark tile. */
  url: string;
  /** video.alt, or the product title. */
  alt: string;
  source: GalleryVideoSource;
  durationS: number | null;
  width: number | null;
  height: number | null;
  /** Requested gallery slot (see buildGalleryMedia); >= 0; 0 = featured. */
  position: number;
  /** Muted autoplay while visible (CONTRACT-AUTOPLAY A3). */
  autoplay: boolean;
  /** Loop the autoplaying video; always false when autoplay is false. */
  loop: boolean;
}

export type GalleryItem = GalleryImageItem | GalleryVideoItem;

// ── External URL parser (same rules as the API's product-video-url.ts) ──

export type ExternalVideoKind = 'youtube' | 'vimeo';

export interface ParsedExternalVideo {
  kind: ExternalVideoKind;
  id: string;
  /** Vimeo unlisted-video hash, when present. */
  hash?: string;
  canonicalUrl: string;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{1,12}$/;
const VIMEO_HASH = /^[A-Za-z0-9]{6,20}$/;

function youtube(id: string | null | undefined): ParsedExternalVideo | null {
  return id && YT_ID.test(id)
    ? { kind: 'youtube', id, canonicalUrl: `https://www.youtube.com/watch?v=${id}` }
    : null;
}

function vimeo(id: string | undefined, hash: string | null | undefined): ParsedExternalVideo | null {
  if (!id || !VIMEO_ID.test(id)) return null;
  if (hash && !VIMEO_HASH.test(hash)) return null;
  return hash
    ? { kind: 'vimeo', id, hash, canonicalUrl: `https://vimeo.com/${id}/${hash}` }
    : { kind: 'vimeo', id, canonicalUrl: `https://vimeo.com/${id}` };
}

/** Strict YouTube / Vimeo parser. Unknown hosts or shapes return null: never iframe a generic URL. */
export function parseExternalVideoUrl(raw: string): ParsedExternalVideo | null {
  let u: URL;
  try {
    u = new URL(String(raw ?? '').trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean);

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (parts.length === 1 && parts[0] === 'watch') return youtube(u.searchParams.get('v'));
    if (parts.length === 2 && ['embed', 'shorts', 'live'].includes(parts[0])) return youtube(parts[1]);
    return null;
  }
  if (host === 'youtu.be') return parts.length === 1 ? youtube(parts[0]) : null;
  if (host === 'vimeo.com') {
    if (parts.length === 1) return vimeo(parts[0], null);
    if (parts.length === 2) return vimeo(parts[0], parts[1]);
    return null;
  }
  if (host === 'player.vimeo.com') {
    return parts.length === 2 && parts[0] === 'video' ? vimeo(parts[1], u.searchParams.get('h')) : null;
  }
  return null;
}

export interface EmbedUrlOptions {
  /** Muted autoplay while visible (only with the external-media consent). */
  autoplayMuted?: boolean;
  /** Loop the muted autoplay. */
  loop?: boolean;
  /** Page origin, for the YouTube JS API (postMessage mute / pause). */
  origin?: string;
}

/**
 * Privacy-enhanced embed URL. Without options (click mode) it is loaded only
 * after a Play click, so autoplay=1 starts the clip the visitor asked for.
 * With `autoplayMuted` it is the provider's muted inline autoplay, used only
 * when the visitor allowed external videos (CONTRACT-AUTOPLAY 6.2).
 */
export function toEmbedUrl(
  parsed: Pick<ParsedExternalVideo, 'kind' | 'id' | 'hash'>,
  opts?: EmbedUrlOptions,
): string {
  const hash = parsed.hash ? `&h=${parsed.hash}` : '';
  if (opts?.autoplayMuted) {
    if (parsed.kind === 'youtube') {
      const origin = opts.origin ? `&origin=${encodeURIComponent(opts.origin)}` : '';
      const loop = opts.loop ? `&loop=1&playlist=${parsed.id}` : '';
      return `https://www.youtube-nocookie.com/embed/${parsed.id}?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1${origin}${loop}`;
    }
    const loop = opts.loop ? '&loop=1' : '';
    return `https://player.vimeo.com/video/${parsed.id}?autoplay=1&muted=1&playsinline=1&dnt=1${loop}${hash}`;
  }
  if (parsed.kind === 'youtube') {
    return `https://www.youtube-nocookie.com/embed/${parsed.id}?autoplay=1&playsinline=1&rel=0`;
  }
  return `https://player.vimeo.com/video/${parsed.id}?autoplay=1&dnt=1${hash}`;
}

/** Embed URL without autoplay (JSON-LD `embedUrl`). */
function toStaticEmbedUrl(parsed: Pick<ParsedExternalVideo, 'kind' | 'id' | 'hash'>): string {
  if (parsed.kind === 'youtube') return `https://www.youtube-nocookie.com/embed/${parsed.id}`;
  return `https://player.vimeo.com/video/${parsed.id}?dnt=1${parsed.hash ? `&h=${parsed.hash}` : ''}`;
}

function isMp4Path(url: string): boolean {
  const path = url.split(/[?#]/)[0] ?? '';
  return /\.mp4$/i.test(path);
}

function positiveIntOrNull(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Storefront video -> gallery item. Returns null for an unparsable external
 * URL or a file URL that is not an .mp4; such videos are dropped silently.
 */
export function toGalleryVideoItem(v: StorefrontProductVideo, fallbackAlt: string): GalleryVideoItem | null {
  if (!v || typeof v.url !== 'string' || !v.url) return null;
  let source: GalleryVideoSource;
  if (v.kind === 'file') {
    if (!isMp4Path(v.url)) return null;
    source = { type: 'file', src: resolveMediaUrl(v.url), mime: 'video/mp4' };
  } else if (v.kind === 'youtube' || v.kind === 'vimeo') {
    const parsed = parseExternalVideoUrl(v.url);
    if (!parsed || parsed.kind !== v.kind) return null;
    source = {
      type: parsed.kind,
      videoId: parsed.id,
      ...(parsed.hash ? { hash: parsed.hash } : {}),
      watchUrl: parsed.canonicalUrl,
      embedUrl: toEmbedUrl(parsed),
    };
  } else {
    return null;
  }
  return {
    kind: 'video',
    id: v.id,
    url: v.poster_url ? resolveMediaUrl(v.poster_url) : '',
    alt: (v.alt && v.alt.trim()) || fallbackAlt,
    source,
    durationS: positiveIntOrNull(v.duration_s),
    width: positiveIntOrNull(v.width),
    height: positiveIntOrNull(v.height),
    position: Number.isFinite(v.position) ? Math.max(0, Math.trunc(v.position)) : 1,
    autoplay: v.autoplay === true,
    loop: v.autoplay === true && v.loop === true,
  };
}

/** Valid gallery items for a product's videos, in payload order. */
export function toGalleryVideoItems(
  videos: StorefrontProductVideo[] | null | undefined,
  fallbackAlt: string,
): GalleryVideoItem[] {
  if (!videos?.length) return [];
  const out: GalleryVideoItem[] = [];
  for (const v of videos) {
    const item = toGalleryVideoItem(v, fallbackAlt);
    if (item) out.push(item);
  }
  return out;
}

type ImageLike = { id: string; url: string; alt: string };

function asImageItem(img: ImageLike): GalleryImageItem {
  return { kind: 'image', ...img };
}

/**
 * Merge images and videos into one gallery order (contract 6.2).
 *
 * `leading` are variant / value-level images, `productLevel` the product's
 * own images that survived the dedupe (or a custom product's mockups). A
 * video's `position` p (>= 1) means "after the p-th product-level image", as
 * the merchant arranged it in the editor.
 *
 * `base` is the full product-level list BEFORE the dedupe (featured first).
 * When a picked colour's imageMap image is also a product image, the dedupe
 * moves that image into `leading`; with `base` the video stays anchored to
 * the original image: it follows the last of base[0..p-1] still in
 * `productLevel`, or the leading block when all of them moved there. Without
 * `base`, p counts within `productLevel` only.
 *
 * Let n be productLevel.length; the slot s = min(anchored p, n) and the video
 * is emitted right before product-level item s (0-based), or after the last
 * item when s === n. With n === 0 the videos follow the leading items; with
 * no images at all every video is dropped. Videos keep their input order
 * within a slot.
 *
 * Featured video (CONTRACT-AUTOPLAY A1): `position === 0` always takes slot
 * 0, i.e. right before product-level item 0 (after the leading block, if
 * any), regardless of `base` anchoring. With no leading images it is the
 * gallery's first item; when a picked colour's own image leads, that image
 * comes first and the featured video follows it. For `position >= 1` with no
 * leading block the slot is at least 1, so only a featured video can open
 * the list.
 */
export function buildGalleryMedia(
  leading: ImageLike[],
  productLevel: ImageLike[],
  videos: GalleryVideoItem[],
  base?: ImageLike[],
): GalleryItem[] {
  const images = [...leading.map(asImageItem), ...productLevel.map(asImageItem)];
  if (!videos.length || images.length === 0) return images;

  const n = productLevel.length;
  if (n === 0) return [...images, ...videos];

  // Product-level images still in productLevel among the first p base images.
  const kept = new Set(productLevel.map((img) => img.url));
  const slotOf = (position: number): number => {
    // Featured video: slot 0 whatever the anchoring or the leading block.
    if (position === 0) return 0;
    const p = Math.max(position, 1);
    if (!base) return Math.min(p, n);
    let slot = 0;
    const seen = new Set<string>();
    for (const img of base.slice(0, p)) {
      if (kept.has(img.url) && !seen.has(img.url)) {
        seen.add(img.url);
        slot += 1;
      }
    }
    slot = Math.min(slot, n);
    // With no leading block a non-featured video never opens the list.
    return leading.length === 0 ? Math.max(slot, 1) : slot;
  };

  const bySlot = new Map<number, GalleryVideoItem[]>();
  for (const v of videos) {
    const p = slotOf(v.position);
    const list = bySlot.get(p);
    if (list) list.push(v);
    else bySlot.set(p, [v]);
  }

  const out: GalleryItem[] = leading.map(asImageItem);
  productLevel.forEach((img, i) => {
    const before = bySlot.get(i);
    if (before) out.push(...before);
    out.push(asImageItem(img));
  });
  const tail = bySlot.get(n);
  if (tail) out.push(...tail);
  return out;
}

/**
 * Whether a YouTube / Vimeo embed may load for this store without a click on
 * the two-click facade: only when the visitor chose "Always allow external
 * videos" (the separate external-media consent, CONTRACT-AUTOPLAY A4/A5).
 * The general cookie banner choice does not unlock embeds. Always false on
 * the server, so SSR never renders a third-party iframe.
 */
export function embedAllowed(storeSlug: string | null | undefined): boolean {
  return !!storeSlug && readExternalMediaConsent(storeSlug);
}

/** "m:ss" for a duration chip, or null when unknown. */
export function formatVideoDuration(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── JSON-LD ──

export interface VideoObjectJsonLd {
  '@type': 'VideoObject';
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string;
  contentUrl?: string;
  embedUrl?: string;
}

export interface VideoObjectJsonLdInput {
  videos: StorefrontProductVideo[] | null | undefined;
  /** Product title: the name fallback when a video has no alt. */
  productName: string;
  /** Product short description (plain text); `name` is used when empty. */
  description?: string | null;
  /** Turns a relative "/uploads/..." path (or an absolute URL) into an absolute URL on the store domain. */
  toAbsoluteUrl: (url: string) => string;
}

/**
 * `subjectOf` entries for the Product JSON-LD: one VideoObject per valid
 * video that has a poster (Google requires a thumbnail). Returns [] when no
 * video qualifies, so callers add `subjectOf` only for a non-empty result.
 */
export function buildVideoObjectsJsonLd(input: VideoObjectJsonLdInput): VideoObjectJsonLd[] {
  const out: VideoObjectJsonLd[] = [];
  for (const v of input.videos ?? []) {
    if (!v?.poster_url) continue;
    const item = toGalleryVideoItem(v, input.productName);
    if (!item) continue;
    const name = item.alt || input.productName;
    const description = (input.description && input.description.trim()) || name;
    const entry: VideoObjectJsonLd = {
      '@type': 'VideoObject',
      name,
      description,
      thumbnailUrl: input.toAbsoluteUrl(v.poster_url),
      uploadDate: v.created_at,
    };
    if (item.durationS) entry.duration = `PT${item.durationS}S`;
    if (item.source.type === 'file') {
      entry.contentUrl = input.toAbsoluteUrl(v.url);
    } else {
      entry.embedUrl = toStaticEmbedUrl({ kind: item.source.type, id: item.source.videoId, hash: item.source.hash });
    }
    out.push(entry);
  }
  return out;
}
