'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { resolveTheme } from './registry';
import { mergeTokens, tokensToCssVars } from './tokens';
import { SectionRenderer } from './SectionRenderer';
import type { ProductContext, SectionInstance, StoreContext, ThemeCustomizations } from './types';

interface InitialPreviewState {
  themeKey: string;
  customizations: ThemeCustomizations;
  sections: SectionInstance[];
  locale: string;
  primaryLocale: string;
  product?: ProductContext;
  currency?: string;
  // Store-wide context so chrome sections (Header/Footer) resolve menus,
  // logo, store name and locales in the preview just like the live store.
  storeContext?: StoreContext;
}

interface BuilderPreviewClientProps {
  storeSlug: string;
  initial: InitialPreviewState;
}

interface UpdateMessage {
  type: 'UPDATE_SECTIONS';
  themeKey?: string;
  customizations?: ThemeCustomizations;
  sections?: SectionInstance[];
  locale?: string;
  primaryLocale?: string;
  // Forwarded from the dashboard so header/footer sections resolve a selected
  // menu live (kept fresh, including menus created this session).
  menus?: NonNullable<StoreContext['menus']>;
}

interface ScrollMessage {
  type: 'SCROLL_TO_SECTION';
  section_id: string;
}

type IncomingMessage = UpdateMessage | ScrollMessage;

/**
 * Builder preview shell. Renders sections through the active theme's registry
 * and stays in sync with the dashboard via window.postMessage. Clicking a
 * section posts back to the parent so the Inspector can open the right form.
 */
export function BuilderPreviewClient({ storeSlug, initial }: BuilderPreviewClientProps) {
  const [state, setState] = useState<InitialPreviewState>(initial);

  useEffect(() => {
    function onMessage(e: MessageEvent<IncomingMessage>) {
      // We don't restrict origin here on purpose — the dashboard origin in dev
      // and prod is set via env. Restrict before shipping to prod multi-tenant.
      const data = e.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'UPDATE_SECTIONS') {
        setState((prev) => ({
          themeKey: data.themeKey ?? prev.themeKey,
          customizations: data.customizations ?? prev.customizations,
          sections: data.sections ?? prev.sections,
          locale: data.locale ?? prev.locale,
          primaryLocale: data.primaryLocale ?? prev.primaryLocale,
          // Preserve preview-only context the dashboard never sends — but fold
          // in fresh menus when provided so chrome sections resolve them.
          product: prev.product,
          currency: prev.currency,
          storeContext: data.menus
            ? {
                ...(prev.storeContext ?? {
                  storeName: '',
                  primaryLocale: data.primaryLocale ?? prev.primaryLocale,
                  secondaryLocales: [],
                  pages: [],
                }),
                menus: data.menus,
              }
            : prev.storeContext,
        }));
      } else if (data.type === 'SCROLL_TO_SECTION') {
        const el = document.querySelector(
          `[data-section-id="${data.section_id}"]`,
        );
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    window.addEventListener('message', onMessage);
    // Tell the dashboard we're ready to receive the initial sync.
    window.parent?.postMessage({ type: 'PREVIEW_READY' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Click-to-edit: any click inside a section element bubbles to the dashboard.
  // Anchors and form submissions are suppressed so the iframe stays on the
  // preview — sections generate subdomain-relative URLs (e.g. `/products/x`)
  // that don't resolve under the builder's platform-origin path.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const node = target?.closest('[data-section-id]') as HTMLElement | null;
      if (!node) return;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      if (anchor) e.preventDefault();
      window.parent?.postMessage(
        { type: 'SECTION_CLICKED', section_id: node.dataset.sectionId },
        '*',
      );
    }
    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLElement | null;
      if (form?.closest('[data-section-id]')) e.preventDefault();
    }
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, []);

  const theme = useMemo(() => resolveTheme(state.themeKey), [state.themeKey]);
  const tokens = useMemo(
    () => mergeTokens(theme.tokens, state.customizations),
    [theme, state.customizations],
  );
  const cssVars = useMemo(() => tokensToCssVars(tokens), [tokens]);

  return (
    <div
      data-theme={theme.key}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      lang={state.locale}
      className="store-root"
      style={cssVars as CSSProperties}
    >
      {/* Render through theme.Layout so creators see exactly the page chrome
          their theme provides (decorative strips, spacing, padding). No
          header/footer slots — preview is a clean canvas for editing. */}
      <theme.Layout
        storeSlug={storeSlug}
        locale={state.locale}
        storeName=""
      >
        {state.sections.length === 0 ? (
          <div
            className="text-center py-24 text-sm"
            style={{ color: 'var(--theme-colors-muted)' }}
          >
            Add a section from the left panel to start building.
          </div>
        ) : (
          <SectionRenderer
            theme={theme}
            sections={state.sections}
            locale={state.locale}
            primaryLocale={state.primaryLocale}
            storeSlug={storeSlug}
            product={state.product}
            currency={state.currency}
            storeContext={state.storeContext}
          />
        )}
      </theme.Layout>
    </div>
  );
}
