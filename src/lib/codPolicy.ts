// Cash on delivery policy (platform rule): a MARKETPLACE store never offers
// COD, whatever its stored flag says; an INDEPENDENT store offers it when it
// switched it on. Mirror of the API's `effectiveCodEnabled` (the API refuses
// a COD order on a marketplace store with ORDER_COD_DISABLED either way).

export interface CodPolicyStore {
  store_type?: string | null;
  cod_enabled?: boolean | null;
}

/** True when the checkout may offer cash on delivery for this store. */
export function storeOffersCod(store: CodPolicyStore | null | undefined): boolean {
  return store?.cod_enabled === true && store.store_type === 'INDEPENDENT';
}
