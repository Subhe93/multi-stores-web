import { API_URL } from './api';

/** Error thrown by `downloadAuthed`; same shape as the errors thrown by `api()`. */
export type DownloadError = Error & { status?: number; code?: string };

/**
 * Build a `DownloadError` from a non-2xx response body. The API answers
 * errors with `{code, message}` JSON; anything else (HTML proxy page, empty
 * body) falls back to a generic message with no code.
 */
export function toDownloadError(status: number, bodyText: string): DownloadError {
  let code: string | undefined;
  let message: string | undefined;
  try {
    const json = JSON.parse(bodyText) as { code?: unknown; message?: unknown };
    if (typeof json.code === 'string') code = json.code;
    if (typeof json.message === 'string') message = json.message;
  } catch {
    // Not JSON: keep the generic message below.
  }
  const err = new Error(message || 'Download failed') as DownloadError;
  err.status = status;
  err.code = code;
  return err;
}

/**
 * Extract the filename from a `Content-Disposition` header. Prefers the
 * RFC 5987 `filename*=UTF-8''…` form, then plain `filename="…"`. Path
 * separators are stripped; returns null when no usable name is present.
 */
export function filenameFromContentDisposition(header: string | null | undefined): string | null {
  if (!header) return null;
  let name: string | null = null;
  const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (star) {
    try {
      name = decodeURIComponent(star[2].trim().replace(/^"|"$/g, ''));
    } catch {
      name = null;
    }
  }
  if (!name) {
    const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
    if (plain) name = (plain[2] ?? plain[1]).trim();
  }
  if (!name) return null;
  const safe = name.replace(/[\\/:*?"<>|]+/g, '_').trim();
  return safe && !/^[._]+$/.test(safe) ? safe : null;
}

/**
 * Download an authenticated binary endpoint (e.g. an invoice PDF) and hand it
 * to the browser as a file. A plain `<a href>` cannot carry the Bearer token,
 * so the file is fetched as a blob and saved through a temporary object URL.
 * The server's `Content-Disposition` filename wins; `filename` is the fallback.
 * Throws a `DownloadError` (with `status` and `code`) on non-2xx responses.
 */
export async function downloadAuthed(endpoint: string, token: string, filename: string): Promise<void> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw toDownloadError(res.status, text);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filenameFromContentDisposition(res.headers.get('Content-Disposition')) || filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoke on the next tick so the browser has started the download.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
