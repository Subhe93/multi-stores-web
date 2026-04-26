import Link from 'next/link';

interface HeaderProps {
  storeName?: string;
  logoUrl?: string;
}

export function Header({ storeName, logoUrl }: HeaderProps) {
  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          {logoUrl && (
            <img src={logoUrl} alt={storeName} className="h-8 w-8 object-contain" />
          )}
          <span className="font-bold text-lg">
            {storeName || 'Multi-Stores'}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/products" className="text-gray-600 hover:text-gray-900 text-sm">
            Products
          </Link>
          <Link href="/about" className="text-gray-600 hover:text-gray-900 text-sm">
            About
          </Link>
          <Link href="/contact" className="text-gray-600 hover:text-gray-900 text-sm">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/cart"
            className="text-gray-600 hover:text-gray-900"
          >
            Cart
          </Link>
        </div>
      </div>
    </header>
  );
}
