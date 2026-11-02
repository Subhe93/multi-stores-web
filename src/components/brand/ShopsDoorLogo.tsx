import { ShopsDoorMark, type MarkVariant } from './ShopsDoorMark';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';

interface Props {
  /** `color` on light backgrounds, `reversed` on navy. */
  variant?: 'color' | 'reversed' | 'mono';
  /** Height of the mark in px; the wordmark scales with it. */
  size?: number;
  /** Show the "Many stores. One door." line under the wordmark. */
  tagline?: boolean;
  /** Render the mark only (header on very small screens, favicon-like uses). */
  markOnly?: boolean;
  className?: string;
}

/**
 * Horizontal lockup: mark + "ShopsDoor" wordmark set in Manrope ExtraBold with
 * tight tracking, optionally followed by the tagline in spaced small caps.
 */
export function ShopsDoorLogo({ variant = 'color', size = 32, tagline = false, markOnly = false, className }: Props) {
  const markVariant: MarkVariant = variant;
  const text = variant === 'reversed' ? 'var(--sd-ivory)' : 'var(--sd-navy)';
  const fontSize = Math.round(size * 0.78);

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.3), color: text }}>
      <ShopsDoorMark variant={markVariant} style={{ height: size, width: 'auto', flexShrink: 0 }} />
      {!markOnly && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1, direction: 'ltr' }}>
          <span className="font-brand" style={{ fontSize, fontWeight: 800, letterSpacing: '-0.035em' }}>
            {BRAND_NAME}
          </span>
          {tagline && (
            <span className="font-brand" style={{ fontSize: Math.max(9, Math.round(size * 0.24)), fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: Math.round(size * 0.18), opacity: 0.85 }}>
              {BRAND_TAGLINE}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
