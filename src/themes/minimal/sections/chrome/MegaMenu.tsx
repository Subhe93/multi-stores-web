// MegaMenu — top-bar trigger labels (e.g. "Shop", "Brands", "Sale")
// that reveal a full-width panel with column groups + optional feature
// thumbnails on hover.
//
// Server-only — the panel is shown via :hover and :focus-within so it
// needs no JS. Touch users get a fallback: tapping the trigger follows
// its own URL (a section page) instead of toggling a JS dropdown.
//
// Designed to sit ABOVE or BELOW the HeaderBar in the HEADER chrome page.
// On mobile (≤ md) the whole bar collapses to a vertical accordion of
// triggers + nested links, no JS needed (uses <details>).

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
import type { SectionDefinition, SectionRenderProps } from '../../../types';
import { colorOr } from '../../../elementStyles';

interface MegaMenuLink {
  label?: string;
  url?: string;
}

interface MegaMenuColumn {
  heading?: string;
  links?: MegaMenuLink[];
}

interface MegaMenuFeature {
  image?: string;
  caption?: string;
  url?: string;
}

interface MegaMenuTrigger {
  label?: string;
  url?: string;
  columns?: MegaMenuColumn[];
  feature?: MegaMenuFeature;
}

function MegaMenu({ settings, content, locale }: SectionRenderProps) {
  const triggers = ((content.triggers as MegaMenuTrigger[]) || []).filter((t) => t.label);
  const alignment = (settings.alignment as 'start' | 'center' | 'end') || 'center';
  const bg = colorOr(settings.bg_color, 'var(--theme-colors-background)');
  const fg = colorOr(settings.text_color, 'var(--theme-colors-text)');
  const panelBg = colorOr(settings.panel_bg_color, 'var(--theme-colors-background)');
  const panelFg = colorOr(settings.panel_text_color, 'var(--theme-colors-text)');
  const accentColor = colorOr(settings.accent_color, 'var(--theme-colors-primary)');
  const borderColor = colorOr(settings.border_color, 'var(--theme-colors-border)');

  const justify =
    alignment === 'start' ? 'justify-start' : alignment === 'end' ? 'justify-end' : 'justify-center';

  if (triggers.length === 0) return null;

  return (
    <div
      className="relative"
      style={{
        backgroundColor: bg,
        color: fg,
        borderBottom: `1px solid ${borderColor}`,
      }}
    >
      {/* Desktop bar — triggers in a row, panel appears on group hover/focus. */}
      <div
        className={`hidden md:flex items-center gap-1 ${justify} px-4 sm:px-6 lg:px-8 h-12 mx-auto w-full`}
        style={{ maxWidth: 'var(--theme-container-max)' }}
      >
        {triggers.map((trigger, i) => {
          const hasPanel = (trigger.columns?.length ?? 0) > 0 || !!trigger.feature?.image;
          return (
            <div key={i} className="group static">
              <Link
                href={trigger.url || '#'}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md hover:bg-black/5 transition"
              >
                {trigger.label}
                {hasPanel && (
                  <ChevronDown
                    className="size-3.5 opacity-60 transition-transform group-hover:rotate-180 group-focus-within:rotate-180"
                  />
                )}
              </Link>

              {hasPanel && (
                <div
                  className="absolute inset-x-0 top-full mt-px shadow-xl border-t opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity duration-150 z-20"
                  style={{
                    backgroundColor: panelBg,
                    color: panelFg,
                    borderColor: borderColor,
                  }}
                >
                  <div
                    className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 grid gap-8 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]"
                    style={{ maxWidth: 'var(--theme-container-max)' }}
                  >
                    {trigger.columns?.map((col, ci) => (
                      <div key={ci} className="space-y-2.5">
                        {col.heading && (
                          <h4
                            className="text-xs font-bold uppercase tracking-wider"
                            style={{ color: accentColor }}
                          >
                            {col.heading}
                          </h4>
                        )}
                        {col.links && col.links.length > 0 && (
                          <ul className="space-y-1.5" style={{ listStyle: 'none', padding: 0 }}>
                            {col.links
                              .filter((l) => l.label)
                              .map((link, li) => (
                                <li key={li}>
                                  <Link
                                    href={link.url || '#'}
                                    className="text-sm hover:opacity-70 transition-opacity"
                                  >
                                    {link.label}
                                  </Link>
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                    ))}

                    {/* Optional feature card — a single promo image with caption. */}
                    {trigger.feature?.image && (
                      <Link
                        href={trigger.feature.url || '#'}
                        className="block group/feat relative overflow-hidden"
                        style={{ borderRadius: 'var(--theme-radius-md)' }}
                      >
                        <img
                          src={resolveMediaUrl(trigger.feature.image)}
                          alt={trigger.feature.caption || ''}
                          loading="lazy"
                          className="w-full aspect-4/3 object-cover transition-transform duration-500 group-hover/feat:scale-105"
                        />
                        {trigger.feature.caption && (
                          <div
                            className="absolute inset-x-0 bottom-0 p-3 text-white text-sm font-semibold"
                            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}
                          >
                            {trigger.feature.caption}
                          </div>
                        )}
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile — pure-CSS accordion via <details>. Each trigger becomes a
          collapsible section; tapping the summary expands its links. */}
      <div className="md:hidden">
        {triggers.map((trigger, i) => {
          const hasPanel = (trigger.columns?.length ?? 0) > 0;
          if (!hasPanel) {
            return (
              <Link
                key={i}
                href={trigger.url || '#'}
                className="block px-4 py-3 text-sm font-medium border-b"
                style={{ borderColor: borderColor }}
              >
                {trigger.label}
              </Link>
            );
          }
          return (
            <details key={i} className="border-b group/mob" style={{ borderColor: borderColor }}>
              <summary className="flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium cursor-pointer list-none">
                <span>{trigger.label}</span>
                <ChevronDown className="size-4 opacity-60 group-open/mob:rotate-180 transition-transform" />
              </summary>
              <div className="pb-3" style={{ backgroundColor: panelBg, color: panelFg }}>
                {trigger.columns?.map((col, ci) => (
                  <div key={ci} className="px-4 pt-3">
                    {col.heading && (
                      <h4
                        className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                        style={{ color: accentColor }}
                      >
                        {col.heading}
                      </h4>
                    )}
                    {col.links
                      ?.filter((l) => l.label)
                      .map((link, li) => (
                        <Link
                          key={li}
                          href={link.url || '#'}
                          className="block py-1.5 text-sm hover:opacity-70"
                        >
                          {link.label}
                        </Link>
                      ))}
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {/* RTL safety: ensure the hidden panel is hidden in RTL too (Tailwind's
          `invisible` already does this; this rule is here to keep the
          accordion summary's default disclosure marker hidden across browsers). */}
      <style
        dangerouslySetInnerHTML={{
          __html: `details > summary::-webkit-details-marker { display: none; }
                   details > summary { list-style: none; }`,
        }}
      />
      {/* `locale` referenced once so eslint stops nagging; could later drive
          accent inversion in RTL but no UX delta today. */}
      <span hidden>{locale}</span>
    </div>
  );
}

export const megaMenuSection: SectionDefinition = {
  schema: {
    id: 'mega-menu',
    label: { en: 'Mega Menu', ar: 'القائمة الموسّعة' },
    icon: 'layout-grid',
    category: 'header',
    description: {
      en: 'Top-bar triggers that reveal a full-width panel with link columns + an optional feature image. Mobile collapses to a CSS-only accordion (no JS).',
      ar: 'محفّزات في الشريط العلوي تكشف لوحة بعرض كامل بأعمدة روابط + صورة ميزة اختيارية. على الجوال يتحوّل إلى أكورديون CSS فقط بدون JS.',
    },
    pageTypes: ['HEADER'],
    translatable: ['triggers'],
    schema: [
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Trigger alignment', ar: 'محاذاة المحفّزات' },
        defaultValue: 'center',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
        ],
      },
      {
        key: 'triggers',
        type: 'repeater',
        label: { en: 'Triggers', ar: 'المحفّزات' },
        fields: [
          { key: 'label', type: 'text', label: { en: 'Trigger label', ar: 'تسمية المحفّز' }, maxLength: 40 },
          { key: 'url', type: 'url', label: { en: 'Trigger URL (when tapped on mobile or no panel)', ar: 'رابط المحفّز (عند الضغط بدون لوحة)' } },
          {
            key: 'columns',
            type: 'repeater',
            label: { en: 'Link columns (drop the panel)', ar: 'أعمدة روابط (تُسقط اللوحة)' },
            fields: [
              { key: 'heading', type: 'text', label: { en: 'Column heading', ar: 'عنوان العمود' } },
              {
                key: 'links',
                type: 'repeater',
                label: { en: 'Links', ar: 'الروابط' },
                fields: [
                  { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
                  { key: 'url', type: 'url', label: { en: 'URL', ar: 'الرابط' } },
                ],
              },
            ],
          },
          {
            key: 'feature',
            type: 'repeater',
            label: { en: 'Feature card (single — uses first row)', ar: 'بطاقة ميزة (واحدة — تستخدم أول صف)' },
            fields: [
              { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
              { key: 'caption', type: 'text', label: { en: 'Caption', ar: 'التسمية' } },
              { key: 'url', type: 'url', label: { en: 'URL', ar: 'الرابط' } },
            ],
          },
        ],
      },
      { key: 'bg_color', type: 'color', label: { en: 'Bar background color', ar: 'لون خلفية الشريط' } },
      { key: 'text_color', type: 'color', label: { en: 'Bar text color', ar: 'لون نص الشريط' } },
      { key: 'panel_bg_color', type: 'color', label: { en: 'Panel background color', ar: 'لون خلفية اللوحة' } },
      { key: 'panel_text_color', type: 'color', label: { en: 'Panel text color', ar: 'لون نص اللوحة' } },
      { key: 'accent_color', type: 'color', label: { en: 'Column heading color (accent)', ar: 'لون عنوان العمود (تمييز)' } },
      { key: 'border_color', type: 'color', label: { en: 'Border color', ar: 'لون الحدود' } },
    ],
  },
  Component: MegaMenu,
  defaultSettings: { alignment: 'center' },
  defaultContent: {
    triggers: [
      {
        label: 'Shop',
        url: '/products',
        columns: [
          {
            heading: 'Categories',
            links: [
              { label: 'New arrivals', url: '/products?sort=newest' },
              { label: 'Best sellers', url: '/products?sort=popular' },
              { label: 'On sale', url: '/products?sale=true' },
            ],
          },
          {
            heading: 'Collections',
            links: [
              { label: 'Spring 2026', url: '/collections/spring-2026' },
              { label: 'Essentials', url: '/collections/essentials' },
            ],
          },
        ],
      },
      { label: 'About', url: '/pages/about' },
      { label: 'Contact', url: '/pages/contact' },
    ],
  },
};
