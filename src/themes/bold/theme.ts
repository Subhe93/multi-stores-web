import type { Theme } from '../types';
import { minimalTheme } from '../minimal/theme';

// Placeholder. Phase 2 replaces this with a full theme (custom Layout +
// dedicated section components). For now it reuses Minimal's sections but
// ships its own bold tokens so creators can preview the difference.
export const boldTheme: Theme = {
  ...minimalTheme,
  key: 'bold',
  label: { en: 'Bold', ar: 'جريء' },
  description: {
    en: 'High-contrast, energetic palette with confident type. Suits streetwear and youth brands.',
    ar: 'ألوان متباينة وحيوية مع خطوط واثقة. يناسب علامات الستريت وير وعلامات الشباب.',
  },
  tokens: {
    ...minimalTheme.tokens,
    colors: {
      primary: '#ff3d00',
      secondary: '#0a0a0a',
      accent: '#ffd600',
      background: '#0a0a0a',
      surface: '#1a1a1a',
      text: '#fafafa',
      muted: '#a1a1aa',
      border: '#2a2a2a',
      primaryContrast: '#ffffff',
    },
    typography: {
      ...minimalTheme.tokens.typography,
      fontFamily: { heading: 'Montserrat', body: 'Inter' },
      fontWeight: { heading: 800, body: 400, bold: 700 },
    },
  },
};
