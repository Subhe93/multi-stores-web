import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Without a metadataBase, Next resolves every relative URL (canonicals, OG
// images) against http://localhost:3000 — which is what the platform's legal
// pages were emitting. Store routes override this with their own origin, since
// each store is served from its own subdomain or custom domain.
const PLATFORM_URL = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';

export const metadata: Metadata = {
  metadataBase: new URL(PLATFORM_URL),
  title: "Multi-Stores Marketplace",
  description: "Marketplace connecting providers, creators, and customers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
