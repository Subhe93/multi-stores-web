'use client';

import { useMemo } from 'react';
import { isValueSet, type PFieldDef } from '@/lib/personalization';
import { mapFormFields, type PersonalizationProduct } from '@/lib/personalization/form';
import { CustomFieldsForm } from '@/components/product/CustomFieldsForm';
import type { PersonalizationAdvanced } from '@/components/product/usePersonalizationFields';
import { fieldText } from '../model';
import { TextField } from './TextField';
import { CheckboxGroupField } from './CheckboxGroupField';
import { ColorPaletteField } from './ColorPaletteField';

export interface FieldRendererProps {
  def: PFieldDef;
  /** Error / element key (`fieldKey`). */
  fieldKey: string;
  /** Sibling set (top level, or the repeater's children). */
  siblings: readonly PFieldDef[];
  /** Values of the sibling set (top-level values, or one repeater item). */
  container: Record<string, unknown>;
  model: PersonalizationAdvanced;
  showAllErrors: boolean;
  locale: string;
  primaryLocale: string;
  groupIndex?: number;
  onChange: (value: unknown) => void;
}

/**
 * One non-repeater field of the app form. TEXT/TEXTAREA, CHECKBOX_GROUP and
 * COLOR_PALETTE have app components; the other M4.0 types render through the
 * M4.0 `CustomFieldsForm` (uploads, selects, dates) with the same rules.
 */
export function FieldRenderer({
  def,
  fieldKey,
  siblings,
  container,
  model,
  showAllErrors,
  locale,
  primaryLocale,
  groupIndex,
  onChange,
}: FieldRendererProps) {
  const text = useMemo(() => fieldText(def, locale, primaryLocale), [def, locale, primaryLocale]);
  const value = container[def.id];
  const rawError = model.errors[fieldKey];
  const error = rawError && (isValueSet(value) || showAllErrors) ? rawError : null;
  const inputId = `field-${fieldKey}`;

  // M4.0 form model of this field (delegated types only).
  const legacyField = useMemo(() => {
    if (['TEXT', 'TEXTAREA', 'CHECKBOX_GROUP', 'COLOR_PALETTE', 'REPEATER'].includes(def.type)) return null;
    const mapped = mapFormFields(
      { custom_fields: siblings as unknown as PersonalizationProduct['custom_fields'] },
      locale,
      primaryLocale,
    ).find((f) => f.id === def.id);
    return mapped ? { ...mapped, id: fieldKey, linked: undefined } : null;
  }, [def, siblings, locale, primaryLocale, fieldKey]);

  switch (def.type) {
    case 'TEXT':
    case 'TEXTAREA':
      return (
        <TextField
          def={def}
          inputId={inputId}
          text={text}
          value={value}
          siblings={siblings}
          siblingValues={container}
          required={def.is_required}
          error={error}
          locale={locale}
          primaryLocale={primaryLocale}
          groupIndex={groupIndex}
          onChange={onChange}
        />
      );
    case 'CHECKBOX_GROUP':
      return (
        <CheckboxGroupField
          def={def}
          inputId={inputId}
          text={text}
          container={container}
          required={def.is_required}
          error={error}
          onChange={onChange}
        />
      );
    case 'COLOR_PALETTE':
      return (
        <ColorPaletteField
          def={def}
          inputId={inputId}
          text={text}
          value={value}
          ctx={model.ctx}
          required={def.is_required}
          error={error}
          onChange={onChange}
        />
      );
    default:
      if (!legacyField) return null;
      return (
        <div>
          {text.sublabel && <p className="mb-2 text-xs text-gray-500">{text.sublabel}</p>}
          <CustomFieldsForm
            fields={[legacyField]}
            values={{ [fieldKey]: value }}
            onChange={(_, v) => onChange(v)}
            errors={rawError ? { [fieldKey]: rawError } : {}}
            showAllErrors={showAllErrors}
          />
          {text.note && <p className="mt-1.5 text-xs text-gray-500">{text.note}</p>}
        </div>
      );
  }
}
