import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { trustBadgesSection } from './TrustBadges';

const TrustBadges = trustBadgesSection.Component;

function html(
  props: Partial<SectionRenderProps> & { settings: Record<string, unknown>; content?: Record<string, unknown> },
) {
  return renderToStaticMarkup(
    <TrustBadges locale="en" primaryLocale="en" storeSlug="demo" content={{}} {...props} />,
  );
}

const ITEMS = [
  { icon: 'truck', label: 'Delivery', description: 'Sent within two days' },
  { icon: 'refresh', label: 'Returns' },
  { icon: 'unknown-key', label: 'Secure payment', description: 'Encrypted checkout' },
  { label: 'Support' },
];

// The snapshots were recorded before TrustBadges.tsx was edited and must stay
// byte-identical.
describe('trust-badges cards and inline output (unchanged)', () => {
  it('cards with the palette defaults', () => {
    expect(html({ settings: { ...trustBadgesSection.defaultSettings }, content: { items: ITEMS } })).toMatchSnapshot();
  });

  it('cards with nothing set', () => {
    expect(html({ settings: {}, content: { items: ITEMS } })).toMatchSnapshot();
  });

  it('inline, compact', () => {
    expect(html({ settings: { layout: 'inline', padding: 'compact' }, content: { items: ITEMS } })).toMatchSnapshot();
  });

  it('empty', () => {
    expect(html({ settings: { layout: 'cards' }, content: {} })).toMatchSnapshot();
    expect(html({ settings: { layout: 'inline' }, content: { items: [] }, locale: 'ar' })).toMatchSnapshot();
  });
});
