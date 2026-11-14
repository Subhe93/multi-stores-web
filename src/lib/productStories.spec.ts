import { describe, expect, it } from 'vitest';
import { resolveMediaUrl } from './api';
import {
  clampInt,
  readStoriesSettings,
  resolveStoryText,
  storySizes,
  toStoryCards,
  toStoryMedia,
  type StorefrontProductStory,
} from './productStories';

function story(overrides: Partial<StorefrontProductStory> = {}): StorefrontProductStory {
  return {
    id: 's1',
    kind: 'image',
    url: '/uploads/products/anna.webp',
    poster_url: null,
    duration_s: null,
    width: 900,
    height: 1600,
    name: 'Anna',
    rating: 5,
    verified: true,
    translations: [
      { locale: 'ar', quote: 'رائع', subtitle: 'الرياض' },
      { locale: 'en', quote: 'Great', subtitle: 'Stockholm' },
      { locale: 'sv', quote: 'Toppen', subtitle: '' },
    ],
    ...overrides,
  };
}

describe('resolveStoryText', () => {
  it('visitor locale first, then the primary locale, then the first row', () => {
    expect(resolveStoryText(story(), 'ar', 'en')).toEqual({ quote: 'رائع', subtitle: 'الرياض' });
    expect(resolveStoryText(story(), 'de', 'en')).toEqual({ quote: 'Great', subtitle: 'Stockholm' });
    expect(resolveStoryText(story(), 'de', 'fr')).toEqual({ quote: 'رائع', subtitle: 'الرياض' });
  });

  it('turns empty texts into null', () => {
    expect(resolveStoryText(story(), 'sv', 'en')).toEqual({ quote: 'Toppen', subtitle: null });
    expect(resolveStoryText(story({ translations: [] }), 'en', 'en')).toEqual({ quote: null, subtitle: null });
    expect(resolveStoryText(story({ translations: [{ locale: 'en', quote: '  ', subtitle: null }] }), 'en', 'en')).toEqual({
      quote: null,
      subtitle: null,
    });
  });

  it('keeps angle brackets as plain text', () => {
    const t = resolveStoryText(story({ translations: [{ locale: 'en', quote: '<b>hi</b> & bye', subtitle: null }] }), 'en', 'en');
    expect(t.quote).toBe('<b>hi</b> & bye');
  });
});

describe('toStoryMedia', () => {
  it('image -> resolved src', () => {
    expect(toStoryMedia(story(), 'Anna')).toEqual({ type: 'image', src: resolveMediaUrl('/uploads/products/anna.webp') });
    expect(toStoryMedia(story({ url: '' }), 'Anna')).toBeNull();
  });

  it('file -> a shared gallery video item named after the person', () => {
    const m = toStoryMedia(
      story({ kind: 'file', url: '/uploads/products/a.mp4', poster_url: '/uploads/video-posters/a.webp', duration_s: 42 }),
      'Anna',
    );
    expect(m).toMatchObject({
      type: 'video',
      kind: 'video',
      id: 's1',
      alt: 'Anna',
      url: resolveMediaUrl('/uploads/video-posters/a.webp'),
      durationS: 42,
      source: { type: 'file', mime: 'video/mp4' },
    });
    expect(toStoryMedia(story({ kind: 'file', url: '/uploads/products/a.mov' }), 'Anna')).toBeNull();
  });

  it('youtube / vimeo -> nocookie / dnt embeds; unknown hosts dropped', () => {
    const yt = toStoryMedia(story({ kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }), 'Anna');
    expect(yt && yt.type === 'video' && yt.source.type === 'youtube' && yt.source.embedUrl).toContain('youtube-nocookie.com');
    const vm = toStoryMedia(story({ kind: 'vimeo', url: 'https://vimeo.com/123456' }), 'Anna');
    expect(vm && vm.type === 'video' && vm.source.type === 'vimeo' && vm.source.embedUrl).toContain('dnt=1');
    expect(toStoryMedia(story({ kind: 'youtube', url: 'https://evil.com/watch?v=dQw4w9WgXcQ' }), 'Anna')).toBeNull();
    expect(toStoryMedia(story({ kind: 'vimeo', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }), 'Anna')).toBeNull();
  });
});

describe('toStoryCards', () => {
  it('keeps order, drops invalid media, normalises rating', () => {
    const cards = toStoryCards(
      [
        story({ id: 'a' }),
        story({ id: 'b', kind: 'youtube', url: 'nope' }),
        story({ id: 'c', rating: 9, verified: false }),
        story({ id: 'd', rating: null }),
      ],
      'en',
      'en',
    );
    expect(cards.map((c) => c.id)).toEqual(['a', 'c', 'd']);
    expect(cards.map((c) => c.rating)).toEqual([5, null, null]);
    expect(cards[0]).toMatchObject({ name: 'Anna', quote: 'Great', subtitle: 'Stockholm', verified: true });
  });

  it('empty or absent -> []', () => {
    expect(toStoryCards(undefined, 'en', 'en')).toEqual([]);
    expect(toStoryCards([], 'en', 'en')).toEqual([]);
  });
});

describe('settings', () => {
  it('defaults equal the contract', () => {
    expect(readStoriesSettings({})).toEqual({
      showHeading: true,
      layout: 'slider',
      aspect: 'portrait',
      columns: 4,
      columnsTablet: 3,
      columnsMobile: 1,
      textPosition: 'below',
      showRating: true,
      showSubtitle: true,
      showVerified: true,
    });
  });

  it('clamps columns, ignores unknown values, forces overlay text for the overlay layout', () => {
    const s = readStoriesSettings({ layout: 'overlay', text_position: 'below', columns: 12, columns_tablet: '0', columns_mobile: 'x', card_aspect: 'wide' });
    expect(s).toMatchObject({ layout: 'overlay', textPosition: 'overlay', columns: 6, columnsTablet: 1, columnsMobile: 1, aspect: 'portrait' });
    expect(readStoriesSettings({ layout: 'grid', text_position: 'overlay' }).textPosition).toBe('overlay');
    expect(clampInt(2.6, 1, 4, 3)).toBe(3);
  });

  it('sizes follow the columns per breakpoint', () => {
    expect(storySizes({ columns: 4, columnsTablet: 3, columnsMobile: 1 }, false)).toBe(
      '(min-width: 1024px) 25vw, (min-width: 768px) 34vw, 100vw',
    );
    expect(storySizes({ columns: 4, columnsTablet: 3, columnsMobile: 1 }, true)).toBe(
      '(min-width: 1024px) 25vw, (min-width: 768px) 34vw, 87vw',
    );
  });
});
