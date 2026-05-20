import type { ThemeTokens } from '../types';

// Minimal — clean, generous whitespace, neutral palette, serif-paired-with-sans.
export const minimalTokens: ThemeTokens = {
  colors: {
    primary: '#111827',
    secondary: '#374151',
    accent: '#2563eb',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#0f172a',
    muted: '#6b7280',
    border: '#e5e7eb',
    primaryContrast: '#ffffff',
  },
  typography: {
    fontFamily: { heading: 'Playfair Display', body: 'Inter' },
    // Larger, more confident headline scale (h1/h2/h3 render fluid via clamp in
    // tokensToCssVars so they stay responsive on small screens).
    scale: { h1: 3.5, h2: 2.6, h3: 1.95, h4: 1.4, h5: 1.15, h6: 1, body: 1, small: 0.875 },
    lineHeight: { heading: 1.1, body: 1.65 },
    fontWeight: { heading: 700, body: 400, bold: 700 },
  },
  spacing: {
    // Soft & Rounded: larger corner radii and softer, more diffuse shadows so
    // cards/buttons/images across every section read friendly and modern.
    radius: { sm: '10px', md: '16px', lg: '24px', full: '9999px' },
    shadow: {
      sm: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.05)',
      md: '0 6px 20px rgb(15 23 42 / 0.07), 0 2px 6px rgb(15 23 42 / 0.05)',
      lg: '0 20px 48px rgb(15 23 42 / 0.12), 0 6px 16px rgb(15 23 42 / 0.08)',
    },
    containerMaxWidth: '1200px',
  },
};
