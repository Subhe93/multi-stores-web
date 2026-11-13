import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGalleryMedia,
  buildVideoObjectsJsonLd,
  embedAllowed,
  formatVideoDuration,
  parseExternalVideoUrl,
  toEmbedUrl,
  toGalleryVideoItem,
  toGalleryVideoItems,
  type GalleryVideoItem,
  type StorefrontProductVideo,
} from './productVideo';


function video(overrides: Partial<StorefrontProductVideo> = {}): StorefrontProductVideo {
  return {
    id: 'v1',
    kind: 'file',
    url: '/uploads/products/a.mp4',
    poster_url: '/uploads/products/a.webp',
    duration_s: 42,
    width: 1920,
    height: 1080,
    position: 1,
    alt: null,
    created_at: '2026-11-13T10:00:00.000Z',
    ...overrides,
  };
}

function vItem(id: string, position: number): GalleryVideoItem {
  const item = toGalleryVideoItem(video({ id, position }), 'Mug');
  if (!item) throw new Error('fixture');
  return item;
}

const img = (id: string) => ({ id, url: `https://cdn.test/${id}.jpg`, alt: `alt-${id}` });

describe('parseExternalVideoUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'youtube', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://vimeo.com/76979871', 'vimeo', '76979871'],
    ['https://player.vimeo.com/video/76979871', 'vimeo', '76979871'],
  ])('accepts %s', (raw, kind, id) => {
    expect(parseExternalVideoUrl(raw)).toMatchObject({ kind, id });
  });

  it('keeps the Vimeo unlisted hash from both shapes', () => {
    expect(parseExternalVideoUrl('https://vimeo.com/76979871/abc123def')).toEqual({
      kind: 'vimeo',
      id: '76979871',
      hash: 'abc123def',
      canonicalUrl: 'https://vimeo.com/76979871/abc123def',
    });
    expect(parseExternalVideoUrl('https://player.vimeo.com/video/76979871?h=abc123def')?.hash).toBe('abc123def');
  });

  it.each([
    'https://evil.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
    'javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXc!',
    'https://www.youtube.com/watch?v=short',
    'https://user:pw@youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com:8443/watch?v=dQw4w9WgXcQ',
    'https://vimeo.com/abc',
    'https://vimeo.com/76979871/bad-hash!',
    'not a url',
    '',
  ])('rejects %s', (raw) => {
    expect(parseExternalVideoUrl(raw)).toBeNull();
  });
});

describe('toEmbedUrl', () => {
  it('uses the privacy-enhanced domains', () => {
    expect(toEmbedUrl({ kind: 'youtube', id: 'dQw4w9WgXcQ' })).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0',
    );
    expect(toEmbedUrl({ kind: 'vimeo', id: '1' })).toBe('https://player.vimeo.com/video/1?autoplay=1&dnt=1');
    expect(toEmbedUrl({ kind: 'vimeo', id: '1', hash: 'abc123' })).toBe(
      'https://player.vimeo.com/video/1?autoplay=1&dnt=1&h=abc123',
    );
  });
});

describe('toGalleryVideoItem', () => {
  it('maps a file video (alt falls back to the product title)', () => {
    const item = toGalleryVideoItem(video(), 'Mug');
    expect(item).toMatchObject({
      kind: 'video',
      id: 'v1',
      alt: 'Mug',
      durationS: 42,
      position: 1,
      source: { type: 'file', mime: 'video/mp4' },
    });
    expect(item?.source.type === 'file' && item.source.src.endsWith('/uploads/products/a.mp4')).toBe(true);
    expect(item?.url.endsWith('/uploads/products/a.webp')).toBe(true);
  });

  it('uses an empty poster url when there is no poster', () => {
    expect(toGalleryVideoItem(video({ poster_url: null }), 'Mug')?.url).toBe('');
  });

  it('drops a non-mp4 file and an unknown external host', () => {
    expect(toGalleryVideoItem(video({ url: '/uploads/products/a.webm' }), 'Mug')).toBeNull();
    expect(toGalleryVideoItem(video({ kind: 'youtube', url: 'https://evil.com/watch?v=dQw4w9WgXcQ' }), 'Mug')).toBeNull();
    // Kind and URL must agree.
    expect(toGalleryVideoItem(video({ kind: 'vimeo', url: 'https://youtu.be/dQw4w9WgXcQ' }), 'Mug')).toBeNull();
  });

  it('maps an external video with watch and embed URLs', () => {
    const item = toGalleryVideoItem(video({ kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', alt: 'Demo' }), 'Mug');
    expect(item?.alt).toBe('Demo');
    expect(item?.source).toEqual({
      type: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      watchUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0',
    });
  });

  it('toGalleryVideoItems keeps order and drops invalid entries', () => {
    const items = toGalleryVideoItems(
      [video({ id: 'a' }), video({ id: 'bad', kind: 'youtube', url: 'https://x.test/v' }), video({ id: 'b' })],
      'Mug',
    );
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(toGalleryVideoItems(undefined, 'Mug')).toEqual([]);
  });
});

describe('buildGalleryMedia', () => {
  it('returns the images unchanged (same ids, urls, alts) when there are no videos', () => {
    const leading = [img('lead')];
    const product = [img('a'), img('b')];
    const media = buildGalleryMedia(leading, product, []);
    expect(media).toEqual([...leading, ...product].map((i) => ({ kind: 'image', ...i })));
  });

  it('inserts a video after `position` product-level images', () => {
    const media = buildGalleryMedia([], [img('a'), img('b'), img('c')], [vItem('v', 1)]);
    expect(media.map((m) => m.id)).toEqual(['a', 'v', 'b', 'c']);
  });

  it('clamps the position to the product-level images (and keeps leading images first)', () => {
    const media = buildGalleryMedia([img('lead')], [img('a'), img('b')], [vItem('v9', 9), vItem('v0', 0)]);
    expect(media.map((m) => m.id)).toEqual(['lead', 'a', 'v0', 'b', 'v9']);
    expect(media[0].kind).toBe('image');
  });

  it('keeps input order among videos at the same slot', () => {
    const media = buildGalleryMedia([], [img('a'), img('b')], [vItem('x', 1), vItem('y', 1)]);
    expect(media.map((m) => m.id)).toEqual(['a', 'x', 'y', 'b']);
  });

  it('clamps against custom-product mockups (the product-level list)', () => {
    const media = buildGalleryMedia([], [img('mockup')], [vItem('v', 3)]);
    expect(media.map((m) => m.id)).toEqual(['mockup', 'v']);
  });

  it('puts videos after the leading images when there are no product-level images', () => {
    const media = buildGalleryMedia([img('lead')], [], [vItem('v', 2)]);
    expect(media.map((m) => m.id)).toEqual(['lead', 'v']);
  });

  it('drops every video when there are no images at all', () => {
    expect(buildGalleryMedia([], [], [vItem('v', 1)])).toEqual([]);
  });

  it('with the pre-dedupe base list, anchors a video to its original image', () => {
    const base = [img('a'), img('b'), img('c')];
    // 'a' moved into the leading block (a picked colour maps to it).
    const moved = buildGalleryMedia([img('a')], [img('b'), img('c')], [vItem('v', 1)], base);
    expect(moved.map((m) => m.id)).toEqual(['a', 'v', 'b', 'c']);
    // Without base, position counts the remaining product-level images.
    const counted = buildGalleryMedia([img('a')], [img('b'), img('c')], [vItem('v', 1)]);
    expect(counted.map((m) => m.id)).toEqual(['a', 'b', 'v', 'c']);
    // A later image moving up does not shift the video.
    const later = buildGalleryMedia([img('c')], [img('a'), img('b')], [vItem('v', 1)], base);
    expect(later.map((m) => m.id)).toEqual(['c', 'a', 'v', 'b']);
    // No dedupe: identical to the base-less result.
    expect(buildGalleryMedia([], base, [vItem('v', 2)], base)).toEqual(buildGalleryMedia([], base, [vItem('v', 2)]));
  });
});

describe('embedAllowed', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubConsent(stored: string | null, cookie = '') {
    const storage = new Map<string, string>();
    if (stored !== null) storage.set('consent:shop', stored);
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => storage.get(k) ?? null },
    });
    vi.stubGlobal('document', { cookie });
  }

  it('is false on the server and without a store', () => {
    expect(embedAllowed('shop')).toBe(false);
    stubConsent(JSON.stringify({ choice: 'granted', at: Date.now(), v: 2 }));
    expect(embedAllowed('')).toBe(false);
  });

  it('is false with no choice and with a denied choice', () => {
    stubConsent(null);
    expect(embedAllowed('shop')).toBe(false);
    stubConsent(JSON.stringify({ choice: 'denied', at: Date.now(), v: 2 }));
    expect(embedAllowed('shop')).toBe(false);
  });

  it('is true for a granted choice of any version', () => {
    stubConsent(JSON.stringify({ choice: 'granted', at: Date.now(), v: 2 }));
    expect(embedAllowed('shop')).toBe(true);
    stubConsent(JSON.stringify({ choice: 'granted', at: Date.now() }));
    expect(embedAllowed('shop')).toBe(true);
    stubConsent(null, 'consent_shop=granted');
    expect(embedAllowed('shop')).toBe(true);
  });
});

describe('formatVideoDuration', () => {
  it('formats m:ss and ignores unknown values', () => {
    expect(formatVideoDuration(42)).toBe('0:42');
    expect(formatVideoDuration(60)).toBe('1:00');
    expect(formatVideoDuration(125)).toBe('2:05');
    expect(formatVideoDuration(null)).toBeNull();
    expect(formatVideoDuration(0)).toBeNull();
  });
});

describe('buildVideoObjectsJsonLd', () => {
  const toAbsoluteUrl = (u: string) => (u.startsWith('http') ? u : `https://shop.test${u}`);

  it('builds VideoObjects only for valid videos with a poster', () => {
    const out = buildVideoObjectsJsonLd({
      videos: [
        video({ id: 'file', alt: 'Close-up' }),
        video({ id: 'noposter', poster_url: null }),
        video({ id: 'yt', kind: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ', duration_s: null, poster_url: '/uploads/products/y.webp' }),
        video({ id: 'bad', kind: 'vimeo', url: 'https://evil.test/1' }),
      ],
      productName: 'Mug',
      description: 'A mug.',
      toAbsoluteUrl,
    });
    expect(out).toEqual([
      {
        '@type': 'VideoObject',
        name: 'Close-up',
        description: 'A mug.',
        thumbnailUrl: 'https://shop.test/uploads/products/a.webp',
        uploadDate: '2026-11-13T10:00:00.000Z',
        duration: 'PT42S',
        contentUrl: 'https://shop.test/uploads/products/a.mp4',
      },
      {
        '@type': 'VideoObject',
        name: 'Mug',
        description: 'A mug.',
        thumbnailUrl: 'https://shop.test/uploads/products/y.webp',
        uploadDate: '2026-11-13T10:00:00.000Z',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      },
    ]);
  });

  it('falls back to the name as description and returns [] without videos', () => {
    const [entry] = buildVideoObjectsJsonLd({ videos: [video()], productName: 'Mug', toAbsoluteUrl });
    expect(entry.description).toBe('Mug');
    expect(buildVideoObjectsJsonLd({ videos: undefined, productName: 'Mug', toAbsoluteUrl })).toEqual([]);
  });
});

