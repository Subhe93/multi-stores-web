'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { resolvePalette, type PContext, type PFieldDef } from '@/lib/personalization';
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
 * COLOR_PALETTE (namez C1/C2): square swatches with the colour name under
 * each and a "Vald färg" line. The palette is the product's own colour
 * option (values on active variants) or the field's static list, so a
 * colour the product does not sell cannot be picked (the olivgrön fix).
 */
export function ColorPaletteField({ def, inputId, text, value, ctx, required, error, onChange }: ColorPaletteFieldProps) {
  const t = useTranslations('personalization');
  const palette = resolvePalette(def, ctx);
  const selected = typeof value === 'string' ? value : '';
  const nameOf = (v: string) => text.optionLabels?.[v] ?? v;

  return (
    <FieldShell inputId={inputId} text={text} required={required} error={error} asGroup>
      {palette.length === 0 ? (
        <p className="text-xs text-gray-400">{t('chooseColor')}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {palette.map((entry, i) => {
            const hex = entry.hex || FALLBACK_HEX;
            const isSelected = selected === entry.value;
            const light = isLight(hex);
            return (
              <div key={entry.value} className="flex w-14 flex-col items-center gap-1">
                <button
                  id={i === 0 ? inputId : undefined}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={nameOf(entry.value)}
                  title={nameOf(entry.value)}
                  onClick={() => onChange(entry.value)}
                  className={`relative size-11 rounded-md transition-all ${
                    isSelected ? 'ring-2 ring-offset-2' : 'hover:ring-1 hover:ring-gray-300 hover:ring-offset-1'
                  }`}
                  style={{
                    backgroundColor: hex,
                    border: light ? '1px solid #e5e7eb' : '1px solid transparent',
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
                  className={`max-w-14 truncate text-center text-[11px] leading-tight ${
                    isSelected ? 'font-medium text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {nameOf(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {selected && <p className="mt-2 text-xs text-gray-600">{t('selectedColor', { color: nameOf(selected) })}</p>}
    </FieldShell>
  );
}
