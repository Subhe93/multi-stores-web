import type { ThemeLayoutProps } from '../types';
import { MotionProvider } from '../_motion';

// Minimal theme layout: thin container, generous spacing, no decorative chrome.
// Header/footer slots come from the storefront layout (they already build the
// navigation tree from CMS data), so this only owns the outer page frame.
export function MinimalLayout({ children, headerSlot, footerSlot }: ThemeLayoutProps) {
  return (
    <MotionProvider>
    <div
      className="theme-minimal flex flex-col min-h-screen"
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
      {headerSlot}
      <main className="flex-1 w-full">
        <div
          className="mx-auto w-full px-4 sm:px-6 lg:px-8"
          style={{ maxWidth: 'var(--theme-container-max)' }}
        >
          {children}
        </div>
      </main>
      {footerSlot}
    </div>
    </MotionProvider>
  );
}
