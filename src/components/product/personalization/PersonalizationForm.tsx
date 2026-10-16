'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { readUi, splitFieldTree } from '@/lib/personalization';
import type { PersonalizationAdvanced } from '@/components/product/usePersonalizationFields';
import { visibleFieldsAt, type Placement } from './model';
import { FieldRenderer } from './fields/FieldRenderer';
import { RepeaterField } from './fields/RepeaterField';

interface PersonalizationFormProps {
  /** App-mode state from `usePersonalizationFields(...).advanced`. */
  model: PersonalizationAdvanced;
  /** Renders only the fields with this `ui.placement`. */
  placement: Placement;
  showAllErrors: boolean;
  locale: string;
  primaryLocale: string;
  /** Show the validation summary under this block (after a submit attempt). */
  showSummary?: boolean;
  /** Puts the `#personalize` anchor on this block (listing CTA target). */
  anchor?: boolean;
}

/**
 * The personalization app form (M4.1 §5): visible fields of one placement in
 * field order, repeaters as item blocks, and the optional summary list
 * ("Vänligen komplettera följande fält:", namez C1 L78-82). Visibility,
 * required and errors come from the shared evaluator on every change.
 */
export function PersonalizationForm({
  model,
  placement,
  showAllErrors,
  locale,
  primaryLocale,
  showSummary = false,
  anchor = false,
}: PersonalizationFormProps) {
  const t = useTranslations('personalization');
  const { top, childrenOf } = useMemo(() => splitFieldTree(model.defs), [model.defs]);
  const visible = useMemo(() => new Set(model.result.visibleIds), [model.result.visibleIds]);
  const shown = visibleFieldsAt(model.defs, model.result.visibleIds, placement);
  // The summary only lists errors when a visible field asks for it (`ui.validation_summary`).
  const wantsSummary = showSummary && top.some((d) => visible.has(d.id) && readUi(d.ui).validation_summary === true);
  const summary = wantsSummary && showAllErrors ? model.summary : [];

  if (shown.length === 0 && summary.length === 0) return anchor ? <div id="personalize" /> : null;

  return (
    <div id={anchor ? 'personalize' : undefined} className="flex flex-col gap-5 scroll-mt-24">
      {shown.map((def) =>
        def.type === 'REPEATER' ? (
          <RepeaterField
            key={def.id}
            def={def}
            childDefs={childrenOf.get(def.id) ?? []}
            model={model}
            showAllErrors={showAllErrors}
            locale={locale}
            primaryLocale={primaryLocale}
          />
        ) : (
          <FieldRenderer
            key={def.id}
            def={def}
            fieldKey={def.id}
            siblings={top}
            container={model.values}
            model={model}
            showAllErrors={showAllErrors}
            locale={locale}
            primaryLocale={primaryLocale}
            onChange={(v) => model.setValue(def.id, v)}
          />
        ),
      )}
      {summary.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{t('summaryTitle')}</p>
          <ul className="mt-2 list-disc ps-5 text-sm text-red-700 space-y-0.5">
            {summary.map((s) => (
              <li key={s.key}>{s.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
