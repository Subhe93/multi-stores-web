'use client';

// Component implementation lives in a 'use client' file. The definition
// (schema + Component reference) lives in FaqList.tsx as a SHARED module so
// the server-side theme registry can read `.Component` as a ClientReference.
// Exporting the section object directly from a 'use client' file would make
// the whole object a ClientReference and `def.Component` would be undefined
// on the server.

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SectionRenderProps } from '../../types';

interface FaqItem {
  question?: string;
  answer?: string;
}

export function FaqList({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const items = (content.items as FaqItem[]) || [];
  const layout = (settings.layout as 'stacked' | 'two-column') || 'stacked';
  const allowMultiple = settings.allow_multiple !== false;
  const [open, setOpen] = useState<Set<number>>(new Set([0]));

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const visible = items.filter((q) => q.question || q.answer);

  function Row({ q, i }: { q: FaqItem; i: number }) {
    const isOpen = open.has(i);
    return (
      <div
        className="overflow-hidden transition-colors"
        style={{
          border: '1px solid var(--theme-colors-border)',
          borderRadius: 'var(--theme-radius-md)',
          backgroundColor: isOpen ? 'var(--theme-colors-surface)' : 'var(--theme-colors-background)',
        }}
      >
        <button
          type="button"
          onClick={() => toggle(i)}
          className="w-full flex items-start justify-between gap-4 text-left px-5 py-4"
        >
          <span
            className="flex-1"
            style={{
              fontWeight: 'var(--theme-weight-bold)',
              color: 'var(--theme-colors-text)',
              fontSize: 'var(--theme-scale-body)',
            }}
          >
            {q.question}
          </span>
          <ChevronDown
            className="size-4 mt-1 shrink-0 transition-transform duration-300"
            style={{
              color: 'var(--theme-colors-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            }}
          />
        </button>
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <p
              className="px-5 pb-5 text-sm leading-relaxed"
              style={{ color: 'var(--theme-colors-muted)' }}
            >
              {q.answer}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="py-12">
      {(heading || subheading) && (
        <div className="text-center mb-10 space-y-2">
          {heading && (
            <h2
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h2)',
                fontWeight: 'var(--theme-weight-heading)',
                lineHeight: 'var(--theme-line-heading)',
              }}
            >
              {heading}
            </h2>
          )}
          {subheading && (
            <p className="max-w-2xl mx-auto" style={{ color: 'var(--theme-colors-muted)' }}>
              {subheading}
            </p>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div
          className="max-w-3xl mx-auto text-center py-8 px-4"
          style={{
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
            color: 'var(--theme-colors-muted)',
          }}
        >
          <p className="text-sm">
            {locale === 'ar'
              ? 'لا توجد أسئلة بعد. أضف أسئلة من البيلدر لتظهر هنا.'
              : 'No questions yet. Add some from the builder.'}
          </p>
        </div>
      ) : (
        <div
          className={
            layout === 'two-column'
              ? 'grid md:grid-cols-2 gap-3 max-w-5xl mx-auto'
              : 'space-y-3 max-w-3xl mx-auto'
          }
        >
          {visible.map((q, i) => (
            <Row key={i} q={q} i={i} />
          ))}
        </div>
      )}
    </section>
  );
}
