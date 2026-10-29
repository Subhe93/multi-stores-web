'use client';

// Rich text (collection descriptions) shown as the first few lines with a
// fade-out and a "Show more" toggle. The full HTML is always in the DOM —
// only clipped visually — so search engines index all of it. The fade is a
// CSS mask, so it works on any background (plain page or hero image).

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

interface CollapsibleHtmlProps {
  html: string;
  className?: string;
  style?: CSSProperties;
  /** Visible lines while collapsed. */
  lines?: number;
  /** Colour of the toggle; defaults to the store primary colour. */
  buttonColor?: string;
}

const FADE =
  'linear-gradient(to bottom, #000 calc(100% - 1.75lh), transparent 100%)';

export function CollapsibleHtml({
  html,
  className = '',
  style,
  lines = 3,
  buttonColor,
}: CollapsibleHtmlProps) {
  const t = useTranslations('common');
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  // Until measured, assume the text overflows so the server render and the
  // first client render agree (clipped + button); short texts unclip after.
  const [overflows, setOverflows] = useState(true);

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
    <div className={className} style={style}>
      <div
        id={id}
        ref={ref}
        className="overflow-hidden [&>*:first-child]:mt-0"
        style={
          clipped
            ? {
                maxHeight: `${lines}lh`,
                maskImage: FADE,
                WebkitMaskImage: FADE,
              }
            : { maxHeight: 'none' }
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {overflows && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((v) => !v)}
          className="not-prose mt-2 inline-flex items-center gap-1 rounded text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: buttonColor ?? 'var(--store-primary, currentColor)' }}
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
