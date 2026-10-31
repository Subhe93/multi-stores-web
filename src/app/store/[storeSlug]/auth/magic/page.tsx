import type { Metadata } from 'next';
import { MagicLogin } from '@/components/auth/MagicLogin';

// One-click login from an emailed link. The URL carries a single-use token:
// never indexable, and no Referer may leak it to third-party requests made
// before the client strips it from the address bar.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function MagicLoginPage() {
  return <MagicLogin variant="store" />;
}
