export function Footer({ storeName }: { storeName?: string }) {
  return (
    <footer className="border-t bg-gray-50 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} {storeName || 'Multi-Stores'}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
