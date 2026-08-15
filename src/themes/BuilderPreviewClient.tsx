'use client';

import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Copy, EyeOff, Trash2 } from 'lucide-react';
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

interface SelectMessage {
  type: 'SELECT_SECTION';
  section_id: string | null;
}

type IncomingMessage = UpdateMessage | ScrollMessage | SelectMessage;

/**
 * Builder preview shell. Renders sections through the active theme's registry
 * and stays in sync with the dashboard via window.postMessage. Clicking a
 * section posts back to the parent so the Inspector can open the right form.
 */
export function BuilderPreviewClient({ storeSlug, initial }: BuilderPreviewClientProps) {
  const [state, setState] = useState<InitialPreviewState>(initial);
  // Section currently selected in the builder — outlined so the creator can
  // see exactly which block they are editing.
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      } else if (data.type === 'SELECT_SECTION') {
        setSelectedId(data.section_id ?? null);
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

  // Only [a-zA-Z0-9_-] can appear in section ids (uuids); strip anything else
  // so the injected CSS selector cannot be broken out of.
  const safeSelectedId = selectedId?.replace(/[^a-zA-Z0-9_-]/g, '') || null;

  return (
    <div
      data-theme={theme.key}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      lang={state.locale}
      className="store-root"
      style={cssVars as CSSProperties}
    >
      {/* Builder-only affordances: a subtle dashed outline on hover so blocks
          read as clickable, and a solid indigo frame + corner glow on the
          selected section so the creator always knows what they're editing. */}
      <style>{`
        [data-section-id] { cursor: pointer; transition: outline-color 120ms ease, box-shadow 120ms ease; outline: 1px dashed transparent; outline-offset: -1px; }
        [data-section-id]:hover { outline-color: rgba(99, 102, 241, 0.55); }
      `}</style>
      {safeSelectedId && (
        <style>{`
          [data-section-id="${safeSelectedId}"],
          [data-section-id="${safeSelectedId}"]:hover {
            outline: 2px solid #6366f1;
            outline-offset: -2px;
            box-shadow: inset 0 0 0 2px rgba(99, 102, 241, 0.12), 0 0 0 3px rgba(99, 102, 241, 0.18);
            border-radius: 2px;
          }
        `}</style>
      )}
      {safeSelectedId && (
        <SectionToolbar sectionId={safeSelectedId} sections={state.sections} />
      )}
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

/**
 * Floating action toolbar pinned to the selected section. Buttons post
 * SECTION_ACTION messages back to the dashboard, which owns the actual
 * mutations (duplicate / hide / delete / reorder) and undo history.
 */
function SectionToolbar({
  sectionId,
  sections,
}: {
  sectionId: string;
  sections: SectionInstance[];
}) {
  const t = useTranslations('builderPreview');
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  // Track the selected section's viewport position. `sections` is a dep so a
  // content update that re-renders (or replaces) the wrapper re-measures.
  useEffect(() => {
    const el = document.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    let frame = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      ro.disconnect();
    };
  }, [sectionId, sections]);

  if (!rect) return null;

  const send = (action: string) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.parent?.postMessage({ type: 'SECTION_ACTION', section_id: sectionId, action }, '*');
  };

  const buttons = [
    { action: 'move-up', title: t('moveUp'), Icon: ChevronUp },
    { action: 'move-down', title: t('moveDown'), Icon: ChevronDown },
    { action: 'duplicate', title: t('duplicate'), Icon: Copy },
    { action: 'hide', title: t('hide'), Icon: EyeOff },
    { action: 'delete', title: t('delete'), Icon: Trash2 },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: Math.max(rect.top, 0) + 8,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 6px',
        borderRadius: 999,
        background: 'rgba(24, 24, 27, 0.92)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {buttons.map(({ action, title, Icon }) => (
        <button
          key={action}
          type="button"
          title={title}
          aria-label={title}
          onClick={send(action)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: 999,
            color: action === 'delete' ? '#f87171' : '#fff',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
