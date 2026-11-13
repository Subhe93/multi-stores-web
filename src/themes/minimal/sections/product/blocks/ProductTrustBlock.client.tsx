'use client';

// `product-trust` block: the owner's own reassurance badges (per-locale
// repeater content, never default claims), with the same markup as the
// monolith's trust badges grid.

import { ShieldCheck } from 'lucide-react';
import { normalizeTrustBadges, TRUST_BADGE_ICONS } from '@/lib/trustBadgeIcons';
import type { SectionRenderProps } from '../../../../types';
import { blockLabel, ProductBlockPlaceholder, ProductBlockScope } from './b2Shared';

export function ProductTrustBlock({ settings, content, locale, product, builderPreview }: SectionRenderProps) {
  // The badges are the owner's content and need no product, so they render
  // with or without the product state.
  const badges = normalizeTrustBadges(content?.trust_badges);
  if (badges.length === 0) {
    return (
      <ProductBlockPlaceholder
        builderPreview={builderPreview ?? !product}
        label={blockLabel(locale, 'Trust badges', 'شارات الثقة')}
        hint={blockLabel(locale, 'Add badges in the section settings.', 'أضف الشارات من إعدادات القسم.')}
      />
    );
  }
  const columns = settings.columns === '1' ? 'grid-cols-1' : 'grid-cols-2';
  return (
    <ProductBlockScope>
      <div className={`grid ${columns} gap-3`}>
        {badges.map((badge, i) => {
          const Icon = (badge.icon && TRUST_BADGE_ICONS[badge.icon]) || ShieldCheck;
          return (
            <div key={`${badge.label}-${i}`} className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--store-primary, #2563eb)' }} />
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-600">{badge.label}</div>
                {badge.description && <div className="text-[11px] text-gray-400 leading-snug">{badge.description}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </ProductBlockScope>
  );
}
