import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { heroSplitSection } from './HeroSplit';

const HeroSplit = heroSplitSection.Component;

function html(
  props: Partial<SectionRenderProps> & { settings: Record<string, unknown>; content?: Record<string, unknown> },
) {
  return renderToStaticMarkup(
    <HeroSplit locale="en" primaryLocale="en" storeSlug="demo" content={{}} {...props} />,
  );
}

const CONTENT = {
  eyebrow: 'New season',
  heading: 'Made to last',
  subheading: 'One or two lines about the range.',
  cta_text: 'Shop now',
  cta_secondary_text: 'Our story',
};

// Settings as stored today (no `variant`, no `cta_tone`). The snapshots were
// recorded before HeroSplit.tsx was edited and must stay byte-identical.
const FRAMED_CASES: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
  ['palette defaults', { ...heroSplitSection.defaultSettings }, { ...heroSplitSection.defaultContent }],
  [
    'image at the start',
    { image: '/uploads/pages/hero.jpg', image_side: 'start', height: 'md', cta_url: '/products', cta_secondary_url: '/about' },
    CONTENT,
  ],
  [
    'image at the end with colour and border overrides',
    {
      image: 'https://cdn.example.com/hero.jpg',
      image_side: 'end',
      height: 'lg',
      heading_level: 'h2',
      eyebrow_color: '#333333',
      heading_color: '#111111',
      subheading_color: '#555555',
      cta_bg_color: '#ff0000',
      cta_text_color: '#ffffff',
      cta_border_color: '#000000',
      cta_border_width: 2,
      cta_border_radius: 4,
      cta_secondary_border_color: '#00ff00',
      cta_secondary_border_width: 1,
      cta_secondary_border_radius: 0,
      cta_url: '/products',
    },
    CONTENT,
  ],
  ['empty', {}, {}],
];

describe('hero-split framed output (unchanged)', () => {
  for (const [name, settings, content] of FRAMED_CASES) {
    it(name, () => {
      expect(html({ settings, content })).toMatchSnapshot();
    });
  }
});
