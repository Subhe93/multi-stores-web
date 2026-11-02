import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, Check } from 'lucide-react';
import { ShopsDoorLogo } from '@/components/brand/ShopsDoorLogo';
import { COMPANY } from '@/lib/brand';
import './auth.css';

// Reassurance lines on the brand panel: the landing's trust facts (home.trust).
const TRUST_KEYS = ['stripe', 'markets', 'eu'] as const;

// Auth layout: two columns on desktop (navy brand panel + ivory form side),
// single column with the logo on top on phones. No header/footer.
export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  const th = await getTranslations({ locale, namespace: 'home' });

  return (
    <div className="sd-root sd-auth">
      <aside className="sd-auth-brand">
        <div className="sd-pattern sd-auth-brand-pattern" aria-hidden="true" />
        <div className="sd-auth-brand-glow" aria-hidden="true" />
        <Link href="/" aria-label="ShopsDoor" className="sd-auth-brand-logo">
          <ShopsDoorLogo variant="reversed" size={36} />
        </Link>
        <div className="sd-auth-brand-copy">
          <span className="sd-eyebrow sd-eyebrow-ivory">
            <span className="sd-eyebrow-dot" />
            {t('brandEyebrow')}
          </span>
          <p className="sd-auth-brand-tagline">{t('brandTagline')}</p>
          <ul className="sd-auth-brand-points">
            {TRUST_KEYS.map((key) => (
              <li key={key}>
                <Check />
                <span>{th(`trust.${key}`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="sd-auth-brand-foot">
          © {new Date().getFullYear()} ShopsDoor · {COMPANY.legalName}
        </p>
      </aside>

      <main className="sd-auth-main">
        <Link href="/" aria-label="ShopsDoor" className="sd-auth-mobile-logo">
          <ShopsDoorLogo size={34} />
        </Link>
        {children}
        <Link href="/" className="sd-auth-back">
          <ArrowLeft aria-hidden="true" />
          {t('backToHome')}
        </Link>
      </main>
    </div>
  );
}
