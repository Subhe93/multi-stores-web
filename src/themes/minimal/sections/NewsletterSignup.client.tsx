'use client';

// Component implementation. Definition stays in NewsletterSignup.tsx so the
// server-side theme registry can read `.Component` as a ClientReference.

import { useState } from 'react';
import { Check, Loader2, Mail } from 'lucide-react';
import type { SectionRenderProps } from '../../types';
import { buttonStyles, colorOr } from '../../elementStyles';

export function NewsletterSignup({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const placeholder = (content.placeholder as string) || (locale === 'ar' ? 'بريدك الإلكتروني' : 'Your email');
  const buttonLabel = (content.button_label as string) || (locale === 'ar' ? 'اشترك' : 'Subscribe');
  const successMessage = (content.success_message as string) || (locale === 'ar' ? 'شكراً! تم اشتراكك بنجاح.' : "Thanks! You're subscribed.");
  const style = (settings.style as 'card' | 'inline' | 'banner') || 'card';

  const onDark = style === 'banner';
  const headingColor = colorOr(settings.heading_color, onDark ? 'currentColor' : 'var(--theme-colors-text)');
  const subheadingColor = colorOr(
    settings.subheading_color,
    onDark ? 'rgba(255,255,255,0.9)' : 'var(--theme-colors-muted)',
  );
  const ctaStyle = buttonStyles(
    {
      bg: settings.cta_bg_color,
      text: settings.cta_text_color,
      borderColor: settings.cta_border_color,
      borderWidth: settings.cta_border_width,
      borderRadius: settings.cta_border_radius,
    },
    {
      bg: 'var(--theme-colors-primary)',
      text: 'var(--theme-colors-primaryContrast, #fff)',
      // Soft & Rounded: pill button to match the pill input below.
      radius: 'var(--theme-radius-full)',
    },
  );

  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'submitting' || !email.trim()) return;
    setState('submitting');
    // Stub: wire to /newsletter/subscribe later. Optimistic flow lets creators
    // still test the visual states.
    await new Promise((r) => setTimeout(r, 600));
    setState('success');
    setEmail('');
    setTimeout(() => setState('idle'), 4000);
  }

  const form = (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 w-full max-w-lg">
      <div
        className="flex-1 flex items-center gap-2 px-4"
        style={{
          backgroundColor: 'var(--theme-colors-background)',
          border: '1px solid var(--theme-colors-border)',
          borderRadius: 'var(--theme-radius-full)',
        }}
      >
        <Mail className="size-4 shrink-0" style={{ color: 'var(--theme-colors-muted)' }} />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent py-3 text-sm outline-none"
          style={{ color: 'var(--theme-colors-text)' }}
        />
      </div>
      <button
        type="submit"
        disabled={state === 'submitting'}
        className="inline-flex items-center justify-center gap-2 px-6 py-3 disabled:opacity-60"
        style={{ ...ctaStyle, fontWeight: 'var(--theme-weight-bold)' }}
      >
        {state === 'submitting' ? (
          <>
            <Loader2 className="size-4 animate-spin" /> …
          </>
        ) : state === 'success' ? (
          <>
            <Check className="size-4" />
            {locale === 'ar' ? 'تم' : 'Done'}
          </>
        ) : (
          buttonLabel
        )}
      </button>
    </form>
  );

  const message = state === 'success' && (
    <p className="text-sm mt-3" style={{ color: 'var(--theme-colors-accent)' }}>
      {successMessage}
    </p>
  );

  if (style === 'inline') {
    return (
      <section className="py-10 flex flex-col items-center text-center gap-3">
        {heading && (
          <h2
            style={{
              fontFamily: 'var(--theme-font-heading)',
              fontSize: 'var(--theme-scale-h3)',
              fontWeight: 'var(--theme-weight-heading)',
              color: headingColor,
            }}
          >
            {heading}
          </h2>
        )}
        {subheading && (
          <p className="max-w-xl text-sm" style={{ color: subheadingColor }}>
            {subheading}
          </p>
        )}
        {form}
        {message}
      </section>
    );
  }

  if (style === 'banner') {
    return (
      <section
        className="relative my-10 py-16 px-8 text-center text-white overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, var(--theme-colors-primary) 0%, var(--theme-colors-secondary) 100%)',
          borderRadius: 'var(--theme-radius-lg)',
        }}
      >
        {heading && (
          <h2
            className="mb-3"
            style={{
              fontFamily: 'var(--theme-font-heading)',
              fontSize: 'var(--theme-scale-h2)',
              fontWeight: 'var(--theme-weight-heading)',
              color: headingColor,
            }}
          >
            {heading}
          </h2>
        )}
        {subheading && (
          <p className="max-w-2xl mx-auto mb-6" style={{ color: subheadingColor }}>{subheading}</p>
        )}
        <div className="flex justify-center">{form}</div>
        {message}
      </section>
    );
  }

  // Default: card
  return (
    <section className="py-10">
      <div
        className="max-w-2xl mx-auto p-8 text-center flex flex-col items-center gap-4"
        style={{
          backgroundColor: 'var(--theme-colors-surface)',
          border: '1px solid var(--theme-colors-border)',
          borderRadius: 'var(--theme-radius-lg)',
        }}
      >
        {heading && (
          <h2
            style={{
              fontFamily: 'var(--theme-font-heading)',
              fontSize: 'var(--theme-scale-h3)',
              fontWeight: 'var(--theme-weight-heading)',
              color: headingColor,
            }}
          >
            {heading}
          </h2>
        )}
        {subheading && (
          <p className="max-w-md text-sm" style={{ color: subheadingColor }}>
            {subheading}
          </p>
        )}
        {form}
        {message}
      </div>
    </section>
  );
}
