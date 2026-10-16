'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { HelpCircle } from 'lucide-react';
import { HelpModal } from '../HelpModal';
import type { FieldText } from '../model';

interface FieldShellProps {
  /** Element id of the input (label target). */
  inputId: string;
  text: FieldText;
  required: boolean;
  /** Error shown under the field (already gated by the caller). */
  error?: string | null;
  /** Shown on the label's line, at the end (e.g. the counter). */
  aside?: ReactNode;
  /** Render the label as a group legend (checkbox / palette). */
  asGroup?: boolean;
  children: ReactNode;
}

/**
 * Label (required mark, "?" help button), sublabel above the control, note
 * and error below (namez A L314-352). Logical spacing only (RTL-safe).
 */
export function FieldShell({ inputId, text, required, error, aside, asGroup = false, children }: FieldShellProps) {
  const t = useTranslations('personalization');
  const [helpOpen, setHelpOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const hasHelp = Boolean(text.helpText || text.helpImageUrl);
  const labelId = `${inputId}-label`;

  const label = (
    <span className="text-sm font-semibold text-gray-900">
      {text.label}
      {required && <span className="text-red-500 ms-0.5">*</span>}
    </span>
  );

  return (
    <div role={asGroup ? 'group' : undefined} aria-labelledby={asGroup ? labelId : undefined}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {asGroup ? (
            <span id={labelId}>{label}</span>
          ) : (
            <label id={labelId} htmlFor={inputId}>
              {label}
            </label>
          )}
          {hasHelp && (
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label={t('helpFor', { label: text.label })}
              title={t('help')}
              className="shrink-0 rounded-full text-gray-400 hover:text-gray-700"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
        </div>
        {aside}
      </div>
      {text.sublabel && <p className="mb-2 text-xs text-gray-500">{text.sublabel}</p>}
      {children}
      {text.note && <p className="mt-1.5 text-xs text-gray-500">{text.note}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600 font-medium">
          {error}
        </p>
      )}
      {hasHelp && (
        <HelpModal
          open={helpOpen}
          onClose={closeHelp}
          title={text.label}
          text={text.helpText}
          imageUrl={text.helpImageUrl}
        />
      )}
    </div>
  );
}
