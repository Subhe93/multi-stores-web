// HeaderBar — the primary site-wide navigation. Lives inside the HEADER
// chrome page. Reads storeContext for the store name / logo / locales /
// pages, and lets the creator add custom nav links via a repeater.
//
// Server-only: no client interactivity in v1. The cart icon links to the
// cart page; locale switching is plain links (no JS). A future iteration
// could split out a HeaderBar.client.tsx for live cart count + mobile menu
// toggle, but the current minimal experience renders fine without it.

import Link from 'next/link';
import type { CSSProperties } from 'react';
// Chrome links use prefetch={false}: viewport-prefetching every menu link
// floods the origin with dynamic RSC renders on each page view.
import { Search, User, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import { localizeStoreUrl, storeLocalePrefix } from '@/lib/storeUrl';
import { switcherLocales } from '@/lib/storeLocales';
import type { SectionDefinition, SectionRenderProps, NavMenuItem } from '../../../types';
import { resolveMenuItems } from '../../../types';
import { colorOr, numberOr } from '../../../elementStyles';
import { hover, surface } from '../../../creative/recipes';
import { HeaderBarMobileMenu, type MobileMenuItem } from './HeaderBarMobileMenu.client';
import { HeaderBarDesktopNav, type DesktopNavItem } from './HeaderBarDesktopNav.client';
import { ActiveLink } from './ActiveLink.client';
import { navActiveLook, parseNavActiveStyle } from './navActiveLook';
import { headerLogoBox, parseLogoFit } from './headerLogo';
import { HeaderLocaleControl } from './HeaderLocaleControl.client';
import { isRegionMode } from '@/lib/region';
import { HeaderCartButton } from './HeaderCartButton.client';
import { BlurOnNavigate } from './BlurOnNavigate.client';
import { HeaderScrollState } from './HeaderScrollState.client';
import { HeaderOverlayHome } from './HeaderOverlayHome.client';

interface NavItem {
  label?: string;
  url?: string;
}

// A resolved nav entry with localized URL and nested children (up to three
// levels: top / dropdown / indented group, M6 §4).
interface NavNode {
  label: string;
  url: string;
  open_in_new_tab?: boolean;
  children?: NavNode[];
}

// Turn a flat, ordered menu item list (with parent_id) into a tree. Siblings
// keep their order; an item whose parent is unknown becomes top-level. The
// API caps menus at three levels (MENU_MAX_DEPTH); the renderers below show
// at most that many.
function buildNavTree(flat: NavMenuItem[], lp: string, locale: string): NavNode[] {
  const byId = new Map<string, NavNode>();
  for (const it of flat) {
    byId.set(it.id, {
      label: it.label,
      url: localizeUrl(it.url, lp, locale),
      open_in_new_tab: it.open_in_new_tab,
      children: [],
    });
  }
  const tops: NavNode[] = [];
  for (const it of flat) {
    const node = byId.get(it.id)!;
    const parent = it.parent_id ? byId.get(it.parent_id) : undefined;
    (parent ? parent.children! : tops).push(node);
  }
  return tops;
}

// Storefront links use the canonical browser scheme enforced by the proxy
// (shared with FooterColumns — see `localizeStoreUrl`).
const localizeUrl = localizeStoreUrl;

// `target`/`rel` for an item the creator marked "open in new tab".
function newTabProps(flag: boolean | undefined) {
  return flag ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}

type StickyMode = 'always' | 'desktop' | 'mobile' | 'none';

// Map the sticky mode → the position utility classes. `position: sticky`
// can't be toggled per-breakpoint with a single class, so we compose
// responsive variants. Wherever the header is not sticky it is `relative`
// so the full-width mega panel (submenu_style 'mega') anchors to the header
// on every breakpoint; `relative` has no visual effect otherwise. Every mode
// carries z-40: backdrop-blur makes the header a stacking context, so its
// dropdown panels can only rise above later positioned content through the
// header's own z-index.
const STICKY_CLASS: Record<StickyMode, string> = {
  always: 'sticky top-0 z-40',
  desktop: 'relative md:sticky md:top-0 z-40', // static on mobile, sticky ≥ md
  mobile: 'sticky top-0 md:relative z-40', // sticky on mobile, static ≥ md
  none: 'relative z-40',
};

// How a top-level item's sub-items open on desktop (`submenu_style`):
// 'dropdown' — the CSS-only vertical list below (default, no JS);
// 'mega'     — JS nav: items whose children have grandchildren open a
//              full-width column panel, the rest keep a simple dropdown.
type SubmenuStyle = 'dropdown' | 'mega';

// Transparent header over the first section (`overlay_hero`):
// 'off'  — the stored header (default; markup unchanged);
// 'home' — only on the store's home page (HeaderOverlayHome marks it);
// 'all'  — on every page whose first section is a hero (detected in CSS).
export type OverlayHero = 'off' | 'home' | 'all';
export function parseOverlayHero(raw: unknown): OverlayHero {
  return raw === 'home' || raw === 'all' ? raw : 'off';
}

function HeaderBar({ settings, content, locale, primaryLocale, pathPrefix, storeSlug, storeContext, motion }: SectionRenderProps) {
  const ctx = storeContext;
  // Shared (non-async) component: next-intl's hook works both in the RSC
  // storefront and in the client-rendered builder preview.
  const t = useTranslations();
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
  // real language and gets no switcher. Locales in review ('ku') are left
  // out unless they are the one being rendered (switcherLocales).
  const effectiveSecondaryLocales = switcherLocales(ctx?.primaryLocale, ctx?.secondaryLocales, locale);
  // A store with two or more markets shows the country/region + language
  // picker even with one language per market (M155).
  const showLocale =
    settings.show_locale !== false && (effectiveSecondaryLocales.length > 0 || isRegionMode(ctx?.markets));
  // Backwards-compat: the old boolean `sticky` maps to 'always' / 'none' when
  // the newer `sticky_mode` select isn't present.
  const stickyMode: StickyMode =
    (settings.sticky_mode as StickyMode) || (settings.sticky === false ? 'none' : 'always');
  const submenuStyle: SubmenuStyle = settings.submenu_style === 'mega' ? 'mega' : 'dropdown';
  // Compact on scroll (opt-in, sticky headers only): a lower row and a
  // smaller brand once the page is scrolled (CSS in globals.css). The
  // attributes and the scroll island exist only then; every other header
  // renders exactly as before.
  const compact = settings.compact_on_scroll === true && stickyMode !== 'none';
  const compactHeaderAttr = compact ? { 'data-compact-header': '' } : {};
  const compactRowAttr = compact ? { 'data-header-row': '' } : {};
  const compactBrandAttr = compact ? { 'data-header-brand': '' } : {};
  // Transparent over the first section (opt-in). The look lives in
  // globals.css; here only marks: the mode and scrim on the header, the
  // solid text colour as --hb-fg (dropdown panels keep it), the logos, and
  // the optional light logo. With 'off' none of them is rendered.
  const overlayHero = parseOverlayHero(settings.overlay_hero);
  const overlay = overlayHero !== 'off';
  const overlayHeaderAttr = overlay
    ? { 'data-overlay-header': overlayHero, 'data-overlay-scrim': settings.overlay_scrim === 'none' ? 'none' : 'soft' }
    : {};
  const overlayLogoAttr = overlay ? { 'data-header-logo': '' } : {};
  const logoUrlLight = overlay ? (settings.logo_url_light as string) || '' : '';

  const logoSize = numberOr(settings.logo_size, 32);
  // Square box (stored headers) or natural proportions under a height
  // (`logo_fit: 'height'`), see ./headerLogo.ts.
  const logoBox = headerLogoBox(parseLogoFit(settings.logo_fit), logoSize);
  // Only beside a drawn logo; the square box adds nothing (stored headers
  // keep their markup).
  const nameClass =
    showLogo && (logoUrl || logoUrlMobile) && logoBox.nameClassName
      ? `text-base font-semibold truncate ${logoBox.nameClassName}`
      : 'text-base font-semibold truncate';
  const bg = colorOr(settings.bg_color, 'var(--theme-colors-background)');
  const fg = colorOr(settings.text_color, 'var(--theme-colors-text)');
  const borderColor = colorOr(settings.border_color, 'var(--theme-colors-border)');
  const accent = colorOr(settings.accent_color, 'var(--theme-colors-primary)');
  const activeVariant = parseNavActiveStyle(settings.active_style);
  const navLook = navActiveLook(activeVariant, accent);

  // Nav source priority:
  //   1. A selected navigation menu (menu_key) — the WordPress-style menu the
  //      creator built in /creator/menus.
  //   2. Inline custom items entered on this section.
  //   3. Auto-generated from the store's published static pages.
  // Locale prefix for the canonical storefront URL scheme (see localizeUrl).
  const lp = storeLocalePrefix({ locale, primaryLocale, pathPrefix });

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

  // Motion style: plain nav links get the underline sweep (attributes only
  // when the store switched it on). The pill look keeps its filled hover.
  const navLink = motion && activeVariant !== 'pill' ? { ...hover(motion, 'underline'), 'data-cx-nav': '' } : null;

  const homeUrl = lp || '/';
  const cartUrl = `${lp}/cart`;
  const accountUrl = `${lp}/account`;
  const searchUrl = `${lp}/products`;

  const header = (
    <header
      {...compactHeaderAttr}
      {...overlayHeaderAttr}
      {...surface(motion, 'header')}
      className={`${STICKY_CLASS[stickyMode]} backdrop-blur-sm`}
      style={{
        backgroundColor: bg,
        color: fg,
        borderBottom: `1px solid ${borderColor}`,
        ...(overlay ? ({ '--hb-fg': fg } as CSSProperties) : null),
      }}
    >
      {overlayHero === 'home' && <HeaderOverlayHome homeHref={homeUrl} />}
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8" style={{ maxWidth: 'var(--theme-container-max)' }}>
        <div {...compactRowAttr} className="flex items-center justify-between gap-4 h-16">
          {/* Mobile menu trigger — only renders <md, the drawer + state live
              inside the client component so the rest of HeaderBar stays SSR. */}
          {navItems.length > 0 && (
            <HeaderBarMobileMenu
              items={navItems as MobileMenuItem[]}
              fg={fg}
              bg={bg}
              ariaLabel={t('nav.openMenu')}
              motion={motion}
            />
          )}

          {/* Brand — logo + store name. A separate mobile logo can be set;
              when present it shows <md and the main logo shows ≥ md. */}
          <Link prefetch={false} href={homeUrl} {...compactBrandAttr} className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition">
            {showLogo && logoUrl && (
              // Optimized at its displayed width (a 600px logo was sent to a
              // ~100px box); SVG logos pass through unchanged. Eager: the
              // header is always above the fold.
              <StoreImage
                {...overlayLogoAttr}
                src={resolveMediaUrl(logoUrl)}
                alt={storeName}
                width={logoBox.width}
                height={logoBox.height}
                sizes={logoBox.sizes}
                loading="eager"
                unoptimized={isSvgSrc(resolveMediaUrl(logoUrl))}
                style={logoBox.style}
                className={`${logoBox.className} ${logoUrlMobile ? 'hidden md:block' : ''}`}
              />
            )}
            {showLogo && logoUrlMobile && (
              <StoreImage
                {...overlayLogoAttr}
                src={resolveMediaUrl(logoUrlMobile)}
                alt={storeName}
                width={logoBox.width}
                height={logoBox.height}
                sizes={logoBox.sizes}
                loading="eager"
                unoptimized={isSvgSrc(resolveMediaUrl(logoUrlMobile))}
                style={logoBox.style}
                className={`${logoBox.className} md:hidden`}
              />
            )}
            {/* Light logo of the transparent state (both breakpoints); CSS
                shows it only while the header lies over the first section,
                in place of the logos above. */}
            {showLogo && logoUrlLight && (
              <StoreImage
                data-header-logo-light=""
                src={resolveMediaUrl(logoUrlLight)}
                alt={storeName}
                width={logoBox.width}
                height={logoBox.height}
                sizes={logoBox.sizes}
                loading="eager"
                unoptimized={isSvgSrc(resolveMediaUrl(logoUrlLight))}
                style={logoBox.style}
                className={logoBox.className}
              />
            )}
            {showStoreName && storeName && (
              <span
                className={nameClass}
                style={{ fontFamily: 'var(--theme-font-heading)' }}
              >
                {storeName}
              </span>
            )}
          </Link>

          {/* Nav links — hidden < md (mobile uses the drawer above). Active
              link gets the accent colour via the client ActiveLink wrapper.
              'mega' style hands the desktop nav to a client component. */}
          {navItems.length > 0 && submenuStyle === 'mega' && (
            <HeaderBarDesktopNav
              items={navItems as DesktopNavItem[]}
              bg={bg}
              borderColor={borderColor}
              accent={accent}
              activeVariant={activeVariant}
              motion={motion}
            />
          )}
          {navItems.length > 0 && submenuStyle === 'dropdown' && (
            <nav aria-label={t('nav.mainNavigation')} className="hidden md:flex items-center gap-1">
              {navItems.map((item, i) => {
                const children = item.children ?? [];
                if (children.length === 0) {
                  return (
                    <ActiveLink
                      key={i}
                      href={item.url || '#'}
                      {...newTabProps(item.open_in_new_tab)}
                      {...navLink}
                      className={`${navLook.itemClass} text-sm font-medium hover:bg-black/5 transition`}
                      activeStyle={navLook.activeStyle}
                      activeClassName={navLook.activeClassName}
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
                      {...newTabProps(item.open_in_new_tab)}
                      className={`${navLook.itemClass} text-sm font-medium hover:bg-black/5 transition inline-flex items-center gap-1`}
                      activeStyle={navLook.activeStyle}
                      activeClassName={navLook.activeClassName}
                    >
                      {item.label}
                      <ChevronDown className="size-3.5 opacity-60 transition-transform group-hover:rotate-180" />
                    </ActiveLink>
                    {/* Drops the focus that keeps this panel open after a click. */}
                    <BlurOnNavigate />
                    <div
                      {...(motion ? { 'data-cx-menu': 'drop' } : null)}
                      className="absolute inset-s-0 top-full hidden pt-1 group-hover:block group-focus-within:block z-50 min-w-48"
                    >
                      <div
                        className="rounded-md border py-1 shadow-lg"
                        style={{ backgroundColor: bg, borderColor }}
                      >
                        {children.map((child, ci) => (
                          <div key={ci}>
                            <Link
                              prefetch={false}
                              href={child.url || '#'}
                              {...newTabProps(child.open_in_new_tab)}
                              className="block px-3 py-2 text-sm hover:bg-black/5 transition whitespace-nowrap"
                            >
                              {child.label}
                            </Link>
                            {/* Third level (M6 §4): indented under its parent. */}
                            {child.children?.length ? (
                              <div className="ms-3 mb-1 border-s ps-1" style={{ borderColor }}>
                                {child.children.map((grandchild, gi) => (
                                  <Link
                                    prefetch={false}
                                    key={gi}
                                    href={grandchild.url || '#'}
                                    {...newTabProps(grandchild.open_in_new_tab)}
                                    className="block px-3 py-1.5 text-xs opacity-80 hover:opacity-100 hover:bg-black/5 transition whitespace-nowrap"
                                  >
                                    {grandchild.label}
                                  </Link>
                                ))}
                              </div>
                            ) : null}
                          </div>
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
                prefetch={false}
                href={searchUrl}
                aria-label={t('common.search')}
                className="size-9 inline-flex items-center justify-center rounded-md hover:bg-black/5 transition"
              >
                <Search className="size-4" />
              </Link>
            )}
            {showAccount && (
              <Link
                prefetch={false}
                href={accountUrl}
                aria-label={t('common.account')}
                className="size-9 inline-flex items-center justify-center rounded-md hover:bg-black/5 transition"
              >
                <User className="size-4" />
              </Link>
            )}
            {showLocale && ctx && (
              <HeaderLocaleControl
                storeSlug={storeSlug}
                current={locale}
                primary={ctx.primaryLocale}
                others={effectiveSecondaryLocales}
                accent={accent}
                bg={bg}
                fg={fg}
                borderColor={borderColor}
                motion={motion}
              />
            )}
            {showCart && (
              <HeaderCartButton
                mode={(settings.cart_action as 'page' | 'popup') || 'page'}
                href={cartUrl}
                ariaLabel={t('common.cart')}
                accent={accent}
                motion={motion}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
  if (!compact && !overlay) return header;
  // The sentinel must be the sibling right before the header. The overlay
  // reuses it: data-scrolled="true" turns the header solid again.
  return (
    <>
      <HeaderScrollState />
      {header}
    </>
  );
}

export const headerBarSection: SectionDefinition = {
  needsStoreContext: true,
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
      {
        key: 'logo_fit',
        type: 'select',
        label: { en: 'Logo fit', ar: 'ملاءمة الشعار' },
        description: {
          en: 'For a wide wordmark choose "Keep proportions": the logo is as tall as the logo size (at most 56 px) and as wide as it needs, up to five times its height.',
          ar: 'للشعار العريض اختر «الحفاظ على النِّسب»: يكون ارتفاع الشعار بحجم الشعار (56 بكسل كحد أقصى) وعرضه بحسب حاجته حتى خمسة أضعاف ارتفاعه.',
        },
        defaultValue: 'box',
        options: [
          { value: 'box', label: { en: 'Inside a square', ar: 'داخل مربع' } },
          { value: 'height', label: { en: 'Keep proportions', ar: 'الحفاظ على النِّسب' } },
        ],
      },
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
      {
        key: 'compact_on_scroll',
        type: 'boolean',
        label: { en: 'Compact on scroll', ar: 'تصغير عند التمرير' },
        description: {
          en: 'The bar gets lower and the logo smaller once the page is scrolled. Needs "Sticky on scroll".',
          ar: 'يصبح الشريط أقل ارتفاعاً والشعار أصغر بعد تمرير الصفحة. يتطلب «التثبيت عند التمرير».',
        },
        defaultValue: false,
      },
      {
        key: 'submenu_style',
        type: 'select',
        label: { en: 'Submenu style (desktop)', ar: 'نمط القوائم الفرعية (سطح المكتب)' },
        description: {
          en: 'Mega menu: a top-level item whose sub-items have their own children opens a full-width panel (sub-items as column headings). Items without a third level keep the dropdown.',
          ar: 'القائمة الموسّعة: العنصر الرئيسي الذي تحتوي عناصره الفرعية على عناصر أبناء يفتح لوحة بعرض كامل (العناصر الفرعية كعناوين أعمدة). العناصر بدون مستوى ثالث تبقى قائمة منسدلة.',
        },
        defaultValue: 'dropdown',
        options: [
          { value: 'dropdown', label: { en: 'Dropdown list', ar: 'قائمة منسدلة' } },
          { value: 'mega', label: { en: 'Mega menu (columns)', ar: 'قائمة موسّعة (أعمدة)' } },
        ],
      },
      {
        key: 'active_style',
        type: 'select',
        label: { en: 'Active menu item style', ar: 'نمط عنصر القائمة النشط' },
        description: {
          en: 'Pill: the current page gets a filled rounded background in the accent colour (or the theme primary).',
          ar: 'كبسولة: تحصل الصفحة الحالية على خلفية دائرية مملوءة بلون التمييز (أو اللون الأساسي للثيم).',
        },
        defaultValue: 'text',
        options: [
          { value: 'text', label: { en: 'Accent text', ar: 'نص بلون التمييز' } },
          { value: 'pill', label: { en: 'Filled pill', ar: 'كبسولة مملوءة' } },
        ],
      },
      // Colors
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'border_color', type: 'color', label: { en: 'Bottom border color', ar: 'لون الحد السفلي' } },
      { key: 'accent_color', type: 'color', label: { en: 'Accent (active link / locale)', ar: 'لون التمييز (الرابط النشط / اللغة)' } },
      // Transparent over the first section (opt-in, unset = 'off').
      {
        key: 'overlay_hero',
        type: 'select',
        label: { en: 'Transparent over the first section', ar: 'شفاف فوق القسم الأول' },
        description: {
          en: 'At the top of the page the bar lies over the first section with a transparent background and light text, and turns solid on scroll. "Pages with a hero" means every page whose first section is a hero. A hero can use var(--store-header-h) as its top padding.',
          ar: 'في أعلى الصفحة يظهر الشريط فوق القسم الأول بخلفية شفافة ونص فاتح، ويعود صلباً عند التمرير. «الصفحات ذات البانر الرئيسي» تعني كل صفحة قسمها الأول بانر رئيسي. يمكن للبانر استخدام var(--store-header-h) كمسافة علوية.',
        },
        defaultValue: 'off',
        options: [
          { value: 'off', label: { en: 'Off', ar: 'إيقاف' } },
          { value: 'home', label: { en: 'Home page only', ar: 'الصفحة الرئيسية فقط' } },
          { value: 'all', label: { en: 'Pages with a hero', ar: 'الصفحات ذات البانر الرئيسي' } },
        ],
      },
      {
        key: 'overlay_scrim',
        type: 'select',
        label: { en: 'Shade behind the transparent bar', ar: 'تظليل خلف الشريط الشفاف' },
        defaultValue: 'soft',
        options: [
          { value: 'soft', label: { en: 'Soft gradient', ar: 'تدرّج خفيف' } },
          { value: 'none', label: { en: 'None', ar: 'بدون' } },
        ],
      },
      { key: 'logo_url_light', type: 'image', label: { en: 'Light logo for the transparent bar (optional)', ar: 'شعار فاتح للشريط الشفاف (اختياري)' } },
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
    submenu_style: 'dropdown',
    active_style: 'text',
    logo_size: 32,
    // New headers keep a wide wordmark readable; stored headers have no
    // value and read as 'box'.
    logo_fit: 'height',
  },
};
