import type { Theme } from '../types';
import { minimalTheme } from '../minimal/theme';
import { ClassicLayout } from './Layout';
import { classicHeroBannerSection } from './sections/HeroBanner';
import { classicCallToActionSection } from './sections/CallToAction';

// Classic: warm tones, elegant serifs, framed editorial layouts. Inherits
// Minimal's RichText/Gallery/FAQ sections (their visuals adapt via tokens),
// and overrides Hero + CTA with classic-styled equivalents.
export const classicTheme: Theme = {
  ...minimalTheme,
  key: 'classic',
  label: { en: 'Classic', ar: 'كلاسيكي' },
  description: {
    en: 'Warm tones, elegant serifs, framed editorial layouts. Suits artisan and heritage brands.',
    ar: 'ألوان دافئة وخطوط Serif أنيقة وتخطيطات تحريرية مؤطّرة. يناسب علامات الحرف اليدوية والتراث.',
  },
  Layout: ClassicLayout,
  tokens: {
    ...minimalTheme.tokens,
    colors: {
      primary: '#7c2d12',
      secondary: '#451a03',
      accent: '#ca8a04',
      background: '#fffbeb',
      surface: '#fef3c7',
      text: '#1c1917',
      muted: '#78716c',
      border: '#e7e5e4',
      primaryContrast: '#fffbeb',
    },
    typography: {
      ...minimalTheme.tokens.typography,
      fontFamily: { heading: 'Merriweather', body: 'Lato' },
    },
  },
  sections: {
    ...minimalTheme.sections,
    'hero-banner': classicHeroBannerSection,
    'call-to-action': classicCallToActionSection,
  },
};
