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

  it('click mode: an empty options object keeps the URL unchanged', () => {
    expect(toEmbedUrl({ kind: 'youtube', id: 'dQw4w9WgXcQ' }, {})).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0',
    );
  });

  it('muted autoplay (YouTube): mute, JS API, encoded origin, optional loop playlist', () => {
    expect(
      toEmbedUrl({ kind: 'youtube', id: 'dQw4w9WgXcQ' }, { autoplayMuted: true, origin: 'https://namz.se' }),
    ).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1&origin=https%3A%2F%2Fnamz.se',
    );
    expect(
      toEmbedUrl({ kind: 'youtube', id: 'dQw4w9WgXcQ' }, { autoplayMuted: true, loop: true, origin: 'https://a.b' }),
    ).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1&origin=https%3A%2F%2Fa.b&loop=1&playlist=dQw4w9WgXcQ',
    );
  });

  it('muted autoplay (Vimeo): muted, dnt, loop and hash', () => {
    expect(toEmbedUrl({ kind: 'vimeo', id: '1' }, { autoplayMuted: true })).toBe(
      'https://player.vimeo.com/video/1?autoplay=1&muted=1&playsinline=1&dnt=1',
    );
    expect(toEmbedUrl({ kind: 'vimeo', id: '1', hash: 'abc123' }, { autoplayMuted: true, loop: true })).toBe(
      'https://player.vimeo.com/video/1?autoplay=1&muted=1&playsinline=1&dnt=1&loop=1&h=abc123',
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

  it('maps autoplay / loop / featured position (CONTRACT-AUTOPLAY)', () => {
    expect(toGalleryVideoItem(video({ position: 0, autoplay: true, loop: true }), 'Mug')).toMatchObject({
      position: 0,
      autoplay: true,
      loop: true,
    });
    // Loop only applies to autoplay.
    expect(toGalleryVideoItem(video({ autoplay: false, loop: true }), 'Mug')).toMatchObject({ autoplay: false, loop: false });
    // An older API omits the fields: no autoplay, no loop.
    expect(toGalleryVideoItem(video(), 'Mug')).toMatchObject({ autoplay: false, loop: false, position: 1 });
    // Missing or negative positions.
    expect(toGalleryVideoItem(video({ position: Number.NaN }), 'Mug')?.position).toBe(1);
    expect(toGalleryVideoItem(video({ position: -3 }), 'Mug')?.position).toBe(0);
    expect(toGalleryVideoItem(video({ position: 2.7 }), 'Mug')?.position).toBe(2);
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
    // Position 0 is the featured slot (CONTRACT-AUTOPLAY A1): right after the leading block.
    expect(media.map((m) => m.id)).toEqual(['lead', 'v0', 'a', 'b', 'v9']);
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

  // Featured video (CONTRACT-AUTOPLAY A1): position 0 takes slot 0.
  it('puts a featured video (position 0) first when there is no leading block', () => {
    const out = buildGalleryMedia([], [img('a'), img('b')], [vItem('f', 0), vItem('v', 1)]);
    expect(out.map((m) => m.id)).toEqual(['f', 'a', 'v', 'b']);
    expect(out[0].kind).toBe('video');
  });

  it('puts a featured video right after the leading images when a colour image leads', () => {
    const out = buildGalleryMedia([img('x')], [img('a'), img('b')], [vItem('f', 0)]);
    expect(out.map((m) => m.id)).toEqual(['x', 'f', 'a', 'b']);
  });

  it('keeps a featured video at slot 0 with base anchoring', () => {
    const base = [img('a'), img('b'), img('c')];
    // 'b' moved into the leading block; the featured video is not anchored to any image.
    expect(buildGalleryMedia([img('b')], [img('a'), img('c')], [vItem('f', 0)], base).map((m) => m.id)).toEqual([
      'b',
      'f',
      'a',
      'c',
    ]);
    expect(buildGalleryMedia([], base, [vItem('f', 0)], base).map((m) => m.id)).toEqual(['f', 'a', 'b', 'c']);
  });

  it('a non-featured video never opens the list without a leading block, even with base anchoring', () => {
    const base = [img('a'), img('b')];
    // Position 1 anchored to 'a', which moved away from productLevel: still slot >= 1.
    expect(buildGalleryMedia([], [img('b')], [vItem('v', 1)], base).map((m) => m.id)).toEqual(['b', 'v']);
  });

  it('keeps payload order when two videos claim position 0 (the API allows only one)', () => {
    const out = buildGalleryMedia([], [img('a')], [vItem('f1', 0), vItem('f2', 0)]);
    expect(out.map((m) => m.id)).toEqual(['f1', 'f2', 'a']);
  });

  it('drops a featured video when there are no images, and follows the leading block when n is 0', () => {
    expect(buildGalleryMedia([], [], [vItem('f', 0)])).toEqual([]);
    expect(buildGalleryMedia([img('x')], [], [vItem('f', 0)]).map((m) => m.id)).toEqual(['x', 'f']);
  });
});

describe('embedAllowed', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // `tracking`: the general banner choice; `external`: the separate
  // "Always allow external videos" grant (CONTRACT-AUTOPLAY A4/A5).
  function stubConsent(tracking: string | null, external: string | null = null, cookie = '') {
    const storage = new Map<string, string>();
    if (tracking !== null) storage.set('consent:shop', tracking);
    if (external !== null) storage.set('consent:shop:external-media', external);
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => storage.get(k) ?? null },
    });
    vi.stubGlobal('document', { cookie });
  }

  it('is false on the server and without a store', () => {
    expect(embedAllowed('shop')).toBe(false);
    stubConsent(null, JSON.stringify({ choice: 'granted', at: Date.now(), v: 1 }));
    expect(embedAllowed('')).toBe(false);
  });

  it('is false with no choice and with a denied choice', () => {
    stubConsent(null);
    expect(embedAllowed('shop')).toBe(false);
    stubConsent(JSON.stringify({ choice: 'denied', at: Date.now(), v: 2 }));
    expect(embedAllowed('shop')).toBe(false);
  });

  it('a general "Accept all" alone no longer unlocks embeds (A5)', () => {
    stubConsent(JSON.stringify({ choice: 'granted', at: Date.now(), v: 2 }));
    expect(embedAllowed('shop')).toBe(false);
    stubConsent(null, null, 'consent_shop=granted.2');
    expect(embedAllowed('shop')).toBe(false);
  });

  it('is true only with the external-media grant (storage or cookie)', () => {
    stubConsent(null, JSON.stringify({ choice: 'granted', at: Date.now(), v: 1 }));
    expect(embedAllowed('shop')).toBe(true);
    stubConsent(JSON.stringify({ choice: 'denied', at: Date.now(), v: 2 }), JSON.stringify({ choice: 'granted', at: Date.now(), v: 1 }));
    expect(embedAllowed('shop')).toBe(true);
    stubConsent(null, null, 'xmedia_shop=granted.1');
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

