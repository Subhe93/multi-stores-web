'use client';

// MobileMenu is a client component embedded here to keep all header logic in one file.
// The outer StoreHeader is also marked 'use client' because it contains MobileMenu inline.
// If you want a true server component wrapper, extract MobileMenu to its own file.

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { Menu, X, User, LogOut, Package, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useAuth } from '@/hooks/useAuth';
import { LanguageSwitcher } from './LanguageSwitcher';
import { CartBadge } from './CartBadge';
import { resolveMediaUrl } from '@/lib/api';

// Resolved page shape after picking the right translation
interface NavPage {
  slug: string;
  title: string;
}

// Resolved collection shape (translation already picked) for the header dropdown.
export interface NavCollection {
  slug: string;
  title: string;
  thumbnailUrl?: string | null;
  children?: NavCollection[];
}

interface StoreHeaderProps {
  storeName?: string;
  storeSlug: string;
  logoUrl?: string;
  primaryColor?: string;
  primaryLocale?: string;
  secondaryLocales?: string[];
  pages?: { slug: string; translations: { locale: string; title: string }[] }[];
  collections?: NavCollection[];
  currentLang?: string;
  showStoreName?: boolean;
  logoSize?: number;
}

// Resolve the best available translation for a page: requested language, then
// the STORE's primary locale, then English, then whatever exists.
function getPageTitle(
  translations: { locale: string; title: string }[],
  lang: string,
  primaryLocale = 'en',
): string {
  return (
    translations.find((t) => t.locale === lang)?.title ??
    translations.find((t) => t.locale === primaryLocale)?.title ??
    translations.find((t) => t.locale === 'en')?.title ??
    translations[0]?.title ??
    ''
  );
}

// Build the resolved nav page list from raw pages prop
function resolvePages(
  pages: StoreHeaderProps['pages'],
  lang: string,
  primaryLocale = 'en',
): NavPage[] {
  if (!pages || pages.length === 0) return [];
  return pages.map((p) => ({
    slug: p.slug,
    title: getPageTitle(p.translations, lang, primaryLocale),
  }));
}

// ---------- UserMenu client sub-component ----------
function UserMenu({ primaryColor }: { primaryColor?: string }) {
  const t = useTranslations();
  const lp = useLocalePath();
  const { token, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loggedIn = !!token;

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
  };

  if (!loggedIn) {
    return (
      <Link
        href={lp('/auth/login')}
        className="flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        aria-label={t('common.login')}
      >
        <User className="w-5 h-5" />
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        aria-label={t('common.account')}
      >
        <User className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 store-surface store-bd rounded-xl border shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <Link
            href={lp('/account')}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <User className="w-4 h-4 text-gray-400" />
            {t('common.account')}
          </Link>
          <Link
            href={lp('/account/orders')}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Package className="w-4 h-4 text-gray-400" />
            {t('account.orders')}
          </Link>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            {t('common.logout')}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- CollectionsMenu (desktop dropdown) ----------
interface CollectionsMenuProps {
  collections: NavCollection[];
  primaryColor?: string;
}

function CollectionsMenu({ collections, primaryColor }: CollectionsMenuProps) {
  const t = useTranslations();
  const lp = useLocalePath();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!collections.length) return null;

  // Two columns above 4 items keeps the panel comfortable without unbounded height.
  const columnsClass = collections.length > 4 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors inline-flex items-center gap-1"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {t('store.store_collections')}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-[min(560px,90vw)] store-surface store-bd rounded-2xl border shadow-xl py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className={`grid ${columnsClass} gap-x-2`}>
            {collections.map((c) => (
              <div key={c.slug} className="px-2">
                <Link
                  href={lp(`/collections/${c.slug}`)}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                  style={{ color: primaryColor || undefined }}
                >
                  {c.title}
                </Link>
                {c.children?.length ? (
                  <div className="ms-2 mb-1 border-s border-gray-100 ps-2 flex flex-col">
                    {c.children.map((ch) => (
                      <Link
                        key={ch.slug}
                        href={lp(`/collections/${ch.slug}`)}
                        onClick={() => setOpen(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                      >
                        {ch.title}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-gray-100 pt-2 px-4">
            <Link
              href={lp('/products')}
              onClick={() => setOpen(false)}
              className="text-xs font-semibold hover:underline"
              style={{ color: primaryColor || '#2563eb' }}
            >
              {t('store.explore_collections')} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- MobileMenu client sub-component ----------
interface MobileMenuProps {
  navPages: NavPage[];
  collections: NavCollection[];
  primaryColor?: string;
  primaryLocale?: string;
  secondaryLocales?: string[];
  currentLang?: string;
}

function MobileMenu({ navPages, collections, primaryColor, primaryLocale = 'en', secondaryLocales = [], currentLang }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const t = useTranslations();
  const lp = useLocalePath();
  const { token, logout } = useAuth();

  const activeStyle = { color: primaryColor || '#2563eb' };

  return (
    <div className="md:hidden">
      {/* Hamburger toggle button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Dropdown nav panel */}
      {open && (
        <div className="absolute top-full left-0 right-0 store-surface store-bd border-b shadow-md z-40">
          <nav className="flex flex-col px-4 py-3 gap-1">
            <Link
              href={lp('/')}
              onClick={() => setOpen(false)}
              className="py-2 text-sm font-medium border-b border-gray-100 transition-colors hover:opacity-80"
              style={activeStyle}
            >
              {t('common.home')}
            </Link>
            <Link
              href={lp('/products')}
              onClick={() => setOpen(false)}
              className="py-2 text-sm font-medium text-gray-600 border-b border-gray-100 hover:text-gray-900 transition-colors"
            >
              {t('common.products')}
            </Link>

            {/* Collections expandable section */}
            {collections.length > 0 && (
              <div className="border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => setCollectionsOpen((p) => !p)}
                  className="w-full flex items-center justify-between py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  aria-expanded={collectionsOpen}
                >
                  <span>{t('store.store_collections')}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      collectionsOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {collectionsOpen && (
                  <div className="pb-2 ps-3 flex flex-col">
                    {collections.map((c) => (
                      <div key={c.slug} className="flex flex-col">
                        <Link
                          href={lp(`/collections/${c.slug}`)}
                          onClick={() => setOpen(false)}
                          className="py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          {c.title}
                        </Link>
                        {c.children?.map((ch) => (
                          <Link
                            key={ch.slug}
                            href={lp(`/collections/${ch.slug}`)}
                            onClick={() => setOpen(false)}
                            className="ps-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                          >
                            — {ch.title}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {navPages.map((page) => (
              <Link
                key={page.slug}
                href={lp(`/${page.slug}`)}
                onClick={() => setOpen(false)}
                className="py-2 text-sm font-medium text-gray-600 border-b border-gray-100 hover:text-gray-900 transition-colors"
              >
                {page.title}
              </Link>
            ))}

            {/* Account links */}
            <div className="border-t border-gray-100 mt-2 pt-2">
              {token ? (
                <>
                  <Link
                    href={lp('/account')}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    {t('common.account')}
                  </Link>
                  <Link
                    href={lp('/account/orders')}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <Package className="w-4 h-4" />
                    {t('account.orders')}
                  </Link>
                  <button
                    onClick={() => { setOpen(false); logout(); }}
                    className="flex items-center gap-2 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('common.logout')}
                  </button>
                </>
              ) : (
                <Link
                  href={lp('/auth/login')}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 py-2 text-sm font-medium transition-colors"
                  style={activeStyle}
                >
                  <User className="w-4 h-4" />
                  {t('common.login')}
                </Link>
              )}
            </div>

            {/* Language switcher inside mobile menu */}
            {secondaryLocales.length > 0 && (
              <div className="pt-3 pb-1">
                <Suspense fallback={null}>
                  <LanguageSwitcher
                    primaryLocale={primaryLocale}
                    availableLocales={secondaryLocales}
                    primaryColor={primaryColor}
                    activeLang={currentLang}
                  />
                </Suspense>
              </div>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}

// ---------- Main StoreHeader component ----------
export function StoreHeader({
  storeName,
  storeSlug,
  logoUrl,
  primaryColor,
  primaryLocale = 'en',
  secondaryLocales = [],
  pages,
  collections = [],
  currentLang = 'en',
  showStoreName = true,
  logoSize = 32,
}: StoreHeaderProps) {
  const t = useTranslations();
  const lp = useLocalePath();
  const displayName = storeName || storeSlug;
  const navPages = resolvePages(pages, currentLang, primaryLocale);

  // Only secondary locales that differ from the primary are real alternatives;
  // a store with one language must not render the language dropdown at all.
  const effectiveSecondaryLocales = secondaryLocales.filter(
    (l) => !!l && l !== primaryLocale,
  );

  // Active link underline color used via inline style (Tailwind cannot generate arbitrary colors)
  const activeLinkStyle = { color: primaryColor || '#111827' };
  const hoverUnderlineClass =
    'relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:scale-x-0 after:transition-transform hover:after:scale-x-100';

  // Header bar height accommodates the logo plus padding, with a sensible floor.
  const barHeight = Math.max(64, logoSize + 24);
  const nameVisible = showStoreName || !logoUrl;

  return (
    <header className="store-surface store-bd border-b sticky top-0 z-50">
      <div
        className="container mx-auto px-4 flex items-center justify-between gap-4 relative"
        style={{ height: barHeight }}
      >

        {/* Left: logo + (optional) store name, both link to home */}
        <Link href={lp('/')} className="flex items-center gap-2 shrink-0">
          {logoUrl && (
            <img
              src={resolveMediaUrl(logoUrl)}
              alt={displayName}
              style={{ height: logoSize, width: 'auto' }}
              className="object-contain rounded"
            />
          )}
          {nameVisible && (
            <span className="font-bold text-lg text-gray-900" style={activeLinkStyle}>
              {displayName}
            </span>
          )}
        </Link>

        {/* Center: desktop navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href={lp('/')}
            className={`text-sm font-medium transition-colors hover:opacity-80 ${hoverUnderlineClass}`}
            style={activeLinkStyle}
          >
            {t('common.home')}
          </Link>
          <Link
            href={lp('/products')}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {t('common.products')}
          </Link>

          <CollectionsMenu collections={collections} primaryColor={primaryColor} />

          {/* Published static pages */}
          {navPages.map((page) => (
            <Link
              key={page.slug}
              href={lp(`/${page.slug}`)}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {page.title}
            </Link>
          ))}
        </nav>

        {/* Right: language switcher + cart icon + mobile hamburger */}
        <div className="flex items-center gap-3">
          {/* Language switcher — only rendered when the store actually has
              more than one language */}
          {effectiveSecondaryLocales.length > 0 && (
            <div className="hidden md:block">
              <Suspense fallback={null}>
                <LanguageSwitcher
                  primaryLocale={primaryLocale}
                  availableLocales={effectiveSecondaryLocales}
                  primaryColor={primaryColor}
                  activeLang={currentLang}
                />
              </Suspense>
            </div>
          )}

          {/* User menu (login / account dropdown) */}
          <UserMenu primaryColor={primaryColor} />

          {/* Cart icon with live item count badge */}
          <CartBadge />

          {/* Mobile hamburger — handles its own open/close state */}
          <MobileMenu
            navPages={navPages}
            collections={collections}
            primaryColor={primaryColor}
            primaryLocale={primaryLocale}
            secondaryLocales={effectiveSecondaryLocales}
            currentLang={currentLang}
          />
        </div>
      </div>
    </header>
  );
}
