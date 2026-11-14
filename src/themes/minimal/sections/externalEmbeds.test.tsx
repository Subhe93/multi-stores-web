import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { clearExternalMediaConsent, externalMediaAllowed, grantExternalMediaConsent } from '@/lib/consent';

// Privacy of the builder sections that embed third parties: the video-embed
// section uses the two-click facade + youtube-nocookie / Vimeo dnt=1 like
// product videos (CONTRACT-AUTOPLAY A4), and the map section does not request
// Google Maps before "Show map".

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
vi.mock('@/hooks/useLocalePath', () => ({ useLocalePath: () => (p: string) => p }));
vi.mock('@/components/StoreImage', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  StoreImage: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { VideoEmbed } from './VideoEmbed.client';
import { MapSection } from './MapSection.client';

const base = { content: {}, locale: 'en', primaryLocale: 'en', storeSlug: 'demo' };
const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

afterEach(() => clearExternalMediaConsent('demo'));

describe('VideoEmbed privacy', () => {
  it('SSR renders no third-party iframe for YouTube (with or without a poster)', () => {
    const noPoster = renderToString(<VideoEmbed {...base} settings={{ video_url: YT }} />);
    const withPoster = renderToString(<VideoEmbed {...base} settings={{ video_url: YT, poster: '/uploads/p.webp' }} />);
    expect(noPoster).not.toContain('<iframe');
    expect(withPoster).not.toContain('<iframe');
    expect(withPoster).toContain('/uploads/p.webp');
  });

  it('without the external grant: facade first, [Play video] loads youtube-nocookie once', () => {
    const { container } = render(<VideoEmbed {...base} settings={{ video_url: YT }} />);
    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'product.externalVideoPlay' }));
    const src = container.querySelector('iframe')!.getAttribute('src')!;
    expect(src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0');
  });

  it('[Always allow external videos] stores the per-store grant', () => {
    render(<VideoEmbed {...base} settings={{ video_url: 'https://vimeo.com/76979871' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'product.externalVideoAlwaysAllow' }));
    expect(document.querySelector('iframe')!.getAttribute('src')).toContain('player.vimeo.com/video/76979871?autoplay=1&dnt=1');
    expect(externalMediaAllowed('demo')).toBe(true);
  });

  it('with the grant and no poster: muted nocookie embed loads directly', () => {
    grantExternalMediaConsent('demo');
    const { container } = render(<VideoEmbed {...base} settings={{ video_url: YT }} />);
    expect(container.querySelector('iframe')!.getAttribute('src')).toContain(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1',
    );
    expect(screen.queryByRole('button', { name: 'product.externalVideoPlay' })).toBeNull();
  });

  it('withdrawing the grant unmounts the embed again', () => {
    grantExternalMediaConsent('demo');
    const { container } = render(<VideoEmbed {...base} settings={{ video_url: YT }} />);
    expect(container.querySelector('iframe')).not.toBeNull();
    act(() => clearExternalMediaConsent('demo'));
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('own file videos are unchanged (no facade)', () => {
    const { container } = render(<VideoEmbed {...base} settings={{ video_url: '/uploads/a.mp4' }} />);
    expect(container.querySelector('video')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'product.externalVideoPlay' })).toBeNull();
  });
});

describe('MapSection privacy', () => {
  const content = { locations: [{ name: 'Namez', address: 'Hagavägen 36, Borlänge', lat: '60.48', lng: '15.42' }] };

  it('SSR and first render request nothing from Google; "Show map" loads the iframe', () => {
    expect(renderToString(<MapSection {...base} content={content} settings={{}} />)).not.toContain('maps.google.com');
    const { container } = render(<MapSection {...base} content={content} settings={{}} />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('link', { name: 'externalMap.privacy' }).getAttribute('href')).toBe('/legal/privacy');
    fireEvent.click(screen.getByRole('button', { name: 'externalMap.load' }));
    expect(container.querySelector('iframe')!.getAttribute('src')).toContain('https://maps.google.com/maps?q=60.48%2C15.42');
  });

  it('the builder preview shows the map directly', () => {
    const { container } = render(<MapSection {...base} builderPreview content={content} settings={{}} />);
    expect(container.querySelector('iframe')).not.toBeNull();
  });
});
