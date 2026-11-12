import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { footerColumnsSection } from './FooterColumns';

const FooterColumns = footerColumnsSection.Component;
const base = { settings: {}, content: { columns: [] }, locale: 'sv', primaryLocale: 'sv', storeSlug: 'demo' };

describe('FooterColumns empty state', () => {
  it('shows customers nothing in the live footer', () => {
    const { container } = render(<FooterColumns {...base} chrome />);
    expect(container.innerHTML).toBe('');
  });

  it('keeps the placeholder in the builder preview', () => {
    const { container } = render(<FooterColumns {...base} />);
    expect(container.textContent).toContain('No footer columns yet');
  });

  it('ships default links that exist on every store', () => {
    const urls = JSON.stringify(footerColumnsSection.defaultContent);
    expect(urls).not.toContain('/pages/');
  });
});
