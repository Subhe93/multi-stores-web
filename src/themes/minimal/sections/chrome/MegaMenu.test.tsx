import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { megaMenuSection } from './MegaMenu';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const MegaMenu = megaMenuSection.Component;

const triggers = [
  {
    label: 'Shop',
    url: '/products',
    columns: [{ heading: 'Browse', links: [{ label: 'New', url: '/products?sort=newest' }] }],
    // The schema stores the feature card as a repeater (first row is used).
    feature: [{ image: '/uploads/promo.jpg', caption: 'Spring edit', url: '/collections' }],
  },
];

function renderMenu(locale = 'sv') {
  return render(
    <MegaMenu settings={{}} content={{ triggers }} locale={locale} primaryLocale="sv" storeSlug="demo" />,
  );
}

describe('MegaMenu', () => {
  it('renders the feature card stored as a repeater row', () => {
    renderMenu();
    expect(screen.getByText('Spring edit')).toBeTruthy();
  });

  it('keeps secondary-locale visitors on their locale', () => {
    const { container } = renderMenu('ar');
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/ar/products');
    expect(hrefs).toContain('/ar/products?sort=newest');
    expect(hrefs).toContain('/ar/collections');
  });

  it('scopes the disclosure-marker rule to its own accordion', () => {
    const { container } = renderMenu();
    const css = container.querySelector('style')?.innerHTML ?? '';
    expect(css).toContain('.mega-menu-mobile details > summary');
    expect(css).not.toMatch(/(^|\n)\s*details > summary/);
  });

  it('ships default links that exist on every store', () => {
    const urls = JSON.stringify(megaMenuSection.defaultContent);
    expect(urls).not.toContain('/pages/');
    expect(urls).not.toContain('spring-2026');
  });
});
