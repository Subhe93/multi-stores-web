'use client';

// Long rich text (collection SEO description) shown as the first few lines
// with a fade-out and a "Show more" toggle. The full HTML is always in the
// DOM — only clipped visually — so search engines index all of it.

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

interface CollapsibleHtmlProps {
  html: string;
  className?: string;
  /** Visible lines while collapsed. */
  lines?: number;
}

export function CollapsibleHtml({ html, className = '', lines = 3 }: CollapsibleHtmlProps) {
  const t = useTranslations('common');
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  // Until measured, assume the text overflows so the server render and the
  // first client render agree (clipped + button); short texts unclip after.
  const [overflows, setOverflows] = useState(true);

  // Collapsed height in line units; `lh` follows the text's own line-height.
  const collapsedHeight = `${lines}lh`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
      setOverflows(el.scrollHeight > lineHeight * lines + 4);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [html, lines]);

  const clipped = overflows && !expanded;

  return (
    <div className={className}>
      <div className="relative">
        <div
          id={id}
          ref={ref}
          className="overflow-hidden transition-[max-height] duration-300 [&>*:first-child]:mt-0"
          style={{ maxHeight: clipped ? collapsedHeight : 'none' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {clipped && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[2lh] bg-linear-to-b from-transparent to-[var(--theme-colors-background,#fff)]"
          />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold not-prose hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
          style={{ color: 'var(--store-primary, currentColor)' }}
        >
          {expanded ? t('showLess') : t('showMore')}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      )}
    </div>
  );
}
