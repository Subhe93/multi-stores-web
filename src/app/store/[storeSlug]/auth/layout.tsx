import type { Metadata } from 'next';
export default function StoreAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

// Transactional / private surface — never indexable. robots.txt already
// disallows these paths; the meta tag covers URLs a crawler reaches anyway
// (e.g. from an external link), which robots.txt alone cannot suppress.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
