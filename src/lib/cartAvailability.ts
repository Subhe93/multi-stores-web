// Markets app: cart lines whose product is hidden in the request market are
// flagged `unavailableInMarket` by GET /cart. They stay in the cart so the
// shopper can remove them, but carry no valid price here: every client-side
// sum skips them (the server already excludes them from tax and totals) and
// checkout is blocked until they are removed.

interface LineLike {
  price: number;
  quantity: number;
  unavailableInMarket?: boolean;
}

/** Lines that can be bought in the current market. */
export function availableLines<T extends LineLike>(items: readonly T[]): T[] {
  return items.filter((i) => !i.unavailableInMarket);
}

/** True while any line is unavailable in the current market. */
export function hasUnavailableLines(items: readonly LineLike[]): boolean {
  return items.some((i) => i.unavailableInMarket === true);
}

/** Σ price × quantity over the available lines only. */
export function sumLineTotals(items: readonly LineLike[]): number {
  return items.reduce((sum, i) => (i.unavailableInMarket ? sum : sum + i.price * i.quantity), 0);
}
