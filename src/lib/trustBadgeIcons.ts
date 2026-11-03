import { Award, CreditCard, HeadphonesIcon, Leaf, RefreshCw, ShieldCheck, Star, Truck } from 'lucide-react';

// Shared icon vocabulary for owner-authored trust badges. Used by the home
// `trust-badges` section and the product page's `trust_badges` repeater so
// both offer the same choices and render the same lucide icons. The schema
// stores only the string key so it serialises cleanly.
export const TRUST_BADGE_ICONS: Record<string, typeof Truck> = {
  truck: Truck,
  refresh: RefreshCw,
  shield: ShieldCheck,
  card: CreditCard,
  award: Award,
  star: Star,
  headphones: HeadphonesIcon,
  leaf: Leaf,
};

export const TRUST_BADGE_ICON_OPTIONS = [
  { value: 'truck', label: { en: 'Truck (shipping)', ar: 'شاحنة (شحن)' } },
  { value: 'refresh', label: { en: 'Refresh (returns)', ar: 'تحديث (إرجاع)' } },
  { value: 'shield', label: { en: 'Shield (secure)', ar: 'درع (آمن)' } },
  { value: 'card', label: { en: 'Card (payment)', ar: 'بطاقة (دفع)' } },
  { value: 'award', label: { en: 'Award (quality)', ar: 'جائزة (جودة)' } },
  { value: 'star', label: { en: 'Star (rated)', ar: 'نجمة (مقيّم)' } },
  { value: 'headphones', label: { en: 'Headphones (support)', ar: 'سماعات (دعم)' } },
  { value: 'leaf', label: { en: 'Leaf (eco)', ar: 'ورقة (بيئي)' } },
];

// One badge row as stored in section content. `description` is an optional
// second, muted line.
export interface TrustBadgeItem {
  icon?: string;
  label?: string;
  description?: string;
}

// Normalise raw repeater content into renderable badges: drop non-objects and
// rows without a label (an icon alone is not a claim worth showing).
export function normalizeTrustBadges(raw: unknown): TrustBadgeItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is TrustBadgeItem => !!b && typeof b === 'object')
    .map((b) => ({
      icon: typeof b.icon === 'string' ? b.icon : undefined,
      label: typeof b.label === 'string' ? b.label.trim() : '',
      description: typeof b.description === 'string' && b.description.trim() ? b.description.trim() : undefined,
    }))
    .filter((b) => b.label);
}
