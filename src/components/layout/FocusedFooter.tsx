'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useBackToSite } from '@/hooks/useFocusedStorefront';
import { useLocalePath } from '@/hooks/useLocalePath';
import { CompanyDetails } from '@/components/layout/CompanyDetails';
import type { TraderDetails } from '@/lib/traderDetails';

interface FocusedFooterProps {
  storeName: string;
  /** Legal pages at /legal/{slug}; titles are pre-localized by the API. */
  legalPages?: { slug: string; title: string }[];
  /** Root-relative href of the store's cookie page, or null. */
  cookiePolicyHref?: string | null;
  /** Seller of record (`seller_details ?? trader_details`). */
  traderDetails?: TraderDetails | null;
  /** Admin-configured platform name. */
  platformName?: string;
}

/**
 * Footer of a focused storefront (src/lib/focusedStorefront.ts): the legal
 * page links, the cookie page, the "back to site" link, the seller details
 * and the copyright / platform line. No menu or collection columns, no
 * contact column, no newsletter. The store layout renders it INSTEAD of the
 * built-in footer and of a published builder FOOTER page, and keeps the
 * cookie settings link after it.
 */
export function FocusedFooter({
  storeName,
  legalPages = [],
  cookiePolicyHref,
  traderDetails,
  platformName = 'ShopsDoor',
}: FocusedFooterProps) {
  const t = useTranslations();
  const lp = useLocalePath();
  const back = useBackToSite();
  const year = new Date().getFullYear();
  const linkClass = 'store-muted text-sm hover:underline underline-offset-2';

  return (
    <footer className="mt-auto border-t store-bd" data-focused-footer="">
      <div className="container mx-auto px-4 py-8 flex flex-col gap-6">
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label={t('footer.legalLinks')}>
          {legalPages.map((page) => (
            <Link prefetch={false} key={page.slug} href={lp(`/legal/${page.slug}`)} className={linkClass}>
              {page.title}
            </Link>
          ))}
          {cookiePolicyHref && (
            <Link prefetch={false} href={lp(cookiePolicyHref)} className={linkClass}>
              {t('consent.cookiePolicy')}
            </Link>
          )}
          {back && (
            <a href={back.href} rel={back.rel} className={linkClass} data-focused-back="">
              {back.label}
            </a>
          )}
        </nav>

        {/* Legal seller identity (e-handelslagen): shown once completed. */}
        <CompanyDetails trader={traderDetails} className="store-muted" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs store-muted">
          <span>
            &copy; {year} {storeName}. {t('common.allRightsReserved')}
          </span>
          <span>
            {t.rich('store.poweredBy', {
              name: platformName,
              b: (chunks) => <span className="font-semibold">{chunks}</span>,
            })}
          </span>
        </div>
      </div>
    </footer>
  );
}
