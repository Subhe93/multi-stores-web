'use client';

import { useCaptureBackParam } from '@/hooks/useFocusedStorefront';

/**
 * Product page of a focused storefront: remembers a valid `?back=<path>` of
 * the URL for the tab (src/lib/focusedBack.ts), so the header logo, the back
 * link and the cart's "continue shopping" lead to the site page the buyer
 * came from. Renders nothing; does nothing for other stores.
 */
export function FocusedBackCapture() {
  useCaptureBackParam();
  return null;
}
