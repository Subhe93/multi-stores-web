import Link from 'next/link';

// Auth layout - centered card on gradient background, no header/footer
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="text-2xl font-bold text-slate-800 tracking-tight">
          Multi-Stores
        </Link>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
