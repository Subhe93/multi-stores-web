'use client';

import { useTranslations } from 'next-intl';
import { readRepeat, repeaterIndexes, type PFieldDef } from '@multi-stores/core/personalization';
import type { PersonalizationAdvanced } from '@/components/product/usePersonalizationFields';
import { fieldKey, groupHeading, repeaterItems } from '../model';
import { FieldRenderer } from './FieldRenderer';
import { PieceGroup } from './PieceGroup';

interface RepeaterFieldProps {
  def: PFieldDef;
  childDefs: readonly PFieldDef[];
  model: PersonalizationAdvanced;
  showAllErrors: boolean;
  locale: string;
  primaryLocale: string;
}

/**
 * REPEATER (namez C1/C2 "Artikel i"): one block per item `start..N`, N from
 * the chosen option (D6). Items out of range unmount and their values are
 * removed by the hook (namez clears them).
 */
export function RepeaterField({ def, childDefs, model, showAllErrors, locale, primaryLocale }: RepeaterFieldProps) {
  const t = useTranslations();
  const indexes = repeaterIndexes(def, model.ctx);
  if (indexes.length === 0) return null;
  const start = readRepeat(def.repeat)?.start ?? 1;
  const items = repeaterItems(model.values, def.id);

  return (
    <div className="flex flex-col gap-4">
      {indexes.map((index) => {
        const pos = index - start;
        const item = items[pos] ?? {};
        return (
          <PieceGroup key={index} heading={groupHeading(def, index, locale, primaryLocale, (k, p) => t(k, p))}>
            {childDefs.map((child) => (
                <FieldRenderer
                  key={child.id}
                  def={child}
                  fieldKey={fieldKey(def.id, index, child.id)}
                  siblings={childDefs}
                  container={item}
                  model={model}
                  showAllErrors={showAllErrors}
                  locale={locale}
                  primaryLocale={primaryLocale}
                  groupIndex={index}
                  onChange={(v) => model.setChildValue(def.id, pos, child.id, v)}
              />
            ))}
          </PieceGroup>
        );
      })}
    </div>
  );
}
