'use client';

import { checkboxSelection, optionValues, type PFieldDef } from '@multi-stores/core/personalization';
import type { FieldText } from '../model';
import { FieldShell } from './FieldShell';

interface CheckboxGroupFieldProps {
  def: PFieldDef;
  inputId: string;
  text: FieldText;
  /** The sibling values object: an absent key means `ui.default_checked` (PPOM default). */
  container: Record<string, unknown>;
  required: boolean;
  error?: string | null;
  onChange: (value: string[]) => void;
}

/**
 * CHECKBOX_GROUP (namez PPOM 4414): one checkbox per option. Until the buyer
 * touches it the defaults are checked; unchecking everything sends `[]`.
 */
export function CheckboxGroupField({ def, inputId, text, container, required, error, onChange }: CheckboxGroupFieldProps) {
  const options = optionValues(def.options);
  const checked = checkboxSelection(def, container).list;

  const toggle = (option: string) => {
    const next = checked.includes(option) ? checked.filter((o) => o !== option) : [...checked, option];
    // Kept in option order, like the canonical value.
    onChange(options.filter((o) => next.includes(o)));
  };

  return (
    <FieldShell inputId={inputId} text={text} required={required} error={error} asGroup>
      <div className="flex flex-col gap-2">
        {options.map((option, i) => {
          const id = i === 0 ? inputId : `${inputId}-${i}`;
          return (
            <label key={option} htmlFor={id} className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700">
              <input
                id={id}
                type="checkbox"
                checked={checked.includes(option)}
                onChange={() => toggle(option)}
                className="w-4 h-4 rounded border-gray-300"
                style={{ accentColor: 'var(--store-primary, #2563eb)' }}
              />
              <span>{text.optionLabels?.[option] ?? option}</span>
            </label>
          );
        })}
      </div>
    </FieldShell>
  );
}
