import type { ReactNode } from 'react';
import { SmoothScroll } from './providers/SmoothScroll';
import { MarketingHeader } from './MarketingHeader';
import { MarketingFooter } from './MarketingFooter';

/**
 * Chrome shared by every ShopsDoor platform page (landing, company, legal):
 * brand root, Lenis smooth scrolling, header and footer.
 */
export function MarketingShell({ locale, children, solidHeader = false }: { locale: string; children: ReactNode; solidHeader?: boolean }) {
  return (
    <div className="sd-root" lang={locale}>
      <SmoothScroll>
        <MarketingHeader locale={locale} solid={solidHeader} />
        <main>{children}</main>
        <MarketingFooter locale={locale} />
      </SmoothScroll>
    </div>
  );
}
