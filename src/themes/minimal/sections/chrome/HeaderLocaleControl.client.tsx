'use client';

// Language / country control of the chrome HeaderBar (M155). HeaderBar is a
// shared component (RSC storefront + client builder preview), so the market
// hook lives here: a store with two or more servable markets gets the
// country/region + language picker, every other store (and the builder
// preview, which has no market context) keeps the LocaleSwitcher unchanged.

import { useMarkets } from '@/hooks/useMarket';
import { isRegionMode } from '@/lib/region';
import { RegionPicker } from '@/components/region/RegionPicker';
import { LocaleSwitcher } from './LocaleSwitcher.client';
import type { ChromeMotion } from './chromeMotion.client';

export function HeaderLocaleControl({
  storeSlug,
  current,
  primary,
  others,
  accent,
  bg,
  fg,
  borderColor,
  motion,
}: {
  storeSlug: string;
  current: string;
  primary: string;
  others: string[];
  accent: string;
  bg: string;
  fg: string;
  borderColor: string;
  motion?: ChromeMotion;
}) {
  const markets = useMarkets();
  if (isRegionMode(markets)) {
    return (
      <RegionPicker
        storeSlug={storeSlug}
        variant="header"
        accent={accent}
        panelColors={{ bg, fg, borderColor }}
        motion={motion}
      />
    );
  }
  return (
    <LocaleSwitcher
      current={current}
      primary={primary}
      others={others}
      accent={accent}
      bg={bg}
      fg={fg}
      borderColor={borderColor}
      motion={motion}
    />
  );
}
