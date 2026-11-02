'use client';

import { useTranslations } from 'next-intl';
import { hasTraderDetails, traderAddressLines, type TraderDetails } from '@/lib/traderDetails';

interface CompanyDetailsProps {
  trader?: TraderDetails | null;
  /** Colour of the heading; the body inherits `color` from the parent. */
  headingColor?: string;
  className?: string;
}

/**
 * "Company details" block of the store footer (SPEC §7): legal name,
 * organisation number, address, email and phone from `store.trader_details`.
 * Renders nothing until the owner has completed the trader details.
 */
export function CompanyDetails({ trader, headingColor, className = '' }: CompanyDetailsProps) {
  const t = useTranslations('footer');
  if (!hasTraderDetails(trader)) return null;
  const addressLines = traderAddressLines(trader);
  const email = trader.support_email?.trim();
  const phone = trader.phone?.trim();

  return (
    <div className={`flex flex-col gap-2 text-sm ${className}`} data-testid="company-details">
      <h3 className="text-xs font-semibold uppercase tracking-widest" style={headingColor ? { color: headingColor } : undefined}>
        {t('companyDetailsTitle')}
      </h3>
      <address className="not-italic leading-relaxed opacity-80">
        {trader.legal_name?.trim() && <div>{trader.legal_name.trim()}</div>}
        {trader.org_number?.trim() && (
          <div>
            {t('companyDetailsOrgNr')} <span dir="ltr">{trader.org_number.trim()}</span>
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
