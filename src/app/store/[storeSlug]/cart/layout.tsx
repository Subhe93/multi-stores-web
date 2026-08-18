import type { Metadata } from 'next';

// The cart page itself is a client component and so cannot export metadata.
// This layout exists only to mark the route noindex: a cart is per-visitor and
// has no standalone search value, and robots.txt alone cannot suppress a URL a
// crawler reaches from an external link.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
