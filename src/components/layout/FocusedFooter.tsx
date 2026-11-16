'use client';

import Link from 'next/link';
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useBackToSite } from '@/hooks/useFocusedStorefront';
import { useLocalePath } from '@/hooks/useLocalePath';
import { CookieSettingsLink } from '@/components/tracking/CookieSettingsLink';
import { FOCUSED_CONTAINER_CLASS, FOCUSED_CONTAINER_STYLE } from '@/components/layout/FocusedHeader';
import { resolveMediaUrl } from '@/lib/api';
import { isSvgSrc, responsiveImgProps } from '@/lib/storeMedia';
import { localizeStoreUrl } from '@/lib/storeUrl';
import { formatOrgNumber, hasTraderDetails, traderAddressLines, type TraderDetails } from '@/lib/traderDetails';

export interface FocusedFooterLink {
  label: string;
  url: string;
  open_in_new_tab?: boolean;
}

interface FocusedFooterProps {
  storeName: string;
  /** Store logo; shown light on the dark band (see `FooterLogo`). */
  logoUrl?: string;
  /**
   * Items of the store's `footer` navigation menu. When it has any, they ARE
   * the links column (absolute URLs as given, relative ones as store links)
   * and the `/legal/*` list below is not shown.
   */
  menuLinks?: FocusedFooterLink[];
  /** Legal pages at /legal/{slug} (fallback links); titles are pre-localized by the API. */
  legalPages?: { slug: string; title: string }[];
  /** Root-relative href of the store's cookie page, or null. */
  cookiePolicyHref?: string | null;
  /** Seller of record (`seller_details ?? trader_details`). */
  traderDetails?: TraderDetails | null;
  /** Admin-configured platform name. */
  platformName?: string;
}

const BODY = 'rgb(255 255 255 / 0.8)';
const FAINT = 'rgb(255 255 255 / 0.68)';
// Decorative icons take the theme accent, lightened so a dark accent still
// shows on the dark band.
const ICON = 'color-mix(in srgb, var(--theme-colors-accent, #fff) 65%, #fff)';

/**
 * The store logo on the dark band. The store has one logo (no light variant
 * field), so:
 *   - a vector logo (SVG) is drawn as a white silhouette (CSS filter);
 *   - a raster logo keeps its own colours on a small light plate (a filter
 *     would turn a logo with an opaque background into a white box);
 *   - without a logo the store name is set in the heading font.
 */
function FooterLogo({ storeName, logoUrl }: { storeName: string; logoUrl?: string }) {
  if (!logoUrl) {
    return (
      <span className="block text-2xl font-semibold leading-tight" style={{ fontFamily: 'var(--theme-font-heading)' }} data-focused-footer-logo="name">
        {storeName}
      </span>
    );
  }
  const src = resolveMediaUrl(logoUrl);
  if (isSvgSrc(src)) {
    return (
      <img
        src={src}
        alt={storeName}
        loading="lazy"
        decoding="async"
        className="focused-footer-light block h-9 w-auto max-w-[220px] object-contain object-left rtl:object-right"
        data-focused-footer-logo="silhouette"
      />
    );
  }
  return (
    <span className="inline-flex rounded-lg bg-white px-3 py-2" data-focused-footer-logo="plate">
      <img
        {...responsiveImgProps(src, '200px')}
        alt={storeName}
        loading="lazy"
        decoding="async"
        className="block h-auto max-h-9 w-auto max-w-[200px] object-contain"
      />
    </span>
  );
}

/**
 * Footer of a focused storefront (src/lib/focusedStorefront.ts): a dark brand
 * band with the logo, the seller's contact block, one links column, the
 * "back to site" link and the legal line (legal name, organisation number,
 * platform line, cookie settings). No collection columns, no newsletter.
 * The store layout renders it INSTEAD of the built-in footer and of a
 * published builder FOOTER page.
 *
 * Links column: the store's `footer` menu when it has items, otherwise the
 * `/legal/*` pages. The cookie page and the cookie settings stay in both
 * cases. The seller identity the law asks for (legal name, organisation and
 * VAT number, address, e-mail, phone) is always shown when known.
 */
export function FocusedFooter({
  storeName,
  logoUrl,
  menuLinks = [],
  legalPages = [],
  cookiePolicyHref,
  traderDetails,
  platformName = 'ShopsDoor',
}: FocusedFooterProps) {
  const t = useTranslations();
  const locale = useLocale();
  const lp = useLocalePath();
  const back = useBackToSite();
  const year = new Date().getFullYear();

  const trader = hasTraderDetails(traderDetails) ? traderDetails : null;
  const addressLines = trader ? traderAddressLines(trader, locale) : [];
  const phone = trader?.phone?.trim();
  const email = trader?.support_email?.trim();
  const legalName = trader?.legal_name?.trim();
  const orgNumber = trader ? formatOrgNumber(trader.org_number, trader.country) : '';
  const vatNumber = trader?.vat_number?.trim();
  const platformBrand = trader?.platform_brand?.trim();
  const hasContact = addressLines.length > 0 || Boolean(phone) || Boolean(email);

  const menu = menuLinks.filter((item) => item.label?.trim() && item.url?.trim());
  const fromMenu = menu.length > 0;
  const hasLinks = fromMenu || legalPages.length > 0 || Boolean(cookiePolicyHref);
  const linkClass = 'inline-block py-1 text-[15px] underline-offset-4 transition-colors hover:text-white hover:underline';
  const svgLogo = logoUrl && isSvgSrc(logoUrl) ? resolveMediaUrl(logoUrl) : null;

  return (
    <footer className="focused-footer relative mt-auto overflow-hidden" data-focused-footer="">
      <div className={`${FOCUSED_CONTAINER_CLASS} pt-12 md:pt-16`} style={FOCUSED_CONTAINER_STYLE}>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:gap-16">
          {/* Brand + contact */}
          <div className="flex min-w-0 flex-col items-start gap-6">
            <FooterLogo storeName={storeName} logoUrl={logoUrl} />

            {hasContact && (
              <address className="flex flex-col gap-3 text-[15px] not-italic leading-relaxed" style={{ color: BODY }} data-focused-footer-contact="">
                {addressLines.length > 0 && (
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-1 size-4 shrink-0" style={{ color: ICON }} aria-hidden="true" />
                    <div>
                      {/* <bdi>: a Latin address keeps its order on an RTL page. */}
                      {addressLines.map((line, i) => (
                        <div key={i}>
                          <bdi>{line}</bdi>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="size-4 shrink-0" style={{ color: ICON }} aria-hidden="true" />
                    <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="py-0.5 underline-offset-4 hover:text-white hover:underline" dir="ltr">
                      {phone}
                    </a>
                  </div>
                )}
                {email && (
                  <div className="flex items-center gap-3">
                    <Mail className="size-4 shrink-0" style={{ color: ICON }} aria-hidden="true" />
                    <a href={`mailto:${email}`} className="break-all py-0.5 underline-offset-4 hover:text-white hover:underline" dir="ltr">
                      {email}
                    </a>
                  </div>
                )}
              </address>
            )}

            {back && (
              <a
                href={back.href}
                rel={back.rel}
                className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors hover:bg-white/10"
                style={{ borderColor: 'rgb(255 255 255 / 0.28)', color: '#fff' }}
                data-focused-back=""
              >
                <ArrowLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
                <span className="min-w-0">{back.label}</span>
              </a>
            )}
          </div>

          {/* Links */}
          {hasLinks && (
            <nav aria-label={fromMenu ? t('focused.information') : t('footer.legalLinks')} className="min-w-0" data-focused-footer-links={fromMenu ? 'menu' : 'legal'}>
              <p className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: ICON }}>
                <span className="h-px w-6" style={{ backgroundColor: 'currentColor' }} aria-hidden="true" />
                {t('focused.information')}
              </p>
              <ul className="flex flex-col gap-1.5" style={{ color: BODY }}>
                {fromMenu
                  ? menu.map((item, i) => {
                      const href = localizeStoreUrl(item.url, lp(''), locale);
                      const newTab = item.open_in_new_tab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
                      return (
                        <li key={`${item.url}-${i}`}>
                          {href.startsWith('/') && !href.startsWith('//') ? (
                            <Link prefetch={false} href={href} className={linkClass} {...newTab}>
                              {item.label}
                            </Link>
                          ) : (
                            <a href={href} className={linkClass} {...newTab}>
                              {item.label}
                            </a>
                          )}
                        </li>
                      );
                    })
                  : legalPages.map((page) => (
                      <li key={page.slug}>
                        <Link prefetch={false} href={lp(`/legal/${page.slug}`)} className={linkClass}>
                          {page.title}
                        </Link>
                      </li>
                    ))}
                {cookiePolicyHref && (
                  <li>
                    <Link prefetch={false} href={lp(cookiePolicyHref)} className={linkClass}>
                      {t('consent.cookiePolicy')}
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          )}
        </div>

        {/* Faded brand mark (vector logos only: it scales cleanly). */}
        {svgLogo && (
          <img
            src={svgLogo}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="focused-footer-light pointer-events-none mt-12 block h-auto max-h-44 w-full select-none object-contain object-left opacity-[0.06] rtl:object-right md:mt-16"
            data-focused-footer-mark=""
          />
        )}

        {/* Legal line */}
        <div
          className="mt-10 flex flex-col gap-x-6 gap-y-2 border-t py-5 text-xs md:flex-row md:flex-wrap md:items-center md:justify-between"
          style={{ borderColor: 'rgb(255 255 255 / 0.14)', color: FAINT }}
        >
          <p className="leading-relaxed" data-focused-footer-legal="">
            <span>
              &copy; {year} <bdi>{legalName || storeName}</bdi>
            </span>
            {orgNumber && (
              <span>
                {' · '}
                {t('footer.companyDetailsOrgNr')} <span dir="ltr">{orgNumber}</span>
              </span>
            )}
            {vatNumber && (
              <span>
                {' · '}
                {t('footer.companyDetailsVat')} <span dir="ltr">{vatNumber}</span>
              </span>
            )}
            {/* MARKETPLACE: the platform operator is the seller of record. */}
            {trader?.is_platform && legalName && platformBrand && (
              <span data-testid="company-details-sold-by">
                {' · '}
                {t('footer.companyDetailsSoldBy', { company: legalName, brand: platformBrand })}
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              {t.rich('store.poweredBy', {
                name: platformName,
                b: (chunks) => <span className="font-semibold">{chunks}</span>,
              })}
            </span>
            {/* Permanent way back to the cookie settings (consent v2 D4a). */}
            <CookieSettingsLink variant="inline" />
          </div>
        </div>
      </div>
    </footer>
  );
}
