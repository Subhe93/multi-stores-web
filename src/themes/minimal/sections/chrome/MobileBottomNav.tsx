// MobileBottomNav — sticky icon bar at the bottom of the viewport on
// mobile only (hidden ≥ md). Five common icons baked in so the creator
// just picks which to enable and which URLs they point to; a sixth
// "custom" slot lets them add an extra icon link.
//
// Server-rendered — pure links with CSS for the fixed positioning; small
// client islands for the active state, the cart badge and the "menu" item.

import {
  Heart,
  Home,
  Menu,
  Search,
  ShoppingBag,
  Tag,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { localizeStoreUrl, storeLocalePrefix } from '@/lib/storeUrl';
import type { SectionDefinition, SectionRenderProps } from '../../../types';
import { colorOr } from '../../../elementStyles';
import { ActiveLink } from './ActiveLink.client';
import { BottomNavCartBadge } from './BottomNavCartBadge.client';
import { BottomNavMenuButton } from './BottomNavMenuButton.client';

type ItemKey = 'home' | 'search' | 'cart' | 'account' | 'wishlist' | 'categories' | 'menu' | 'custom';

interface BottomNavItem {
  type?: ItemKey;
  label?: string;
  url?: string;
}

// Built-in mapping for the canonical e-commerce destinations. URLs follow the
// storefront's canonical browser scheme (clean paths, `/[locale]` prefix only
// for secondary locales) so the creator never types `/store/foo/cart` by hand.
const ICON: Record<Exclude<ItemKey, 'custom' | 'menu'>, LucideIcon> = {
  home: Home,
  search: Search,
  cart: ShoppingBag,
  account: User,
  wishlist: Heart,
  categories: Tag,
};

// Message key of each built-in label (`common.*` is shared with the rest
// of the storefront).
const LABEL_KEY: Record<Exclude<ItemKey, 'custom'>, string> = {
  home: 'common.home',
  search: 'common.search',
  cart: 'common.cart',
  account: 'common.account',
  wishlist: 'nav.wishlist',
  categories: 'common.categories',
  menu: 'nav.menu',
};

// `lp` is the locale prefix for the canonical storefront scheme: '' for the
// primary locale, '/ar' (etc.) for secondary locales. Search and Categories
// point at different pages so they never light up together.
function defaultUrl(type: ItemKey, lp: string): string {
  switch (type) {
    case 'home': return lp || '/';
    case 'search': return `${lp}/products`;
    case 'cart': return `${lp}/cart`;
    case 'account': return `${lp}/account`;
    // There is no wishlist page; a wishlist item without a custom URL is
    // not rendered (see the filter in MobileBottomNav).
    case 'wishlist': return '';
    case 'categories': return `${lp}/collections`;
    default: return '#';
  }
}

// Nav content height (labels on / off) used by the page-end spacer below.
// Slightly above the rendered bar so the last line of the page always
// clears it.
const NAV_HEIGHT_PX = { labels: 58, icons: 40 };

function MobileBottomNav({ settings, content, locale, primaryLocale }: SectionRenderProps) {
  const t = useTranslations();
  const lp = storeLocalePrefix(locale, primaryLocale);
  // Legacy 'wishlist' items only render when the creator gave them a URL:
  // the storefront has no wishlist page to fall back to.
  const items = ((content.items as BottomNavItem[]) || []).filter(
    (i) => i.type && (i.type !== 'wishlist' || Boolean(i.url?.trim())),
  );
  const bg = colorOr(settings.bg_color, 'var(--theme-colors-background)');
  const fg = colorOr(settings.text_color, 'var(--theme-colors-muted)');
  const activeFg = colorOr(settings.active_color, 'var(--theme-colors-primary)');
  const borderColor = colorOr(settings.border_color, 'var(--theme-colors-border)');
  const showLabels = settings.show_labels !== false;

  if (items.length === 0) return null;

  const itemClass =
    'relative flex w-full flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition';
  const spacerHeight = showLabels ? NAV_HEIGHT_PX.labels : NAV_HEIGHT_PX.icons;

  return (
    <>
      <nav
        aria-label={t('nav.mobileNavigation')}
        className="md:hidden fixed inset-x-0 z-30"
        style={{
          // Above the cookie banner while it is open (consent-v2 CONTRACT §4.2).
          bottom: 'var(--ms-consent-inset, 0px)',
          backgroundColor: bg,
          color: fg,
          borderTop: `1px solid ${borderColor}`,
          // iOS home indicator inset — keeps icons clear of the swipe area.
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <ul className="flex items-stretch justify-around" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item, i) => {
            const type = item.type as ItemKey;
            const customUrl = item.url?.trim();
            const url = customUrl ? localizeStoreUrl(customUrl, lp, locale) : defaultUrl(type, lp);
            const label = item.label?.trim() || (type === 'custom' ? '' : t(LABEL_KEY[type]));
            const Icon = type === 'custom' || type === 'menu' ? Menu : ICON[type];
            const inner = (
              <>
                <Icon className="size-5" style={{ color: 'currentColor' }} />
                {/* Only the cart tab carries a live count; the badge is a
                    client island so the rest of the nav stays server-rendered. */}
                {type === 'cart' && <BottomNavCartBadge accent={activeFg} />}
                {showLabels && <span style={{ color: 'currentColor' }}>{label}</span>}
              </>
            );
            return (
              <li key={i} className="flex-1 flex">
                {type === 'menu' ? (
                  // Opens the header's mobile drawer; a typed URL is the
                  // fallback for headers without one.
                  <BottomNavMenuButton
                    fallbackHref={customUrl ? url : undefined}
                    className={itemClass}
                    style={{ color: fg }}
                  >
                    {inner}
                  </BottomNavMenuButton>
                ) : (
                  // ActiveLink highlights the tab matching the current path.
                  // The cart/account etc. base paths use prefix matching so
                  // deeper routes (e.g. /account/orders) keep "Account" active.
                  <ActiveLink
                    href={url}
                    exact={type === 'home'}
                    className={itemClass}
                    style={{ color: fg }}
                    activeStyle={{ color: activeFg }}
                  >
                    {inner}
                  </ActiveLink>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      {/* The bar is fixed, so it would cover the end of the page. This adds
          an in-flow spacer of the bar's height at the very end of the store
          page (after the footer slot), on phones only, and only while the
          bar renders — wherever the creator placed the section. Hidden
          along with the footer on checkout pages. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@media (max-width: 767.98px) { #store-nav-footer::after { content: ""; display: block; height: calc(${spacerHeight}px + env(safe-area-inset-bottom)); } }`,
        }}
      />
    </>
  );
}

const ITEM_OPTIONS = [
  { value: 'home', label: { en: 'Home', ar: 'الرئيسية' } },
  { value: 'search', label: { en: 'Search', ar: 'البحث' } },
  { value: 'categories', label: { en: 'Categories', ar: 'الفئات' } },
  { value: 'cart', label: { en: 'Cart', ar: 'السلة' } },
  { value: 'account', label: { en: 'Account', ar: 'الحساب' } },
  { value: 'menu', label: { en: 'Menu (opens the header menu)', ar: 'القائمة (تفتح قائمة الهيدر)' } },
  { value: 'custom', label: { en: 'Custom link', ar: 'رابط مخصّص' } },
];

export const mobileBottomNavSection: SectionDefinition = {
  schema: {
    id: 'mobile-bottom-nav',
    label: { en: 'Mobile Bottom Nav', ar: 'شريط الجوال السفلي' },
    icon: 'smartphone',
    category: 'header',
    description: {
      en: 'Fixed icon bar at the bottom of the viewport on mobile only. Five destinations baked in (Home, Search, Cart, Account, Categories) plus a custom-link slot. Hidden ≥ md.',
      ar: 'شريط أيقونات ثابت أسفل الشاشة على الجوال فقط. خمس وجهات جاهزة (رئيسية، بحث، سلة، حساب، فئات) مع خانة لرابط مخصّص. مخفي على الشاشات الأكبر.',
    },
    pageTypes: ['HEADER', 'FOOTER'],
    translatable: ['items'],
    schema: [
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Items (3–5 recommended)', ar: 'العناصر (3-5 موصى به)' },
        fields: [
          {
            key: 'type',
            type: 'select',
            label: { en: 'Type', ar: 'النوع' },
            defaultValue: 'home',
            options: ITEM_OPTIONS,
          },
          { key: 'label', type: 'text', label: { en: 'Label (optional override)', ar: 'التسمية (اختياري)' } },
          { key: 'url', type: 'url', label: { en: 'URL (optional override)', ar: 'الرابط (اختياري)' } },
        ],
      },
      { key: 'show_labels', type: 'boolean', label: { en: 'Show labels under icons', ar: 'إظهار التسمية أسفل الأيقونة' }, defaultValue: true },
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Inactive color', ar: 'اللون غير النشط' } },
      { key: 'active_color', type: 'color', label: { en: 'Active color', ar: 'اللون النشط' } },
      { key: 'border_color', type: 'color', label: { en: 'Top border color', ar: 'لون الحد العلوي' } },
    ],
  },
  Component: MobileBottomNav,
  defaultSettings: { show_labels: true },
  defaultContent: {
    items: [
      { type: 'home' },
      { type: 'search' },
      { type: 'cart' },
      { type: 'account' },
    ],
  },
};
