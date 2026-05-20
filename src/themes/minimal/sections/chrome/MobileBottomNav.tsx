// MobileBottomNav — sticky icon bar at the bottom of the viewport on
// mobile only (hidden ≥ md). Five common icons baked in so the creator
// just picks which to enable and which URLs they point to; a sixth
// "custom" slot lets them add an extra icon link.
//
// Server-only — pure links with CSS for the fixed positioning, no JS.

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
import type { SectionDefinition, SectionRenderProps } from '../../../types';
import { colorOr } from '../../../elementStyles';
import { ActiveLink } from './ActiveLink.client';

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

function defaultLabel(type: ItemKey, locale: string): string {
  const ar = locale === 'ar';
  switch (type) {
    case 'home': return ar ? 'الرئيسية' : 'Home';
    case 'search': return ar ? 'البحث' : 'Search';
    case 'cart': return ar ? 'السلة' : 'Cart';
    case 'account': return ar ? 'الحساب' : 'Account';
    case 'wishlist': return ar ? 'المفضّلة' : 'Wishlist';
    case 'categories': return ar ? 'الفئات' : 'Categories';
    case 'menu': return ar ? 'القائمة' : 'Menu';
    default: return '';
  }
}

// `lp` is the locale prefix for the canonical storefront scheme: '' for the
// primary locale, '/ar' (etc.) for secondary locales.
function defaultUrl(type: ItemKey, lp: string): string {
  switch (type) {
    case 'home': return lp || '/';
    case 'search': return `${lp}/products`;
    case 'cart': return `${lp}/cart`;
    case 'account': return `${lp}/account`;
    case 'wishlist': return `${lp}/account/wishlist`;
    case 'categories': return `${lp}/products`;
    case 'menu': return '#menu';
    default: return '#';
  }
}

// Prefix an internal nav target with the active locale; leave external links
// and anchors untouched, and never double-prefix an already-localized path.
function localizeUrl(url: string, lp: string, locale: string): string {
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  if (!lp) return url;
  if (url === `/${locale}` || url.startsWith(`/${locale}/`)) return url;
  return `${lp}${url}`;
}

function MobileBottomNav({ settings, content, locale, primaryLocale }: SectionRenderProps) {
  const lp = locale !== primaryLocale ? `/${locale}` : '';
  const items = ((content.items as BottomNavItem[]) || []).filter((i) => i.type);
  const bg = colorOr(settings.bg_color, 'var(--theme-colors-background)');
  const fg = colorOr(settings.text_color, 'var(--theme-colors-muted)');
  const activeFg = colorOr(settings.active_color, 'var(--theme-colors-primary)');
  const borderColor = colorOr(settings.border_color, 'var(--theme-colors-border)');
  const showLabels = settings.show_labels !== false;

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={locale === 'ar' ? 'تنقل الجوال' : 'Mobile navigation'}
      className="md:hidden fixed bottom-0 inset-x-0 z-30"
      style={{
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
          // 'menu' opens a drawer in a future iteration; for now treat as
          // a regular link to the destination the creator typed.
          const url = item.url?.trim()
            ? localizeUrl(item.url.trim(), lp, locale)
            : defaultUrl(type, lp);
          const label = item.label?.trim() || defaultLabel(type, locale);
          const Icon = type === 'custom' || type === 'menu' ? Menu : ICON[type];
          return (
            <li key={i} className="flex-1">
              {/* ActiveLink highlights the tab matching the current path. The
                  cart/account etc. base paths use prefix matching so deeper
                  routes (e.g. /account/orders) keep "Account" active. */}
              <ActiveLink
                href={url}
                exact={type === 'home'}
                className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition"
                style={{ color: fg }}
                activeStyle={{ color: activeFg }}
              >
                <Icon className="size-5" style={{ color: 'currentColor' }} />
                {showLabels && <span style={{ color: 'currentColor' }}>{label}</span>}
              </ActiveLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const ITEM_OPTIONS = [
  { value: 'home', label: { en: 'Home', ar: 'الرئيسية' } },
  { value: 'search', label: { en: 'Search', ar: 'البحث' } },
  { value: 'categories', label: { en: 'Categories', ar: 'الفئات' } },
  { value: 'cart', label: { en: 'Cart', ar: 'السلة' } },
  { value: 'account', label: { en: 'Account', ar: 'الحساب' } },
  { value: 'wishlist', label: { en: 'Wishlist', ar: 'المفضّلة' } },
  { value: 'menu', label: { en: 'Menu', ar: 'القائمة' } },
  { value: 'custom', label: { en: 'Custom link', ar: 'رابط مخصّص' } },
];

export const mobileBottomNavSection: SectionDefinition = {
  schema: {
    id: 'mobile-bottom-nav',
    label: { en: 'Mobile Bottom Nav', ar: 'شريط الجوال السفلي' },
    icon: 'smartphone',
    category: 'header',
    description: {
      en: 'Fixed icon bar at the bottom of the viewport on mobile only. Six destinations baked in (Home, Search, Cart, Account, Wishlist, Categories) plus a custom-link slot. Hidden ≥ md.',
      ar: 'شريط أيقونات ثابت أسفل الشاشة على الجوال فقط. ست وجهات جاهزة (رئيسية، بحث، سلة، حساب، مفضّلة، فئات) مع خانة لرابط مخصّص. مخفي على الشاشات الأكبر.',
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
