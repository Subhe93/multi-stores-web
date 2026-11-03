import { describe, expect, it } from 'vitest';
import { normalizeTrustBadges, TRUST_BADGE_ICON_OPTIONS, TRUST_BADGE_ICONS } from './trustBadgeIcons';

describe('normalizeTrustBadges', () => {
  it('returns an empty list for missing or non-array content (no default claims)', () => {
    expect(normalizeTrustBadges(undefined)).toEqual([]);
    expect(normalizeTrustBadges(null)).toEqual([]);
    expect(normalizeTrustBadges('truck')).toEqual([]);
    expect(normalizeTrustBadges({ icon: 'truck', label: 'x' })).toEqual([]);
  });

  it('keeps only rows with a non-blank label and trims text', () => {
    expect(
      normalizeTrustBadges([
        { icon: 'truck', label: '  Ships within 2 days  ', description: '  From Stockholm ' },
        { icon: 'shield', label: '   ' },
        { icon: 'star' },
        null,
        'bad',
        { label: 'No icon is fine' },
      ]),
    ).toEqual([
      { icon: 'truck', label: 'Ships within 2 days', description: 'From Stockholm' },
      { icon: undefined, label: 'No icon is fine', description: undefined },
    ]);
  });

  it('drops a blank description instead of keeping an empty string', () => {
    expect(normalizeTrustBadges([{ icon: 'card', label: 'Card payments', description: '  ' }])).toEqual([
      { icon: 'card', label: 'Card payments', description: undefined },
    ]);
  });

  it('exposes an icon component for every selectable icon option', () => {
    for (const opt of TRUST_BADGE_ICON_OPTIONS) {
      expect(TRUST_BADGE_ICONS[opt.value]).toBeDefined();
    }
  });
});
