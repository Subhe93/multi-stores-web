'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/hooks/useLocalePath';
import { Mail, Phone, MapPin } from 'lucide-react';

interface StoreFooterProps {
  storeName?: string;
  primaryColor?: string;
  pages?: { slug: string; translations: { locale: string; title: string }[] }[];
  /** Platform legal pages (Privacy / Terms / Refund / Shipping) injected by the
   *  layout. Pre-localized titles come from the API. */
  platformLegalPages?: { slug: string; title: string }[];
  socials?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
  };
  contact?: {
    email?: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
  };
  currentLang?: string;
  primaryLocale?: string;
}

const LEGAL_KEYWORDS = ['privacy', 'terms', 'return', 'refund', 'shipping'];

function isLegalPage(slug: string): boolean {
  return LEGAL_KEYWORDS.some((kw) => slug.toLowerCase().includes(kw));
}

// Requested language → store primary locale → English → whatever exists.
function getPageTitle(
  translations: { locale: string; title: string }[],
  locale: string,
  primaryLocale = 'en',
): string {
  return (
    translations.find((t) => t.locale === locale)?.title ??
    translations.find((t) => t.locale === primaryLocale)?.title ??
    translations.find((t) => t.locale === 'en')?.title ??
    translations[0]?.title ??
    ''
  );
}

// Social media SVG icons
const SocialIcons = {
  instagram: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
};

export function StoreFooter({
  storeName = 'Store',
  primaryColor,
  pages,
  platformLegalPages,
  socials,
  contact,
  currentLang = 'en',
  primaryLocale = 'en',
}: StoreFooterProps) {
  const t = useTranslations();
  const lp = useLocalePath();
  const year = new Date().getFullYear();

  const legalPages = (pages ?? []).filter((p) => isLegalPage(p.slug));

  const socialEntries = (
    [
      { key: 'instagram', label: 'Instagram' },
      { key: 'facebook', label: 'Facebook' },
      { key: 'twitter', label: 'X (Twitter)' },
      { key: 'tiktok', label: 'TikTok' },
      { key: 'youtube', label: 'YouTube' },
    ] as const
  ).filter(({ key }) => !!socials?.[key]);

  const hasContact = contact && (contact.email || contact.phone || contact.address);

  return (
    <footer
      className="mt-auto text-white"
      style={{
        background: `linear-gradient(160deg, ${primaryColor || '#1e293b'} 0%, color-mix(in srgb, ${primaryColor || '#1e293b'} 60%, black) 100%)`,
      }}
    >
      <div className="container mx-auto px-4 pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* Column 1: Brand + tagline + social */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold tracking-tight">
              {storeName}
            </h2>
            <p className="text-sm text-white/75 leading-relaxed">
              {t('store.footerTagline')}
            </p>

            {/* Social icons */}
            {socialEntries.length > 0 && (
              <div className="flex items-center gap-2 mt-1">
                {socialEntries.map(({ key, label }) => (
                  <a
                    key={key}
                    href={socials![key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    // 40×40 hit-target — closer to the 44px Lighthouse recommendation
                    // than the previous 32×32 while staying compact.
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors"
                  >
                    {SocialIcons[key]}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Quick Links */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/70">
              {t('store.quickLinks')}
            </h3>
            <nav className="flex flex-col gap-2">
              <Link
                href={lp('/')}
                className="text-sm text-white/70 hover:text-white transition-colors w-fit"
              >
                {t('common.home')}
              </Link>
              <Link
                href={lp('/products')}
                className="text-sm text-white/70 hover:text-white transition-colors w-fit"
              >
                {t('common.products')}
              </Link>
              {legalPages.map((page) => (
                <Link
                  key={page.slug}
                  href={lp(`/${page.slug}`)}
                  className="text-sm text-white/70 hover:text-white transition-colors w-fit"
                >
                  {getPageTitle(page.translations, currentLang, primaryLocale)}
                </Link>
              ))}
              {/* Platform-wide legal pages — labels are pre-localized by the API. */}
              {(platformLegalPages ?? []).map((page) => (
                <Link
                  key={`platform-${page.slug}`}
                  href={lp(`/legal/${page.slug}`)}
                  className="text-sm text-white/70 hover:text-white transition-colors w-fit"
                >
                  {page.title}
                </Link>
              ))}
            </nav>
          </div>

          {/* Column 3: Contact */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/70">
              {t('common.contact')}
            </h3>

            {hasContact ? (
              <div className="flex flex-col gap-3">
                {contact?.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-2.5 text-sm text-white/70 hover:text-white transition-colors group"
                  >
                    <Mail className="w-4 h-4 shrink-0 text-white/40 group-hover:text-white/70 transition-colors" />
                    <span className="break-all">{contact.email}</span>
                  </a>
                )}
                {contact?.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="flex items-center gap-2.5 text-sm text-white/70 hover:text-white transition-colors group"
                  >
                    <Phone className="w-4 h-4 shrink-0 text-white/40 group-hover:text-white/70 transition-colors" />
                    <span>{contact.phone}</span>
                  </a>
                )}
                {contact?.address && (
                  <div className="flex items-start gap-2.5 text-sm text-white/70">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-white/40" />
                    <span className="leading-relaxed">{contact.address}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/70">{t('store.noContactInfo')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/65">
          <span>
            &copy; {year} {storeName}. {t('common.allRightsReserved')}
          </span>
          <span>
            {t('store.poweredBy').split('Multi-Stores')[0]}
            <span className="font-semibold text-white/85">Multi-Stores</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
