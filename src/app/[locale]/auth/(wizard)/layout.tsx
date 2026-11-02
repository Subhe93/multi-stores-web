import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ShopsDoorLogo } from '@/components/brand/ShopsDoorLogo';
import { LanguageMenu } from '@/components/marketing/LanguageMenu';
import { COMPANY, DASHBOARD_LOGIN_URL } from '@/lib/brand';
import { localePath } from '@/lib/locale-path';
import '../auth.css';
import './auth-wizard.css';

// Wizard layout for the sign-up route group: a full-width ivory page with a
// slim top bar (logo, language menu, sign-in link) and a one-line footer. No
// navy brand panel here; the other auth routes keep the split layout of
// `../layout.tsx`. The field styles come from `../auth.css`.
export default async function AuthWizardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  const th = await getTranslations({ locale, namespace: 'home' });
  const home = localePath('/', locale);

  return (
    <div className="sd-root sd-auth-wizard">
      <div className="sd-pattern sd-auth-wizard-pattern" aria-hidden="true" />
      <div className="sd-auth-wizard-glow" aria-hidden="true" />

      <header className="sd-auth-wizard-top">
        <Link href={home} aria-label="ShopsDoor" className="sd-auth-wizard-logo">
          {/* Full lockup from 480px up, mark only on narrow phones (CSS toggles). */}
          <span className="sd-auth-wizard-logo-full">
            <ShopsDoorLogo size={32} />
          </span>
          <span className="sd-auth-wizard-logo-mark">
            <ShopsDoorLogo size={32} markOnly />
          </span>
        </Link>
        <div className="sd-auth-wizard-top-actions">
          <LanguageMenu locale={locale} label={th('nav.language')} />
          <p className="sd-auth-wizard-signin">
            <span>{t('hasAccount')}</span>{' '}
            <a href={DASHBOARD_LOGIN_URL} className="sd-auth-link">
              {t('signIn')}
            </a>
          </p>
        </div>
      </header>

      <main className="sd-auth-wizard-main">{children}</main>

      <footer className="sd-auth-wizard-foot">
        © {new Date().getFullYear()} ShopsDoor · {COMPANY.legalName}
      </footer>
    </div>
  );
}
