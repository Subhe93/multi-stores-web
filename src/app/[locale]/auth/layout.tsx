import Link from 'next/link';
import { ShopsDoorLogo } from '@/components/brand/ShopsDoorLogo';

// Auth layout: centred card on the ivory brand background, logo on top,
// no header/footer.
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="sd-root min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: 'var(--sd-ivory)' }}>
      <div className="mb-8">
        <Link href="/" aria-label="ShopsDoor" className="inline-flex">
          <ShopsDoorLogo size={36} />
        </Link>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
