import Link from 'next/link';
import { getPlatformName } from '@/lib/platform';

// Auth layout - centered card on gradient background, no header/footer
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const platformName = await getPlatformName();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="text-2xl font-bold text-slate-800 tracking-tight">
          {platformName}
        </Link>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
