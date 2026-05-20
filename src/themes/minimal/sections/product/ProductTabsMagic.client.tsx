'use client';

// Component implementation. Definition lives in ProductTabsMagic.tsx.

import { useState } from 'react';
import type { SectionRenderProps } from '../../../types';

interface TabDef {
  key: 'description' | 'faqs' | 'shipping' | 'returns';
  label: string;
}

export function ProductTabsMagic({ settings, content, locale, product }: SectionRenderProps) {
  const enabled: Record<TabDef['key'], boolean> = {
    description: (settings.show_description as boolean) !== false,
    faqs: (settings.show_faqs as boolean) !== false,
    shipping: settings.show_shipping === true,
    returns: settings.show_returns === true,
  };

  const labels: Record<TabDef['key'], string> = {
    description: (content.tab_description_label as string) || (locale === 'ar' ? 'الوصف' : 'Description'),
    faqs: (content.tab_faqs_label as string) || (locale === 'ar' ? 'الأسئلة الشائعة' : 'FAQs'),
    shipping: (content.tab_shipping_label as string) || (locale === 'ar' ? 'الشحن' : 'Shipping'),
    returns: (content.tab_returns_label as string) || (locale === 'ar' ? 'الإرجاع' : 'Returns'),
  };

  const tabs: TabDef[] = (['description', 'faqs', 'shipping', 'returns'] as const)
    .filter((k) => enabled[k])
    .map((k) => ({ key: k, label: labels[k] }));

  const [active, setActive] = useState<TabDef['key']>(tabs[0]?.key ?? 'description');

  if (!product) {
    return (
      <div
        className="text-center py-8 px-4"
        style={{
          backgroundColor: 'var(--theme-colors-surface)',
          border: '1px dashed var(--theme-colors-border)',
          borderRadius: 'var(--theme-radius-md)',
        }}
      >
        <div className="text-xs uppercase tracking-wide text-[var(--theme-colors-muted)]">
          Product tabs
        </div>
      </div>
    );
  }

  if (tabs.length === 0) return null;

  const tr =
    product.translations.find((t) => t.locale === locale) ||
    product.translations.find((t) => t.locale === 'en') ||
    product.translations[0];
  const description = tr?.description;

  const faqs = (product.faqs || [])
    .map((f) => {
      const faqTr =
        f.translations.find((t) => t.locale === locale) ||
        f.translations.find((t) => t.locale === 'en') ||
        f.translations[0];
      return faqTr;
    })
    .filter((f): f is NonNullable<typeof f> => !!f && (!!f.question || !!f.answer));

  return (
    <section className="mt-10">
      <div
        className="flex items-center gap-1 border-b"
        style={{ borderColor: 'var(--theme-colors-border)' }}
      >
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className="px-4 py-2 -mb-px transition"
              style={{
                fontSize: 'var(--theme-scale-small)',
                fontWeight: isActive ? 'var(--theme-weight-bold)' : 'var(--theme-weight-body)',
                color: isActive ? 'var(--theme-colors-text)' : 'var(--theme-colors-muted)',
                borderBottom: isActive ? `2px solid var(--theme-colors-primary)` : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="py-5">
        {active === 'description' && (
          description ? (
            <div
              className="prose prose-sm max-w-none"
              style={{ color: 'var(--theme-colors-text)' }}
              dangerouslySetInnerHTML={{ __html: description }}
            />
          ) : (
            <p style={{ color: 'var(--theme-colors-muted)' }}>No description yet.</p>
          )
        )}

        {active === 'faqs' && (
          faqs.length === 0 ? (
            <p style={{ color: 'var(--theme-colors-muted)' }}>No questions yet.</p>
          ) : (
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <details
                  key={i}
                  className="p-3"
                  style={{
                    border: '1px solid var(--theme-colors-border)',
                    borderRadius: 'var(--theme-radius-sm)',
                  }}
                >
                  <summary
                    className="cursor-pointer"
                    style={{ fontWeight: 'var(--theme-weight-bold)' }}
                  >
                    {f.question}
                  </summary>
                  <p
                    className="mt-2 text-sm"
                    style={{ color: 'var(--theme-colors-muted)' }}
                  >
                    {f.answer}
                  </p>
                </details>
              ))}
            </div>
          )
        )}

        {active === 'shipping' && (
          <div
            className="prose prose-sm max-w-none"
            style={{ color: 'var(--theme-colors-text)' }}
            dangerouslySetInnerHTML={{ __html: (content.shipping_html as string) || '' }}
          />
        )}

        {active === 'returns' && (
          <div
            className="prose prose-sm max-w-none"
            style={{ color: 'var(--theme-colors-text)' }}
            dangerouslySetInnerHTML={{ __html: (content.returns_html as string) || '' }}
          />
        )}
      </div>
    </section>
  );
}
