import type { Theme, ThemeRegistry } from './types';
import { minimalTheme } from './minimal/theme';
import { boldTheme } from './bold/theme';
import { classicTheme } from './classic/theme';

export const THEMES: ThemeRegistry = {
  minimal: minimalTheme,
  bold: boldTheme,
  classic: classicTheme,
};

export const DEFAULT_THEME_KEY = 'minimal';

/**
 * Resolve a theme from its key, falling back to the default if the key is
 * unknown (e.g. a theme was renamed or removed in a deploy).
 */
export function resolveTheme(themeKey: string | null | undefined): Theme {
  if (themeKey && THEMES[themeKey]) return THEMES[themeKey];
  return THEMES[DEFAULT_THEME_KEY];
}

/**
 * Public summary used by the dashboard's theme gallery — strips out runtime
 * components (Layout, Component) which can't be serialised.
 */
export interface ThemeSummary {
  key: string;
  label: Record<string, string>;
  description: Record<string, string>;
  previewImage?: string;
}

export function listThemeSummaries(): ThemeSummary[] {
  return Object.values(THEMES).map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    previewImage: t.previewImage,
  }));
}
