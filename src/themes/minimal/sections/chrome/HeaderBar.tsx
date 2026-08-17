// HeaderBar — the primary site-wide navigation. Lives inside the HEADER
// chrome page. Reads storeContext for the store name / logo / locales /
// pages, and lets the creator add custom nav links via a repeater.
//
// Server-only: no client interactivity in v1. The cart icon links to the
// cart page; locale switching is plain links (no JS). A future iteration
// could split out a HeaderBar.client.tsx for live cart count + mobile menu
// toggle, but the current minimal experience renders fine without it.

import Link from 'next/link';
import { Search, User, ChevronDown } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
import type { SectionDefinition, SectionRenderProps, NavMenuItem } from '../../../types';
import { resolveMenuItems } from '../../../types';
import { colorOr, numberOr } from '../../../elementStyles';
import { HeaderBarMobileMenu, type MobileMenuItem } from './HeaderBarMobileMenu.client';
import { ActiveLink } from './ActiveLink.client';
import { LocaleSwitcher } from './LocaleSwitcher.client';
import { HeaderCartButton } from './HeaderCartButton.client';

interface NavItem {
  label?: string;
  url?: string;
}

// A resolved nav entry with localized URL and optional one-level children.
interface NavNode {
  label: string;
  url: string;
  open_in_new_tab?: boolean;
  children?: NavNode[];
}

// Turn a flat, ordered menu item list (with parent_id) into a 1-level tree.
// Top-level entries keep their order; each item's children are nested under it.
function buildNavTree(flat: NavMenuItem[], lp: string, locale: string): NavNode[] {
  const toNode = (it: NavMenuItem): NavNode => ({
    label: it.label,
    url: localizeUrl(it.url, lp, locale),
    open_in_new_tab: it.open_in_new_tab,
    children: [],
  });
  const tops: NavNode[] = [];
  const byId = new Map<string, NavNode>();
  for (const it of flat) {
    if (!it.parent_id) {
      const node = toNode(it);
      byId.set(it.id, node);
      tops.push(node);
    }
  }
  for (const it of flat) {
    if (it.parent_id) {
      const parent = byId.get(it.parent_id);
      (parent ? parent.children! : tops).push(toNode(it));
    }
  }
  return tops;
}

// Storefront links use the canonical browser scheme enforced by the proxy:
// the store is served on its own (sub)domain with clean paths, and secondary
// locales carry a `/[locale]` prefix while the primary locale stays bare.
// `lp` is that prefix ('' for primary, '/ar' etc. for secondary). Internal
// nav targets are prefixed with it; external links and anchors are left as-is.
function localizeUrl(url: string | undefined, lp: string, locale: string): string {
  if (!url) return '#';
  // External (http/mailto/tel), protocol-relative, and in-page anchors: untouched.
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  if (!lp) return url; // primary locale needs no prefix
  // Don't double-prefix a URL the creator already localized.
  if (url === `/${locale}` || url.startsWith(`/${locale}/`)) return url;
  return `${lp}${url}`;
}

type StickyMode = 'always' | 'desktop' | 'mobile' | 'none';

// Map the sticky mode → the position utility classes. `position: sticky`
// can't be toggled per-breakpoint with a single class, so we compose
// responsive variants.
const STICKY_CLASS: Record<StickyMode, string> = {
  always: 'sticky top-0 z-40',
  desktop: 'md:sticky md:top-0 z-40', // static on mobile, sticky ≥ md
  mobile: 'sticky top-0 md:static z-40', // sticky on mobile, static ≥ md
  none: '',
};

function HeaderBar({ settings, content, locale, primaryLocale, storeContext }: SectionRenderProps) {
  const ctx = storeContext;
  // Store name + logo come from storeContext, but the creator can override
  // via the section's own `logo_url` and `store_name_override` settings —
  // useful for chrome that differs from the store's display name.
  const logoUrl = (settings.logo_url as string) || ctx?.logoUrl || '';
  const logoUrlMobile = (settings.logo_url_mobile as string) || '';
  const storeName = (settings.store_name_override as string) || ctx?.storeName || '';

  const showLogo = settings.show_logo !== false;
  const showStoreName = settings.show_store_name !== false;
  const showSearch = settings.show_search !== false;
  const showCart = settings.show_cart !== false;
  const showAccount = settings.show_account === true;
  // Only secondary locales that actually differ from the primary count — a
  // store configured with e.g. primary "en" + secondary ["en"] has just one
  // real language and gets no switcher.
  const effectiveSecondaryLocales = (ctx?.secondaryLocales ?? []).filter(
    (l) => !!l && l !== ctx?.primaryLocale,
  );
  const showLocale = settings.show_locale !== false && effectiveSecondaryLocales.length > 0;
  // Backwards-compat: the old boolean `sticky` maps to 'always' / 'none' when
  // the newer `sticky_mode` select isn't present.
  const stickyMode: StickyMode =
    (settings.sticky_mode as StickyMode) || (settings.sticky === false ? 'none' : 'always');

  const logoSize = numberOr(settings.logo_size, 32);
  const bg = colorOr(settings.bg_color, 'var(--theme-colors-background)');
  const fg = colorOr(settings.text_color, 'var(--theme-colors-text)');
  const borderColor = colorOr(settings.border_color, 'var(--theme-colors-border)');
  const accent = colorOr(settings.accent_color, 'var(--theme-colors-primary)');

  // Nav source priority:
  //   1. A selected navigation menu (menu_key) — the WordPress-style menu the
  //      creator built in /creator/menus.
  //   2. Inline custom items entered on this section.
  //   3. Auto-generated from the store's published static pages.
  // Locale prefix for the canonical storefront URL scheme (see localizeUrl).
  const lp = locale !== primaryLocale ? `/${locale}` : '';

  const menuKey = (settings.menu_key as string) || '';
  // Build a 1-level nav tree from the selected menu: top-level entries plus
  // their `parent_id` children (rendered as dropdowns / mobile sub-lists).
  const menuTree = buildNavTree(resolveMenuItems(ctx, menuKey, locale), lp, locale);
  const customItems: NavNode[] = ((content.items as NavItem[]) || [])
    .filter((i) => i.label && i.url)
    .map((i) => ({ label: i.label!, url: localizeUrl(i.url, lp, locale) }));
  const fallbackItems: NavNode[] =
    ctx?.pages?.length
      ? ctx.pages.slice(0, 5).map((p) => ({
          label:
            p.translations.find((t) => t.locale === locale)?.title ||
            p.translations.find((t) => t.locale === primaryLocale)?.title ||
            p.slug,
          url: `${lp}/${p.slug}`,
        }))
      : [];
  const navItems: NavNode[] =
    menuTree.length > 0 ? menuTree : customItems.length > 0 ? customItems : fallbackItems;

  const homeUrl = lp || '/';
  const cartUrl = `${lp}/cart`;
  const accountUrl = `${lp}/account`;
  const searchUrl = `${lp}/products`;

  return (
    <header
      className={`${STICKY_CLASS[stickyMode]} backdrop-blur-sm`}
      style={{
        backgroundColor: bg,
        color: fg,
        borderBottom: `1px solid ${borderColor}`,
      }}
    >
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8" style={{ maxWidth: 'var(--theme-container-max)' }}>
        <div className="flex items-center justify-between gap-4 h-16">
          {/* Mobile menu trigger — only renders <md, the drawer + state live
              inside the client component so the rest of HeaderBar stays SSR. */}
          {navItems.length > 0 && (
            <HeaderBarMobileMenu
              items={navItems as MobileMenuItem[]}
              fg={fg}
              bg={bg}
              ariaLabel={locale === 'ar' ? 'فتح القائمة' : 'Open menu'}
            />
          )}

          {/* Brand — logo + store name. A separate mobile logo can be set;
              when present it shows <md and the main logo shows ≥ md. */}
          <Link href={homeUrl} className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition">
            {showLogo && logoUrl && (
              <img
                src={resolveMediaUrl(logoUrl)}
                alt={storeName}
                style={{ width: logoSize, height: logoSize }}
                className={`object-contain shrink-0 ${logoUrlMobile ? 'hidden md:block' : ''}`}
              />
            )}
            {showLogo && logoUrlMobile && (
              <img
                src={resolveMediaUrl(logoUrlMobile)}
                alt={storeName}
                style={{ width: logoSize, height: logoSize }}
                className="object-contain shrink-0 md:hidden"
              />
            )}
            {showStoreName && storeName && (
              <span
                className="text-base font-semibold truncate"
                style={{ fontFamily: 'var(--theme-font-heading)' }}
              >
                {storeName}
              </span>
            )}
          </Link>

          {/* Nav links — hidden < md (mobile uses the drawer above). Active
              link gets the accent colour via the client ActiveLink wrapper. */}
          {navItems.length > 0 && (
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item, i) => {
                const children = item.children ?? [];
                if (children.length === 0) {
                  return (
                    <ActiveLink
                      key={i}
                      href={item.url || '#'}
                      className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-black/5 transition"
                      activeStyle={{ color: accent }}
                      activeClassName="bg-black/5"
                    >
                      {item.label}
                    </ActiveLink>
                  );
                }
                // Item with sub-items: CSS-only dropdown (hover + focus-within),
                // so the header stays a server component with no JS.
                return (
                  <div key={i} className="relative group">
                    <ActiveLink
                      href={item.url || '#'}
                      className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-black/5 transition inline-flex items-center gap-1"
                      activeStyle={{ color: accent }}
                      activeClassName="bg-black/5"
                    >
                      {item.label}
                      <ChevronDown className="size-3.5 opacity-60 transition-transform group-hover:rotate-180" />
                    </ActiveLink>
                    <div className="absolute inset-s-0 top-full hidden pt-1 group-hover:block group-focus-within:block z-50 min-w-48">
                      <div
                        className="rounded-md border py-1 shadow-lg"
                        style={{ backgroundColor: bg, borderColor }}
                      >
                        {children.map((child, ci) => (
                          <Link
                            key={ci}
                            href={child.url || '#'}
                            {...(child.open_in_new_tab
                              ? { target: '_blank', rel: 'noopener noreferrer' }
                              : {})}
                            className="block px-3 py-2 text-sm hover:bg-black/5 transition whitespace-nowrap"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </nav>
          )}

          {/* Action icons */}
          <div className="flex items-center gap-1">
            {showSearch && (
              <Link
                href={searchUrl}
                aria-label={locale === 'ar' ? 'البحث' : 'Search'}
                className="size-9 inline-flex items-center justify-center rounded-md hover:bg-black/5 transition"
              >
                <Search className="size-4" />
              </Link>
            )}
            {showAccount && (
              <Link
                href={accountUrl}
                aria-label={locale === 'ar' ? 'الحساب' : 'Account'}
                className="size-9 inline-flex items-center justify-center rounded-md hover:bg-black/5 transition"
              >
                <User className="size-4" />
              </Link>
            )}
            {showLocale && ctx && (
              <LocaleSwitcher
                current={locale}
                primary={ctx.primaryLocale}
                others={effectiveSecondaryLocales}
                accent={accent}
              />
            )}
            {showCart && (
              <HeaderCartButton
                mode={(settings.cart_action as 'page' | 'popup') || 'page'}
                href={cartUrl}
                ariaLabel={locale === 'ar' ? 'السلة' : 'Cart'}
                accent={accent}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export const headerBarSection: SectionDefinition = {
  schema: {
    id: 'header-bar',
    label: { en: 'Header Bar', ar: 'شريط الهيدر' },
    icon: 'menu',
    category: 'header',
    description: {
      en: 'Logo, navigation links, search, cart, account, and locale switcher in one bar. Inherits store name / logo from the store settings; nav links fall back to your published static pages when none are entered.',
      ar: 'شعار وروابط تنقل وبحث وسلة وحساب ومبدّل لغة في شريط واحد. يرث الاسم/الشعار من إعدادات المتجر؛ روابط التنقل تستخدم الصفحات المنشورة عند عدم إدخال روابط مخصّصة.',
    },
    pageTypes: ['HEADER'],
    translatable: ['items'],
    schema: [
      // Brand
      { key: 'show_logo', type: 'boolean', label: { en: 'Show logo', ar: 'إظهار الشعار' }, defaultValue: true },
      { key: 'show_store_name', type: 'boolean', label: { en: 'Show store name', ar: 'إظهار اسم المتجر' }, defaultValue: true },
      { key: 'logo_url', type: 'image', label: { en: 'Logo override (desktop, optional)', ar: 'استبدال الشعار (سطح المكتب، اختياري)' } },
      { key: 'logo_url_mobile', type: 'image', label: { en: 'Mobile logo (optional)', ar: 'شعار الجوال (اختياري)' } },
      { key: 'store_name_override', type: 'text', label: { en: 'Store name override (optional)', ar: 'استبدال اسم المتجر (اختياري)' } },
      { key: 'logo_size', type: 'number', label: { en: 'Logo size (px)', ar: 'حجم الشعار (px)' }, min: 16, max: 96, defaultValue: 32 },
      // Action icons
      { key: 'show_search', type: 'boolean', label: { en: 'Show search', ar: 'إظهار البحث' }, defaultValue: true },
      { key: 'show_cart', type: 'boolean', label: { en: 'Show cart', ar: 'إظهار السلة' }, defaultValue: true },
      {
        key: 'cart_action',
        type: 'select',
        label: { en: 'Cart click action', ar: 'سلوك زر السلة' },
        defaultValue: 'page',
        options: [
          { value: 'page', label: { en: 'Go to cart page', ar: 'الذهاب لصفحة السلة' } },
          { value: 'popup', label: { en: 'Open cart popup (drawer)', ar: 'فتح نافذة السلة المنبثقة' } },
        ],
      },
      { key: 'show_account', type: 'boolean', label: { en: 'Show account', ar: 'إظهار الحساب' }, defaultValue: false },
      { key: 'show_locale', type: 'boolean', label: { en: 'Show locale switcher', ar: 'إظهار مبدّل اللغة' }, defaultValue: true },
      // Behaviour
      {
        key: 'sticky_mode',
        type: 'select',
        label: { en: 'Sticky on scroll', ar: 'التثبيت عند التمرير' },
        defaultValue: 'always',
        options: [
          { value: 'always', label: { en: 'Always', ar: 'دائماً' } },
          { value: 'desktop', label: { en: 'Desktop only', ar: 'سطح المكتب فقط' } },
          { value: 'mobile', label: { en: 'Mobile only', ar: 'الجوال فقط' } },
          { value: 'none', label: { en: 'Never', ar: 'أبداً' } },
        ],
      },
      // Colors
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'border_color', type: 'color', label: { en: 'Bottom border color', ar: 'لون الحد السفلي' } },
      { key: 'accent_color', type: 'color', label: { en: 'Accent (active locale)', ar: 'لون التمييز (اللغة النشطة)' } },
      // Navigation source. A menu key takes priority over inline items, which
      // take priority over auto-generated links from the store's pages.
      { key: 'menu_key', type: 'menuPicker', label: { en: 'Menu', ar: 'القائمة' }, description: { en: 'Pick a menu built in the Menus page. Leave as None to use the inline links below.', ar: 'اختر قائمة من صفحة القوائم. اتركها بدون لاستخدام الروابط أدناه.' } },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Inline links (used when no menu is selected)', ar: 'روابط مباشرة (تُستخدم عند عدم اختيار قائمة)' },
        fields: [
          { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
          { key: 'url', type: 'url', label: { en: 'URL', ar: 'الرابط' } },
        ],
      },
    ],
  },
  Component: HeaderBar,
  defaultSettings: {
    show_logo: true,
    show_store_name: true,
    show_search: true,
    show_cart: true,
    cart_action: 'page',
    show_account: false,
    show_locale: true,
    sticky_mode: 'always',
    logo_size: 32,
  },
};
