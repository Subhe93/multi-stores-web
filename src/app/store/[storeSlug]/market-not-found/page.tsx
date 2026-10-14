import { notFound } from 'next/navigation';

// Target of the proxy rewrite for a locale prefix this market does not serve
// (M1-DESIGN §4.1 step 3), e.g. `namez.se/de` when the SE market only offers
// sv/en/ar. The segment is reserved in `[pageSlug]` so it never reaches the
// page APIs; `notFound()` renders the sibling not-found.tsx with a 404 status.
export default function MarketLocaleNotFound() {
  notFound();
}
