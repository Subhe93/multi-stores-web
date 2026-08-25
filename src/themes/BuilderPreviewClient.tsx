'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Copy, EyeOff, Trash2 } from 'lucide-react';
import { resolveTheme } from './registry';
import { GOOGLE_FONT_SET } from '@/lib/google-fonts';
import { mergeTokens, tokensToCssVars } from './tokens';
import { SectionRenderer } from './SectionRenderer';
import type { ListingContext, ProductContext, SectionInstance, StoreContext, ThemeCustomizations } from './types';

// Only the builder that embedded this preview may drive it, and messages go
// only to it. Sections here render straight from the incoming payload (some as
// raw HTML), so an unrestricted listener let any page holding a handle to this
// window inject content. Null when unconfigured, which falls back to the old
// permissive behaviour rather than breaking the preview outright.
const PARENT_ORIGIN: string | null = (() => {
  const configured = process.env.NEXT_PUBLIC_DASHBOARD_URL;
  if (!configured) return null;
  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
})();

interface InitialPreviewState {
  themeKey: string;
  customizations: ThemeCustomizations;
  sections: SectionInstance[];
  locale: string;
  primaryLocale: string;
  product?: ProductContext;
  // Listing context for CATALOG_TEMPLATE / COLLECTION_TEMPLATE previews.
  listing?: ListingContext;
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
  // Fresh state for listeners registered once (inline editing).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    function onMessage(e: MessageEvent<IncomingMessage>) {
      if (e.source !== window.parent) return;
      if (PARENT_ORIGIN && e.origin !== PARENT_ORIGIN) return;
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
          listing: prev.listing,
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
    window.parent?.postMessage({ type: 'PREVIEW_READY' }, PARENT_ORIGIN ?? '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Click-to-edit: any click inside a section element bubbles to the dashboard.
  // Anchors and form submissions are suppressed so the iframe stays on the
  // preview — sections generate subdomain-relative URLs (e.g. `/products/x`)
  // that don't resolve under the builder's platform-origin path.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      // Don't re-fire selection while an inline edit is in progress.
      if (target?.isContentEditable) return;
      const node = target?.closest('[data-section-id]') as HTMLElement | null;
      if (!node) return;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      if (anchor) e.preventDefault();
      window.parent?.postMessage(
        { type: 'SECTION_CLICKED', section_id: node.dataset.sectionId },
        PARENT_ORIGIN ?? '*',
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

  // Inline editing: double-click a piece of text inside a section, edit it in
  // place, and the committed value is patched back through the dashboard.
  // The clicked element's text is matched against the section's resolved
  // content (top-level strings + repeater item strings) to find its field.
  useEffect(() => {
    function resolveContent(sectionId: string): Record<string, unknown> | null {
      const section = stateRef.current.sections.find((s) => s.id === sectionId);
      if (!section) return null;
      const rows = Array.isArray(section.translations) ? section.translations : [];
      return (
        rows.find((r) => r.locale === stateRef.current.locale)?.content ??
        rows.find((r) => r.locale === stateRef.current.primaryLocale)?.content ??
        rows[0]?.content ??
        null
      );
    }

    function findEditablePath(
      content: Record<string, unknown>,
      text: string,
    ): (string | number)[] | null {
      for (const [key, value] of Object.entries(content)) {
        if (typeof value === 'string' && value.trim() && value.trim() === text) return [key];
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            const item = value[i];
            if (!item || typeof item !== 'object') continue;
            for (const [subKey, subValue] of Object.entries(item as Record<string, unknown>)) {
              if (typeof subValue === 'string' && subValue.trim() && subValue.trim() === text) {
                return [key, i, subKey];
              }
            }
          }
        }
      }
      return null;
    }

    function startEdit(el: HTMLElement, sectionId: string, path: (string | number)[]) {
      const original = el.innerText;
      el.setAttribute('contenteditable', 'plaintext-only');
      // Older engines that reject 'plaintext-only' fall back to 'true'.
      if (!el.isContentEditable) el.setAttribute('contenteditable', 'true');
      el.style.outline = '2px dashed #6366f1';
      el.style.outlineOffset = '2px';
      el.style.cursor = 'text';
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);

      let finished = false;
      const finish = (commit: boolean) => {
        if (finished) return;
        finished = true;
        el.removeAttribute('contenteditable');
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.cursor = '';
        el.removeEventListener('blur', onBlur);
        el.removeEventListener('keydown', onKey);
        const value = el.innerText.trim();
        if (!commit || value === original.trim()) {
          el.innerText = original;
          return;
        }
        window.parent?.postMessage(
          { type: 'INLINE_EDIT', section_id: sectionId, path, value },
          PARENT_ORIGIN ?? '*',
        );
      };
      const onBlur = () => finish(true);
      const onKey = (ke: KeyboardEvent) => {
        if (ke.key === 'Enter' && !ke.shiftKey) {
          ke.preventDefault();
          finish(true);
        } else if (ke.key === 'Escape') {
          ke.preventDefault();
          finish(false);
        }
      };
      el.addEventListener('blur', onBlur);
      el.addEventListener('keydown', onKey);
    }

    function onDblClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target || target.isContentEditable) return;
      const wrapper = target.closest('[data-section-id]') as HTMLElement | null;
      const sectionId = wrapper?.dataset.sectionId;
      if (!wrapper || !sectionId) return;
      const content = resolveContent(sectionId);
      if (!content) return;
      // Walk from the clicked node up to the wrapper looking for an element
      // whose text matches a content field exactly.
      let el: HTMLElement | null = target;
      while (el && el !== wrapper) {
        const text = el.innerText?.trim();
        if (text) {
          const path = findEditablePath(content, text);
          if (path) {
            e.preventDefault();
            e.stopPropagation();
            startEdit(el, sectionId, path);
            return;
          }
        }
        el = el.parentElement;
      }
    }

    document.addEventListener('dblclick', onDblClick, true);
    return () => document.removeEventListener('dblclick', onDblClick, true);
  }, []);

  const theme = useMemo(() => resolveTheme(state.themeKey), [state.themeKey]);
  const tokens = useMemo(
    () => mergeTokens(theme.tokens, state.customizations),
    [theme, state.customizations],
  );
  const cssVars = useMemo(() => tokensToCssVars(tokens), [tokens]);

  // Load the theme's Google Fonts inside the preview. The live storefront gets
  // its font <link> from the server layout, which this iframe never renders —
  // without this, picking a font in the builder silently fell back to a system
  // font and looked like the setting did nothing.
  useEffect(() => {
    const families = Array.from(
      new Set(
        [tokens.typography.fontFamily.heading, tokens.typography.fontFamily.body].filter(
          (f): f is string => !!f && GOOGLE_FONT_SET.has(f),
        ),
      ),
    );
    const id = 'builder-preview-fonts';
    const existing = document.getElementById(id) as HTMLLinkElement | null;
    if (!families.length) {
      existing?.remove();
      return;
    }
    const query = families
      .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700`)
      .join('&');
    const href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
    if (existing) {
      if (existing.href !== href) existing.href = href;
      return;
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }, [tokens.typography.fontFamily.heading, tokens.typography.fontFamily.body]);

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
            listing={state.listing}
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
    window.parent?.postMessage(
      { type: 'SECTION_ACTION', section_id: sectionId, action },
      PARENT_ORIGIN ?? '*',
    );
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
