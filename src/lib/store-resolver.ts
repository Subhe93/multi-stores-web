import { headers } from 'next/headers';

const PLATFORM_DOMAINS = ['localhost', 'platform.com', 'www.platform.com'];

export async function resolveStore(): Promise<string | null> {
  const headersList = await headers();
  const host = headersList.get('host') || '';

  // Extract subdomain
  const hostname = host.split(':')[0]!; // Remove port

  // Check if it's the main platform
  if (PLATFORM_DOMAINS.includes(hostname)) {
    return null; // Main platform — no specific store
  }

  // Extract subdomain: ahmed.platform.com → "ahmed"
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts[0]!;
  }

  return null;
}
