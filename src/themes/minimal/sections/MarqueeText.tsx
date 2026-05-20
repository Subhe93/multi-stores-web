import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';

// Seconds per loop by speed setting.
const DURATION: Record<string, number> = { slow: 40, normal: 24, fast: 14 };
const SIZE: Record<string, string> = {
  md: 'text-3xl md:text-5xl',
  lg: 'text-5xl md:text-7xl',
  xl: 'text-6xl md:text-8xl',
};

// A bold oversized text band that scrolls horizontally forever (CSS-only
// marquee, see .marquee in globals.css). The phrase repeats with a separator;
// pauses on hover and stops/wraps under reduced motion.
function MarqueeText({ settings, content }: SectionRenderProps) {
  const text = (content.text as string) || '';
  const separator = (settings.separator as string) || '✦';
  const speed = (settings.speed as string) || 'normal';
  const size = (settings.size as string) || 'lg';
  const duration = DURATION[speed] ?? DURATION.normal;
  const color = colorOr(settings.text_color, 'var(--theme-colors-text)');
  const bg = colorOr(settings.bg_color, 'transparent');
  const outline = settings.style === 'outline';

  if (!text) {
    return (
      <section className="py-12">
        <div className="text-center py-10 px-4" style={{ border: '1px dashed var(--theme-colors-border)', borderRadius: 'var(--theme-radius-md)', color: 'var(--theme-colors-muted)' }}>
          <p className="text-sm">Add a phrase from the builder.</p>
        </div>
      </section>
    );
  }

  // One repeated unit: phrase + separator. Build a copy long enough to fill the
  // viewport, then duplicate it so the -50% translate loops seamlessly.
  const unit = Array.from({ length: 6 });
  const copy = (key: string) => (
    <div className="flex shrink-0" aria-hidden={key === 'b'} key={key}>
      {unit.map((_, i) => (
        <span key={i} className="flex items-center whitespace-nowrap">
          <span className="px-6">{text}</span>
          <span className="px-2 opacity-50" style={{ color: 'var(--theme-colors-accent)' }}>{separator}</span>
        </span>
      ))}
    </div>
  );

  return (
    <section className="py-10" style={{ backgroundColor: bg }}>
      <div className="marquee">
        <div
          className={`marquee-track ${SIZE[size]} font-extrabold tracking-tight`}
          style={{
            animationDuration: `${duration}s`,
            fontFamily: 'var(--theme-font-heading)',
            color: outline ? 'transparent' : color,
            WebkitTextStroke: outline ? `1.5px ${color}` : undefined,
          }}
        >
          {copy('a')}
          {copy('b')}
        </div>
      </div>
    </section>
  );
}

export const marqueeTextSection: SectionDefinition = {
  schema: {
    id: 'marquee-text',
    label: { en: 'Marquee Text', ar: 'نص متحرّك' },
    icon: 'type',
    category: 'showcase',
    description: {
      en: 'A bold oversized phrase that scrolls across the screen on a loop. Pauses on hover.',
      ar: 'عبارة ضخمة جريئة تمرّ أفقياً عبر الشاشة بشكل متكرّر. تتوقف عند المرور.',
    },
    translatable: ['text'],
    schema: [
      { key: 'text', type: 'text', label: { en: 'Text', ar: 'النص' }, maxLength: 60 },
      { key: 'separator', type: 'text', label: { en: 'Separator', ar: 'الفاصل' }, maxLength: 3, defaultValue: '✦' },
      {
        key: 'size',
        type: 'select',
        label: { en: 'Size', ar: 'الحجم' },
        defaultValue: 'lg',
        options: [
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
          { value: 'xl', label: { en: 'Extra large', ar: 'ضخم' } },
        ],
      },
      {
        key: 'speed',
        type: 'select',
        label: { en: 'Speed', ar: 'السرعة' },
        defaultValue: 'normal',
        options: [
          { value: 'slow', label: { en: 'Slow', ar: 'بطيء' } },
          { value: 'normal', label: { en: 'Normal', ar: 'متوسط' } },
          { value: 'fast', label: { en: 'Fast', ar: 'سريع' } },
        ],
      },
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'النمط' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'مصمت' } },
          { value: 'outline', label: { en: 'Outline', ar: 'مفرّغ' } },
        ],
      },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
    ],
  },
  Component: MarqueeText,
  defaultSettings: { separator: '✦', size: 'lg', speed: 'normal', style: 'solid' },
  defaultContent: { text: 'Free shipping worldwide' },
};
