import {
  Award,
  BookOpen,
  CreditCard,
  Gem,
  Globe,
  GraduationCap,
  HeadphonesIcon,
  Heart,
  Leaf,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from 'lucide-react';

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
  graduation: GraduationCap,
  gem: Gem,
  globe: Globe,
  book: BookOpen,
  heart: Heart,
  sparkles: Sparkles,
};

/**
 * Icon of a stored key; the shield for a missing or unknown one. Own keys
 * only, so a hand-written value such as `constructor` cannot reach an
 * inherited property and break the render.
 */
export function trustBadgeIcon(key: unknown): typeof Truck {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(TRUST_BADGE_ICONS, key)
    ? TRUST_BADGE_ICONS[key]
    : ShieldCheck;
}

export const TRUST_BADGE_ICON_OPTIONS = [
  { value: 'truck', label: { en: 'Truck (shipping)', ar: 'شاحنة (شحن)' } },
  { value: 'refresh', label: { en: 'Refresh (returns)', ar: 'تحديث (إرجاع)' } },
  { value: 'shield', label: { en: 'Shield (secure)', ar: 'درع (آمن)' } },
  { value: 'card', label: { en: 'Card (payment)', ar: 'بطاقة (دفع)' } },
  { value: 'award', label: { en: 'Award (quality)', ar: 'جائزة (جودة)' } },
  { value: 'star', label: { en: 'Star (rated)', ar: 'نجمة (مقيّم)' } },
  { value: 'headphones', label: { en: 'Headphones (support)', ar: 'سماعات (دعم)' } },
  { value: 'leaf', label: { en: 'Leaf (eco)', ar: 'ورقة (بيئي)' } },
  { value: 'graduation', label: { en: 'Graduation cap (education)', ar: 'قبعة تخرّج (تعليم)' } },
  { value: 'gem', label: { en: 'Gem (quality)', ar: 'جوهرة (جودة)' } },
  { value: 'globe', label: { en: 'Globe (worldwide)', ar: 'كرة أرضية (عالمي)' } },
  { value: 'book', label: { en: 'Book (learning)', ar: 'كتاب (تعلّم)' } },
  { value: 'heart', label: { en: 'Heart (care)', ar: 'قلب (عناية)' } },
  { value: 'sparkles', label: { en: 'Sparkles (new)', ar: 'بريق (جديد)' } },
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
