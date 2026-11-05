'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatOrgNumber, hasTraderDetails, traderAddressLines, type TraderDetails } from '@/lib/traderDetails';

interface CompanyDetailsProps {
  /** Seller of record (`store.seller_details`, falling back to `trader_details`). */
  trader?: TraderDetails | null;
  /** Colour of the heading; the body inherits `color` from the parent. */
  headingColor?: string;
  className?: string;
}

/**
 * "Company details" block of the store footer (SPEC §7): legal name,
 * organisation number, address, email and phone of the seller of record:
 * the platform operator on MARKETPLACE stores (with a "Sold by … on …"
 * line), the store's own trader details otherwise. Renders nothing until
 * the seller identity is known.
 */
export function CompanyDetails({ trader, headingColor, className = '' }: CompanyDetailsProps) {
  const t = useTranslations('footer');
  const locale = useLocale();
  if (!hasTraderDetails(trader)) return null;
  const addressLines = traderAddressLines(trader, locale);
  const orgNumber = formatOrgNumber(trader.org_number, trader.country);
  const legalName = trader.legal_name?.trim();
  const platformBrand = trader.platform_brand?.trim();
  const email = trader.support_email?.trim();
  const phone = trader.phone?.trim();

  return (
    <div className={`flex flex-col gap-2 text-sm ${className}`} data-testid="company-details">
      <h3 className="text-xs font-semibold uppercase tracking-widest" style={headingColor ? { color: headingColor } : undefined}>
        {t('companyDetailsTitle')}
      </h3>
      {trader.is_platform && legalName && platformBrand && (
        <p className="leading-relaxed opacity-80" data-testid="company-details-sold-by">
          {t('companyDetailsSoldBy', { company: legalName, brand: platformBrand })}
        </p>
      )}
      <address className="not-italic leading-relaxed opacity-80">
        {legalName && <div>{legalName}</div>}
        {orgNumber && (
          <div>
            {t('companyDetailsOrgNr')} <span dir="ltr">{orgNumber}</span>
          </div>
        )}
        {trader.vat_number?.trim() && (
          <div>
            {t('companyDetailsVat')} <span dir="ltr">{trader.vat_number.trim()}</span>
          </div>
        )}
        {addressLines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {email && (
          <div>
            <a href={`mailto:${email}`} className="hover:underline break-all">
              {email}
            </a>
          </div>
        )}
        {phone && (
          <div>
            <a href={`tel:${phone}`} className="hover:underline" dir="ltr">
              {phone}
            </a>
          </div>
        )}
      </address>
    </div>
  );
}
