import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { layoutColumnsSection } from './LayoutColumns';

const LayoutColumns = layoutColumnsSection.Component;

function renderBlocks(blocks: Record<string, unknown>[]) {
  return render(
    <LayoutColumns
      settings={{}}
      content={{ cells: [{ col_span: 1, blocks }] }}
      locale="sv"
      primaryLocale="sv"
      storeSlug="demo"
    />,
  ).container;
}

describe('LayoutColumns blocks', () => {
  it('renders a heading as an H1 with a link', () => {
    const c = renderBlocks([{ type: 'heading', text: 'Kontakta oss', level: 'h1', link: '/kontakta-oss' }]);
    const h1 = c.querySelector('h1');
    expect(h1?.textContent).toBe('Kontakta oss');
    expect(h1?.querySelector('a')?.getAttribute('href')).toBe('/kontakta-oss');
  });

  it('renders the label heading style with the footer title classes', () => {
    const c = renderBlocks([{ type: 'heading', text: 'Snabblänkar', level: 'h3', heading_style: 'label' }]);
    expect(c.querySelector('h3')?.className).toContain('uppercase');
  });

  it('applies the muted tone to text', () => {
    const c = renderBlocks([{ type: 'text', html: '<p>Hej</p>', tone: 'muted' }]);
    expect(c.innerHTML).toContain('var(--theme-colors-muted)');
  });

  it('renders an image row with links, skipping empty items', () => {
    const c = renderBlocks([
      {
        type: 'images',
        item_height_px: 40,
        images: [
          { image: '/uploads/pages/a.svg', alt: 'Visa', link: '' },
          { image: '/uploads/pages/b.svg', alt: 'Klarna', link: 'https://klarna.com' },
          { image: '', alt: 'empty' },
        ],
      },
    ]);
    const imgs = c.querySelectorAll('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0].getAttribute('alt')).toBe('Visa');
    const a = c.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://klarna.com');
    expect(a?.getAttribute('target')).toBe('_blank');
  });

  it('renders social icons for known platforms with a link', () => {
    const c = renderBlocks([
      {
        type: 'social',
        socials: [
          { platform: 'instagram', url: 'https://www.instagram.com/namez.se/' },
          { platform: 'nope', url: 'https://example.com' },
          { platform: 'facebook', url: '' },
        ],
      },
    ]);
    const links = c.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('aria-label')).toBe('Instagram');
    expect(links[0].querySelector('svg')).not.toBeNull();
  });

  it('renders an image with a fixed width and a link', () => {
    const c = renderBlocks([{ type: 'image', image: '/uploads/pages/logo.webp', alt: 'namez', width_px: 200, link: '/' }]);
    const a = c.querySelector('a');
    expect(a?.getAttribute('href')).toBe('/');
    expect(a?.querySelector('img')?.getAttribute('alt')).toBe('namez');
  });
});
