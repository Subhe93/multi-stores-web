// Account pages (login / register / password reset) look, edited in the
// builder's Design panel and served as `store.theme.auth`. The API already
// whitelists it; this re-validates so a stale or odd payload can't break
// the page or inject styles.

export type AuthImagePosition = 'center' | 'top' | 'bottom';

export interface AuthBackground {
  /** Raw (possibly root-relative) image URL, resolved by the caller. */
  image?: string;
  color?: string;
  position: AuthImagePosition;
  /** Black overlay opacity, 0..0.9. */
  overlay: number;
}

const POSITIONS: readonly AuthImagePosition[] = ['center', 'top', 'bottom'];
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const SAFE_IMAGE_URL = /^(?:https?:\/\/|\/(?!\/))[^\s"'()<>\\]+$/i;

/** Normalise `theme.auth`; null when nothing is set (default look). */
export function resolveAuthBackground(raw: unknown): AuthBackground | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;

  const image =
    typeof src.background_image === 'string' && SAFE_IMAGE_URL.test(src.background_image.trim())
      ? src.background_image.trim()
      : undefined;
  const color =
    typeof src.background_color === 'string' && HEX_COLOR.test(src.background_color.trim())
      ? src.background_color.trim()
      : undefined;
  if (!image && !color) return null;

  const position = POSITIONS.includes(src.image_position as AuthImagePosition)
    ? (src.image_position as AuthImagePosition)
    : 'center';
  const opacity =
    typeof src.overlay_opacity === 'number' && Number.isFinite(src.overlay_opacity)
      ? Math.min(90, Math.max(0, Math.round(src.overlay_opacity)))
      : 0;

  return { image, color, position, overlay: image ? opacity / 100 : 0 };
}
