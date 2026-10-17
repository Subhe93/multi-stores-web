/**
 * Customer file upload (M4.0 §8.2): `POST /uploads/customer` keeps the
 * original privately and returns the public preview URL, which is the value
 * stored in the cart and the order. Shared by the personalization file
 * fields and the legacy "customer upload" block of the product page. There
 * is no fallback to the public upload endpoint: originals must stay private.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const API_ORIGIN = API_URL.replace(/\/api$/, '');

export type CustomerUploadResult = { url: string; name: string } | { error: string };

/** Pseudo code for a throttled upload (HTTP 429, no coded body). */
export const UPLOAD_RATE_LIMITED = 'RATE_LIMITED';

/** Absolute URL of an `/uploads/...` path the API returned (already-absolute URLs pass through). */
export function absoluteUploadUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_ORIGIN}${url}`;
}

export async function uploadCustomerFile(file: File): Promise<CustomerUploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/uploads/customer`, { method: 'POST', body: formData });
    // Throttled (10 uploads per minute): shown as its own message.
    if (res.status === 429) return { error: UPLOAD_RATE_LIMITED };
    const json = await res.json().catch(() => null);
    const url = json?.data?.url;
    if (res.ok && typeof url === 'string') {
      const name = typeof json.data.original_name === 'string' ? json.data.original_name : file.name;
      return { url: absoluteUploadUrl(url), name };
    }
    return { error: typeof json?.code === 'string' ? json.code : 'generic' };
  } catch {
    return { error: 'generic' };
  }
}
