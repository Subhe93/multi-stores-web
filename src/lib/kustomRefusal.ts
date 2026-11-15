// Kustom-first refusals the shopper can fix in the cart (headless booking
// B4). The API refuses to open or update a Kustom session (before Klarna
// opens) with the same codes its validation callback maps to `?reason=`:
// `CART_MAX_PER_ORDER` -> `max_per_order`, an invalid personnummer
// (`CUSTOM_FIELD_INVALID_PERSONNUMMER`, directly or inside a
// `PERSONALIZATION_INVALID` error list) -> `invalid_participant`. Any other
// error returns null and keeps the generic message.

export type KustomRefusalReason = 'max_per_order' | 'invalid_participant';

const INVALID_PERSONNUMMER = 'CUSTOM_FIELD_INVALID_PERSONNUMMER';

export function kustomRefusalReason(err: unknown): KustomRefusalReason | null {
  const e = err as { code?: unknown; errors?: unknown } | null | undefined;
  const code = typeof e?.code === 'string' ? e.code : '';
  if (code === 'CART_MAX_PER_ORDER') return 'max_per_order';
  if (code === INVALID_PERSONNUMMER) return 'invalid_participant';
  if (
    code === 'PERSONALIZATION_INVALID' &&
    Array.isArray(e?.errors) &&
    e.errors.some((x) => (x as { code?: unknown } | null)?.code === INVALID_PERSONNUMMER)
  ) {
    return 'invalid_participant';
  }
  return null;
}
