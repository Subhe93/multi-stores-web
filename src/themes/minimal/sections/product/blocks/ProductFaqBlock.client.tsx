'use client';

// `product-faq` block: the product's FAQs as an accessible accordion (WAI-ARIA
// accordion pattern): each question is a button with aria-expanded /
// aria-controls, each answer a labelled region. Enter / Space toggle (native
// button), ArrowUp / ArrowDown / Home / End move between questions. Answers
// are HTML sanitized by the API on write (product-faqs service), rendered
// like the FAQ panel of `product-tabs`. No FAQPage JSON-LD here: the product
// route already emits it for the product's FAQs (products/[slug]/page.tsx).
// FAQs without a question in the shown locale are skipped on purpose (an
// empty trigger button is not usable); the FAQPage JSON-LD builder applies
// the same rule. product-tabs still lists them, unchanged for live pages.

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { useOptionalProductPageState } from '@/components/product/state/ProductPageState';
import type { SectionRenderProps } from '../../../../types';
import { blockLabel, ProductBlockPlaceholder, ProductBlockScope } from './b2Shared';
import { headingTag, type TextTag } from '../../_shared/headingLevel';
import { headingText, ProductBlockHeading } from './b3Shared';

interface FaqEntry {
  key: string;
  question: string;
  answer: string;
}

/** Toggles one index; with `allowMultiple` off, opening one closes the others. */
export function toggleOpen(open: readonly number[], index: number, allowMultiple: boolean): number[] {
  if (open.includes(index)) return open.filter((i) => i !== index);
  return allowMultiple ? [...open, index] : [index];
}

/**
 * Tag of each question: one level below the block heading (h2 -> h3, capped
 * at h6). A hidden heading or a non-heading tag (p / div / span) keeps h3.
 */
export function faqQuestionTag(showHeading: boolean, level: unknown): TextTag {
  if (!showHeading) return 'h3';
  const match = /^h([1-6])$/.exec(headingTag(level, 'h2'));
  if (!match) return 'h3';
  return `h${Math.min(Number(match[1]) + 1, 6)}` as TextTag;
}

export function ProductFaqBlock({ settings, content, locale, product, builderPreview }: SectionRenderProps) {
  const t = useTranslations();
  const state = useOptionalProductPageState();
  const baseId = useId();
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const openFirst = settings?.open_first === true;
  const allowMultiple = settings?.allow_multiple !== false;
  const [open, setOpen] = useState<number[]>(() => (openFirst ? [0] : []));
  // Builder edits do not remount the block: re-sync the open panels when
  // open_first / allow_multiple change (adjust-state-during-render pattern,
  // so the first render, incl. SSR, is unchanged).
  const [prevOpenFirst, setPrevOpenFirst] = useState(openFirst);
  if (prevOpenFirst !== openFirst) {
    setPrevOpenFirst(openFirst);
    setOpen(openFirst ? [0] : []);
  }
  if (!allowMultiple && open.length > 1) setOpen(open.slice(-1));

  const lang = state?.locale ?? locale;
  const entries: FaqEntry[] = (state?.product.faqs ?? [])
    .map((faq, i) => {
      const tr = faq.translations.find((ft) => ft.locale === lang) || faq.translations[0];
      return { key: faq.id || String(i), question: (tr?.question || '').trim(), answer: tr?.answer || '' };
    })
    .filter((e) => e.question);

  if (!state || entries.length === 0) {
    return (
      <ProductBlockPlaceholder
        builderPreview={builderPreview ?? !product}
        label={blockLabel(locale, 'Product FAQ', 'الأسئلة الشائعة للمنتج')}
        hint={state ? blockLabel(locale, 'This product has no FAQs.', 'لا توجد أسئلة شائعة لهذا المنتج.') : undefined}
      />
    );
  }

  const showHeading = settings?.show_heading !== false;
  const headingId = `${baseId}-heading`;
  const QuestionTag = faqQuestionTag(showHeading, settings?.heading_level);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = entries.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = index === last ? 0 : index + 1;
    else if (e.key === 'ArrowUp') next = index === 0 ? last : index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    triggers.current[next]?.focus();
  };

  return (
    <ProductBlockScope>
      {showHeading && (
        <ProductBlockHeading level={settings?.heading_level} id={headingId}>
          {headingText(content, 'heading', t('product.faq'))}
        </ProductBlockHeading>
      )}
      <div
        className="divide-y divide-gray-200 rounded-xl border border-gray-200 overflow-hidden max-w-2xl"
        data-product-faq=""
        {...(showHeading ? { role: 'group', 'aria-labelledby': headingId } : {})}
      >
        {entries.map((entry, i) => {
          const isOpen = open.includes(i);
          const triggerId = `${baseId}-q${i}`;
          const panelId = `${baseId}-a${i}`;
          return (
            <div key={entry.key}>
              <QuestionTag className="m-0">
                <button
                  ref={(el) => {
                    triggers.current[i] = el;
                  }}
                  id={triggerId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen((cur) => toggleOpen(cur, i, allowMultiple))}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-start text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  <span className="min-w-0 wrap-break-word">{entry.question}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </QuestionTag>
              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                hidden={!isOpen}
                className="px-4 pb-4 pt-1 text-sm text-gray-600 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: entry.answer }}
              />
            </div>
          );
        })}
      </div>
    </ProductBlockScope>
  );
}
