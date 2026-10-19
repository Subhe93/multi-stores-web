'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart, type CartCustomFieldDisplay } from '@/hooks/useCart';
import { useCheckoutSettings } from '@/hooks/useCheckoutSettings';
import { useLocalePath } from '@/hooks/useLocalePath';
import { buildLineMetadata, type LineSource } from '@/lib/cartLine';
import type { GuestPersonalizationCheck } from '@/components/product/personalization/validateApi';
import type { DesignedLine } from '@/components/designer/DesignerInline';

/** How long the "added" confirmation stays visible. */
const ADDED_MS = 3000;

/** The line a product surface adds: what to add, how many, with what. */
export interface AddLineInput {
  productId: string;
  variantId: string | null;
  quantity: number;
  source: LineSource;
}

/**
 * Add-to-cart of a product surface (M5 D28/D31), shared by the product page
 * and the theme's `AddToCartMagic`: builds the line metadata the same way
 * for the personalization path (field values + display lines) and the
 * designer path (an approved design), and owns the "added" confirmation
 * whose timer is cleared on unmount.
 */
export function useAddToCartLine() {
  const { addItem } = useCart();
  const router = useRouter();
  const lp = useLocalePath();
  // Store checkout settings (M5.1): where the shopper goes after adding.
  // `stay` (the default) keeps today's confirmation toast.
  const { after_add_to_cart: afterAdd } = useCheckoutSettings();
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const markAdded = useCallback(() => {
    if (afterAdd === 'cart' || afterAdd === 'checkout') {
      // Both the personalization path and the designer path end here, so one
      // branch covers them. The toast is skipped: the page is leaving.
      router.push(lp(afterAdd === 'cart' ? '/cart' : '/checkout'));
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setJustAdded(true);
    timer.current = setTimeout(() => setJustAdded(false), ADDED_MS);
  }, [afterAdd, router, lp]);

  /** Personalization path: field values (`{}` without fields, G0) + guest display lines. */
  const addLine = useCallback(
    async (
      input: AddLineInput,
      fields: Record<string, unknown> | undefined,
      extra?: { customFieldDisplay?: CartCustomFieldDisplay[]; personalizationCheck?: GuestPersonalizationCheck },
    ) => {
      await addItem(input.productId, input.variantId, input.quantity, fields, buildLineMetadata(input.source, extra));
      markAdded();
    },
    [addItem, markAdded],
  );

  /** Designer path (M4.2 / M5.5 inline): the saved design is the line, no field values;
   *  its proof arrives in the cart later (`refreshDesignLine`). */
  const addDesignLine = useCallback(
    async (input: AddLineInput, line: DesignedLine) => {
      // M5.5: chosen add-ons raise the (guest, display-only) unit price; the
      // server prices the line itself from the design.
      const addons = line.addonsUnitPrice ?? 0;
      const source = addons > 0 ? { ...input.source, unitPrice: Math.round((input.source.unitPrice + addons) * 100) / 100 } : input.source;
      await addItem(
        input.productId,
        input.variantId,
        input.quantity,
        undefined,
        buildLineMetadata(source, {
          customFieldDisplay: line.display,
          design: {
            id: line.designId,
            token: line.token,
            proofUrl: line.proofUrl,
            ...(addons > 0 ? { addonsUnitPrice: addons } : {}),
            ...(line.doubleSided ? { doubleSided: true, proofBackUrl: line.proofBackUrl ?? null } : {}),
          },
        }),
      );
    },
    [addItem],
  );

  return { addLine, addDesignLine, justAdded, markAdded };
}
