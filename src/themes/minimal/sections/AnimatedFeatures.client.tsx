'use client';

// Component implementation. Definition lives in AnimatedFeatures.tsx so the
// server-side theme registry resolves `.Component` to a ClientReference.

import { motion } from 'framer-motion';
import { colorOr } from '../../elementStyles';
import type { SectionRenderProps } from '../../types';

interface FeatureItem {
  icon?: string;
  title?: string;
  description?: string;
}

// Line-art icon paths (24×24, single/few strokes) drawn with stroke animation.
const ICON_PATHS: Record<string, string[]> = {
  bolt: ['M13 2 L4 14 H11 L11 22 L20 10 H13 Z'],
  heart: ['M12 21 C-5 9 6 1 12 7 C18 1 29 9 12 21 Z'],
  star: ['M12 3 L14.6 9 L21 9.5 L16 13.8 L17.6 20 L12 16.5 L6.4 20 L8 13.8 L3 9.5 L9.4 9 Z'],
  gift: ['M3 11 H21 V21 H3 Z', 'M3 7 H21 V11 H3 Z', 'M12 7 V21'],
  shield: ['M12 3 L20 6 V11 C20 16 16 20 12 21 C8 20 4 16 4 11 V6 Z'],
  truck: ['M2 6 H15 V16 H2 Z', 'M15 9 H19 L22 12 V16 H15 Z', 'M6.5 18 a1.5 1.5 0 1 0 0.01 0', 'M17.5 18 a1.5 1.5 0 1 0 0.01 0'],
  check: ['M4 12 L10 18 L20 5'],
  spark: ['M12 2 V8', 'M12 16 V22', 'M2 12 H8', 'M16 12 H22', 'M5 5 L9 9', 'M15 15 L19 19', 'M19 5 L15 9', 'M9 15 L5 19'],
};

const draw = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: { pathLength: { duration: 0.9, delay: 0.15 + i * 0.12, ease: 'easeInOut' as const }, opacity: { duration: 0.2, delay: 0.15 + i * 0.12 } },
  }),
};

function clampColumns(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : fallback;
  return Math.max(2, Math.min(4, v));
}

export function AnimatedFeatures({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const items = ((content.items as FeatureItem[]) || []).filter((f) => f.title || f.description || f.icon);
  const columns = clampColumns(settings.columns, 4);
  const stroke = colorOr(settings.icon_color, 'var(--theme-colors-primary)');
  const titleColor = colorOr(settings.title_color, 'var(--theme-colors-text)');
  const descColor = colorOr(settings.description_color, 'var(--theme-colors-muted)');

  if (items.length === 0) {
    return (
      <section className="py-12">
        <div className="text-center py-10 px-4" style={{ border: '1px dashed var(--theme-colors-border)', borderRadius: 'var(--theme-radius-md)', color: 'var(--theme-colors-muted)' }}>
          <p className="text-sm">{locale === 'ar' ? 'لا توجد مميزات بعد. أضف عناصر من البيلدر.' : 'No features yet. Add some from the builder.'}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-14">
      {(heading || subheading) && (
        <div className="mb-12 max-w-2xl mx-auto text-center flex flex-col gap-3">
          {heading && (
            <h2 style={{ fontFamily: 'var(--theme-font-heading)', fontSize: 'var(--theme-scale-h2)', fontWeight: 'var(--theme-weight-heading)', letterSpacing: 'var(--theme-tracking-heading)', color: colorOr(settings.heading_color, 'var(--theme-colors-text)') }}>
              {heading}
            </h2>
          )}
          {subheading && <p className="text-base" style={{ color: colorOr(settings.subheading_color, 'var(--theme-colors-muted)') }}>{subheading}</p>}
        </div>
      )}

      <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map((f, i) => {
          const paths = ICON_PATHS[f.icon || 'check'] || ICON_PATHS.check;
          return (
            <div key={i} className="flex flex-col items-center text-center gap-3">
              <motion.svg
                width="56" height="56" viewBox="0 0 24 24" fill="none"
                stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }}
                aria-hidden
              >
                {paths.map((d, p) => (
                  <motion.path key={p} d={d} variants={draw} custom={p} />
                ))}
              </motion.svg>
              {f.title && <h3 className="text-base font-semibold leading-tight" style={{ color: titleColor }}>{f.title}</h3>}
              {f.description && <p className="text-sm leading-relaxed max-w-xs" style={{ color: descColor }}>{f.description}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
