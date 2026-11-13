import { describe, expect, it } from 'vitest';
import { buildProduct } from './jsonld';
import { buildVideoObjectsJsonLd, type StorefrontProductVideo } from './productVideo';

// Product JSON-LD and product video (contract 6.5): `image` stays image-only
// and `subjectOf` (VideoObject) appears only when the product has videos.

const base = {
  name: 'Mug',
  url: 'https://shop.example/products/mug',
  images: ['https://api.example/uploads/products/a.webp'],
  price: 100,
  priceCurrency: 'SEK',
};

const video: StorefrontProductVideo = {
  id: 'v1',
  kind: 'file',
  url: '/uploads/products/0f6c3d5e-1111-4222-8333-944455556666.mp4',
  poster_url: '/uploads/products/p.webp',
  duration_s: 32,
  width: 1280,
  height: 720,
  position: 1,
  alt: null,
  created_at: '2026-11-13T10:00:00.000Z',
};

const abs = (u: string) => (u.startsWith('http') ? u : `https://api.example${u}`);

describe('buildProduct and videos', () => {
  it('has no subjectOf without videos (unchanged JSON-LD)', () => {
    const plain = buildProduct(base);
    expect(plain).not.toHaveProperty('subjectOf');
    expect(JSON.stringify(buildProduct({ ...base, videos: [] }))).toBe(JSON.stringify(plain));
    expect(JSON.stringify(buildProduct({ ...base, videos: undefined }))).toBe(JSON.stringify(plain));
  });

  it('adds VideoObject entries as subjectOf; image stays image-only', () => {
    const videos = buildVideoObjectsJsonLd({
      videos: [video, { ...video, id: 'yt', kind: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ', alt: 'Demo' }, { ...video, id: 'np', poster_url: null }],
      productName: 'Mug',
      description: 'A mug.',
      toAbsoluteUrl: abs,
    });
    const ld = buildProduct({ ...base, videos }) as Record<string, unknown>;
    expect(ld.image).toEqual(base.images);
    expect(ld.subjectOf).toEqual([
      {
        '@type': 'VideoObject',
        name: 'Mug',
        description: 'A mug.',
        thumbnailUrl: 'https://api.example/uploads/products/p.webp',
        uploadDate: '2026-11-13T10:00:00.000Z',
        duration: 'PT32S',
        contentUrl: 'https://api.example/uploads/products/0f6c3d5e-1111-4222-8333-944455556666.mp4',
      },
      {
        '@type': 'VideoObject',
        name: 'Demo',
        description: 'A mug.',
        thumbnailUrl: 'https://api.example/uploads/products/p.webp',
        uploadDate: '2026-11-13T10:00:00.000Z',
        duration: 'PT32S',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      },
    ]);
  });
});
