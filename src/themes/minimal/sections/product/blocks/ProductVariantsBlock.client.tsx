'use client';

// product-variants block: the option picker (swatches, pills, variation
// cards) on the shared state, with ProductDetailClient's markup. The
// piece-one rule of a multi-piece personalization holds: the options its
// colour palettes draw from belong to piece 1 and render inside the piece-1
// box of the product-personalization block, so this picker leaves them out.
// The personalization fields (both placements) are that block's job too.

import type { SectionRenderProps } from '../../../../types';
import {
  B1Placeholder,
  B1Scope,
  StateVariantSelector,
  hasMainVariantOptions,
  isBlockPreview,
  useBlockState,
} from './b1Shared';

export function ProductVariantsBlock(props: SectionRenderProps) {
  const { locale } = props;
  const state = useBlockState(props);
  if (!state) {
    return <B1Placeholder preview={isBlockPreview(props)} locale={locale} label={{ en: 'Variant picker', ar: 'اختيار الخيارات' }} />;
  }
  if (!hasMainVariantOptions(state)) {
    // Nothing to pick (no variants): keep the block visible in the builder.
    return isBlockPreview(props) ? (
      <B1Placeholder preview locale={locale} label={{ en: 'Variant picker (no options)', ar: 'اختيار الخيارات (لا خيارات)' }} />
    ) : null;
  }
  return (
    <B1Scope className="min-w-0">
      <StateVariantSelector state={state} />
    </B1Scope>
  );
}
