import { Fragment } from 'react';
import type { ProductContext, SectionInstance, StoreContext, Theme } from './types';
import { animationClass, readSectionStyle, resolveSectionStyle } from './sectionStyle';
import { Reveal } from './_motion';

// Build a class name that is unique per section and safe as a CSS identifier.
// Section ids are uuids/cuids so we just strip non-word chars to be safe.
function scopeClassFor(sectionId: string): string {
  return `s-${sectionId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

interface SectionRendererProps {
  theme: Theme;
  sections: SectionInstance[];
  locale: string;
  storeSlug: string;
  primaryLocale: string;
  // Forwarded to every section. Only magic sections read it; the rest ignore.
  product?: ProductContext;
  currency?: string;
  // Forwarded to chrome sections (HEADER / FOOTER) so they can render the
  // store name, logo, locales and pages without re-fetching.
  storeContext?: StoreContext;
  // Chrome mode (HEADER / FOOTER pages). Renders each section's wrappers as
  // `display: contents` so they don't generate a box. A boxed wrapper would
  // become the containing block of a `position: sticky` header and, being
  // only as tall as the header itself, would give it no room to stick — the
  // header would scroll away. Removing the box lets the sticky header's
  // containing block fall through to the tall page layout.
  chrome?: boolean;
}

/**
 * Renders an ordered list of section instances using the components declared
 * by the active theme. Sections whose key is unknown for the current theme are
 * skipped (so swapping themes doesn't blow up the page if a section has no
 * equivalent in the new theme).
 */
export function SectionRenderer({
  theme,
  sections,
  locale,
  storeSlug,
  primaryLocale,
  product,
  currency,
  storeContext,
  chrome,
}: SectionRendererProps) {
  // In chrome mode the wrapper boxes are collapsed so a sticky header can
  // anchor to the page layout rather than its own tight wrapper.
  const wrapperStyle = chrome ? ({ display: 'contents' } as const) : undefined;
  return (
    <>
      {sections
        .filter((s) => !s.is_hidden)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((section) => {
          const def = theme.sections[section.section_key];
          // Skip sections whose key isn't registered in the active theme OR
          // whose definition is broken (missing Component). Either condition
          // means "this section can't render in this theme" rather than a
          // crash — switching themes or shipping a bad section shouldn't
          // blank out the whole page.
          // Use a loose truthy check — in RSC builds, client component refs
          // are objects (module references), not raw functions.
          if (!def || !def.Component) {
            if (process.env.NODE_ENV !== 'production') {
              // eslint-disable-next-line no-console
              console.warn(
                `[SectionRenderer] No component for section_key="${section.section_key}" in theme "${theme.key}". Skipping.`,
              );
            }
            return null;
          }
          // Resolve content per locale with primary as fallback, then any row.
          // Tolerate both the array shape (API + snapshot) and the legacy
          // record-keyed shape some older snapshots used.
          const rawTranslations = section.translations as unknown;
          let content: Record<string, unknown> = {};
          if (Array.isArray(rawTranslations)) {
            const t = rawTranslations as Array<{ locale: string; content: Record<string, unknown> }>;
            content =
              t.find((row) => row.locale === locale)?.content ||
              t.find((row) => row.locale === primaryLocale)?.content ||
              t[0]?.content ||
              {};
          } else if (rawTranslations && typeof rawTranslations === 'object') {
            const t = rawTranslations as Record<string, Record<string, unknown>>;
            content = t[locale] || t[primaryLocale] || Object.values(t)[0] || {};
          }
          const Component = def.Component;
          // Per-section style overrides come back as a single scoped CSS
          // string we inject alongside the wrapper. The wrapper carries the
          // scope class so the rules in that <style> block can target it;
          // the inner div carries `{scope}-i` so width/colour rules can
          // target inner separately (e.g. inner.max-width for 'container').
          const sectionStyle = readSectionStyle(section.settings);
          const wrapperScope = scopeClassFor(section.id);
          const innerScope = `${wrapperScope}-i`;
          const { css } = resolveSectionStyle(sectionStyle, wrapperScope);
          const animClass = animationClass(sectionStyle?.animate);
          const wrapperClass = [wrapperScope, animClass].filter(Boolean).join(' ');
          const inner = (
            <div className={innerScope} style={wrapperStyle}>
              <Component
                settings={section.settings}
                content={content}
                locale={locale}
                primaryLocale={primaryLocale}
                storeSlug={storeSlug}
                product={product}
                currency={currency}
                storeContext={storeContext}
              />
            </div>
          );
          return (
            <Fragment key={section.id}>
              {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
              {chrome ? (
                // Chrome (header/footer) keeps a plain, display:contents wrapper —
                // no scroll-reveal (a sticky header must not start hidden/offset).
                <div
                  data-section-id={section.id}
                  data-section-key={section.section_key}
                  className={wrapperClass}
                  style={wrapperStyle}
                >
                  {inner}
                </div>
              ) : (
                // Page-content sections fade/slide in as they scroll into view
                // (framer-motion; degrades to visible under reduced motion).
                <Reveal
                  data-section-id={section.id}
                  data-section-key={section.section_key}
                  className={wrapperClass}
                  style={wrapperStyle}
                >
                  {inner}
                </Reveal>
              )}
            </Fragment>
          );
        })}
    </>
  );
}
