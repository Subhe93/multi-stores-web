'use client';

import { useOwnerCodeAllowed } from '@/lib/ownerCodeGate';

/**
 * The store owner's custom CSS, already sanitized by `sanitizeCustomCss`.
 * Left out on checkout, sign-in and account pages (see ownerCodeGate).
 */
export function StoreCustomCss({ css }: { css: string }) {
  const allowed = useOwnerCodeAllowed();
  if (!css || !allowed) return null;
  return <style data-store-custom-css="" dangerouslySetInnerHTML={{ __html: css }} />;
}
