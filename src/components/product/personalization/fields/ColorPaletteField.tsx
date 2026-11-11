'use client';

import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { resolvePalette, type PContext, type PFieldDef } from '@multi-stores/core/personalization';
import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import type { FieldText } from '../model';
import { FieldShell } from './FieldShell';

interface ColorPaletteFieldProps {
  def: PFieldDef;
  inputId: string;
  text: FieldText;
  value: unknown;
  ctx: PContext;
  required: boolean;
  error?: string | null;
  onChange: (value: string) => void;
}

/** Colour without a configured hex (namez renders unknown colours grey, C1 L194-205). */
const FALLBACK_HEX = '#cccccc';

function isLight(hex: string): boolean {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return true;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

/**
 * COLOR_PALETTE (namez C1/C2): the colour name under each swatch and a clear
 * link. Swatches are drawn exactly like the product's own colour option
 * (VariantSelector) — round, same size, ring and label — because on a
 * multi-piece product piece 1 picks from the product option and pieces 2..N
 * from this field, and the shopper must not see two designs for one choice.
 * The palette is the product's own colour option (values on active
 * variants) or the field's static list, so a colour the product does not
 * sell cannot be picked (the olivgrön fix). An image-style option (namez
 * "Djur": one picture per animal) renders its swatch pictures, exactly like
 * VariantSelector's image tiles, instead of grey discs.
 */
export function ColorPaletteField({ def, inputId, text, value, ctx, required, error, onChange }: ColorPaletteFieldProps) {
  const t = useTranslations('personalization');
  const tCommon = useTranslations('common');
  const palette = resolvePalette(def, ctx);
  const tiles = palette.some((e) => e.image);
  const selected = typeof value === 'string' ? value : '';
  const nameOf = (v: string) => text.optionLabels?.[v] ?? v;

  return (
    <FieldShell inputId={inputId} text={text} required={required} error={error} asGroup>
      {palette.length === 0 ? (
        <p className="text-xs text-gray-400">{t('chooseColor')}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {palette.map((entry, i) => {
            const isSelected = selected === entry.value;
            // One shape per palette: once any value has a picture, the ones
            // without one get a labelled tile (VariantSelector's placeholder),
            // never a 44px disc beside 80px tiles.
            if (tiles) {
              return (
                <div key={entry.value} className="flex flex-col items-center gap-1.5">
                  <button
                    id={i === 0 ? inputId : undefined}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={nameOf(entry.value)}
                    title={nameOf(entry.value)}
                    onClick={() => onChange(entry.value)}
                    className={`relative w-20 h-20 rounded-xl overflow-hidden transition-all duration-200 cursor-pointer ${
                      isSelected ? 'ring-2 ring-offset-2 shadow-md' : 'border-2 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                    style={isSelected ? ({ '--tw-ring-color': 'var(--store-primary, #2563eb)' } as React.CSSProperties) : undefined}
                  >
                    {entry.image ? (
                      <StoreImage
                        src={resolveMediaUrl(entry.image)}
                        alt=""
                        width={80}
                        height={80}
                        sizes="80px"
                        unoptimized={isSvgSrc(resolveMediaUrl(entry.image))}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="w-full h-full bg-gray-50 flex items-center justify-center text-xs text-gray-400 font-medium p-1 text-center">
                        {nameOf(entry.value)}
                      </span>
                    )}
                    {isSelected && (
                      <span
                        className="absolute top-1 inset-e-1 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
                      >
                        <Check className="w-3 h-3" strokeWidth={3} style={{ color: 'var(--store-primary-contrast, #fff)' }} />
                      </span>
                    )}
                  </button>
                  <span
                    className={`max-w-20 truncate text-center text-[10px] leading-tight ${
                      isSelected ? 'font-medium text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {nameOf(entry.value)}
                  </span>
                </div>
              );
            }
            const hex = entry.hex || FALLBACK_HEX;
            const light = isLight(hex);
            return (
              <div key={entry.value} className="flex flex-col items-center gap-1.5">
                <button
                  id={i === 0 ? inputId : undefined}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={nameOf(entry.value)}
                  title={nameOf(entry.value)}
                  onClick={() => onChange(entry.value)}
                  className={`relative size-11 transition-all duration-200 cursor-pointer hover:scale-110 ${
                    isSelected ? 'ring-2 ring-offset-3' : 'hover:ring-1 hover:ring-offset-2 hover:ring-gray-300'
                  }`}
                  style={{
                    // Same store setting as VariantSelector: round or square swatches.
                    borderRadius: 'var(--theme-swatch-radius, 9999px)',
                    backgroundColor: hex,
                    border: light ? '2px solid #e5e7eb' : '2px solid transparent',
                    boxShadow: isSelected ? undefined : '0 1px 3px rgba(0,0,0,0.08)',
                    ...(isSelected ? ({ '--tw-ring-color': 'var(--store-primary, #2563eb)' } as React.CSSProperties) : {}),
                  }}
                >
                  {isSelected && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Check className="h-4 w-4" style={{ color: light ? '#000' : '#fff' }} strokeWidth={3} />
                    </span>
                  )}
                </button>
                <span
                  className={`max-w-12 truncate text-center text-[10px] leading-tight ${
                    isSelected ? 'font-medium text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {nameOf(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {selected && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="mt-3 inline-flex items-center gap-1 min-h-11 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors w-fit"
        >
          <X className="w-3 h-3" />
          {tCommon('clear')}
        </button>
      )}
    </FieldShell>
  );
}
