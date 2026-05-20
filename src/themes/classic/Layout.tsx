import type { ThemeLayoutProps } from '../types';

// Classic theme layout. Warmer chrome than Minimal: a thin top brand strip on
// the surface tone, generous container padding, and decorative serif accents.
// Header/footer still come from the storefront chrome (slots), so this only
// owns the page frame around them.
export function ClassicLayout({ children, headerSlot, footerSlot }: ThemeLayoutProps) {
  return (
    <div
      className="theme-classic flex flex-col min-h-screen"
      style={{
        backgroundColor: 'var(--theme-colors-background)',
        color: 'var(--theme-colors-text)',
        fontFamily: 'var(--theme-font-body)',
        lineHeight: 'var(--theme-line-body)',
        // Contain full-bleed sections (width: 'full') so the 100vw trick
        // doesn't introduce a horizontal scrollbar when a vertical scrollbar
        // is present. `clip` preserves position: sticky inside, unlike hidden.
        overflowX: 'clip',
      }}
    >
      <div
        className="w-full"
        style={{ backgroundColor: 'var(--theme-colors-surface)', borderBottom: '1px solid var(--theme-colors-border)' }}
      >
        {headerSlot}
      </div>
      <main className="flex-1 w-full">
        <div
          className="mx-auto w-full px-6 sm:px-8 lg:px-12 py-2"
          style={{ maxWidth: 'var(--theme-container-max)' }}
        >
          {children}
        </div>
      </main>
      <div
        className="w-full mt-12"
        style={{ backgroundColor: 'var(--theme-colors-surface)', borderTop: '1px solid var(--theme-colors-border)' }}
      >
        {footerSlot}
      </div>
    </div>
  );
}
