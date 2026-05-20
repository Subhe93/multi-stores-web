'use client';

// Component implementation. Definition stays in Countdown.tsx so the
// server-side theme registry can read `.Component` as a ClientReference.

import { useEffect, useState } from 'react';
import type { SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function diffParts(targetMs: number, nowMs: number): Parts {
  const total = Math.max(0, targetMs - nowMs);
  const seconds = Math.floor(total / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

export function Countdown({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const expiredText = (content.expired_text as string) || (locale === 'ar' ? 'انتهى العرض' : 'This offer has ended');
  const align = (settings.alignment as 'left' | 'center' | 'right') || 'center';

  // Parse the target date once. Invalid/empty dates render as "no target".
  const targetMs = (() => {
    const raw = settings.target_date;
    if (typeof raw !== 'string' || !raw) return NaN;
    const ms = new Date(raw).getTime();
    return Number.isFinite(ms) ? ms : NaN;
  })();

  // Start null so the server render and the first client render match
  // (avoids a hydration mismatch); fill in on mount, then tick every second.
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    if (!Number.isFinite(targetMs)) return;
    const update = () => setParts(diffParts(targetMs, Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const alignClass = align === 'left' ? 'text-start items-start' : align === 'right' ? 'text-end items-end' : 'text-center items-center';
  const justify = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';

  const labels = locale === 'ar'
    ? { days: 'يوم', hours: 'ساعة', minutes: 'دقيقة', seconds: 'ثانية' }
    : { days: 'Days', hours: 'Hours', minutes: 'Min', seconds: 'Sec' };

  const expired = parts !== null && parts.days === 0 && parts.hours === 0 && parts.minutes === 0 && parts.seconds === 0;

  return (
    <section className="py-12">
      <div className={`flex flex-col gap-6 ${alignClass}`}>
        {(heading || subheading) && (
          <div className="max-w-2xl">
            {heading && (
              <h2
                style={{
                  fontFamily: 'var(--theme-font-heading)',
                  fontSize: 'var(--theme-scale-h2)',
                  fontWeight: 'var(--theme-weight-heading)',
                  lineHeight: 'var(--theme-line-heading)',
                  color: colorOr(settings.heading_color, 'var(--theme-colors-text)'),
                }}
              >
                {heading}
              </h2>
            )}
            {subheading && (
              <p className="text-sm mt-2" style={{ color: colorOr(settings.subheading_color, 'var(--theme-colors-muted)') }}>
                {subheading}
              </p>
            )}
          </div>
        )}

        {!Number.isFinite(targetMs) ? (
          <p className="text-sm" style={{ color: 'var(--theme-colors-muted)' }}>
            {locale === 'ar' ? 'حدّد تاريخ الانتهاء من البيلدر.' : 'Set an end date from the builder.'}
          </p>
        ) : expired ? (
          <p className="text-base font-semibold" style={{ color: 'var(--theme-colors-muted)' }}>
            {expiredText}
          </p>
        ) : (
          <div className={`flex gap-3 sm:gap-4 ${justify}`}>
            {(['days', 'hours', 'minutes', 'seconds'] as const).map((unit) => (
              <div
                key={unit}
                className="flex flex-col items-center justify-center min-w-[64px] px-3 py-3"
                style={{
                  backgroundColor: colorOr(settings.box_bg_color, 'var(--theme-colors-surface)'),
                  border: '1px solid var(--theme-colors-border)',
                  borderRadius: 'var(--theme-radius-md)',
                }}
              >
                <span
                  className="text-2xl sm:text-3xl font-bold tabular-nums leading-none"
                  style={{ color: colorOr(settings.digit_color, 'var(--theme-colors-primary)') }}
                >
                  {/* Render zeros until the client fills in `parts` post-mount. */}
                  {String(parts ? parts[unit] : 0).padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-wide mt-1.5" style={{ color: 'var(--theme-colors-muted)' }}>
                  {labels[unit]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
