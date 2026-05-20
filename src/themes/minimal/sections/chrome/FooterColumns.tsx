// FooterColumns — a multi-column link list typically used as the bulk of
// a site footer. Server-only. Each column has a heading and a repeater of
// links. A separate CopyrightBar section handles the bottom strip.

import Link from 'next/link';
import type { SectionDefinition, SectionRenderProps } from '../../../types';
import { resolveMenuItems } from '../../../types';
import { colorOr } from '../../../elementStyles';

interface FooterLink {
  label?: string;
  url?: string;
}

interface FooterColumn {
  heading?: string;
  // When set, the column's links come from this navigation menu (built in
  // /creator/menus). Otherwise the inline `links` repeater is used.
  menu_key?: string;
  links?: FooterLink[];
}

function FooterColumns({ settings, content, locale, storeContext }: SectionRenderProps) {
  const rawColumns = ((content.columns as FooterColumn[]) || []);
  // Resolve each column's links: a selected menu wins over inline links.
  const columns = rawColumns
    .map((c) => {
      const menuLinks = resolveMenuItems(storeContext, c.menu_key, locale).map((it) => ({
        label: it.label,
        url: it.url,
      }));
      return { ...c, links: menuLinks.length > 0 ? menuLinks : c.links };
    })
    .filter((c) => c.heading || (c.links?.length ?? 0) > 0);

  const bg = colorOr(settings.bg_color, 'var(--theme-colors-surface)');
  const fg = colorOr(settings.text_color, 'var(--theme-colors-text)');
  const headingColor = colorOr(settings.heading_color, 'var(--theme-colors-text)');
  const linkColor = colorOr(settings.link_color, 'var(--theme-colors-muted)');

  if (columns.length === 0) {
    return (
      <div
        className="text-center py-10 px-4"
        style={{
          border: '1px dashed var(--theme-colors-border)',
          borderRadius: 'var(--theme-radius-md)',
          color: 'var(--theme-colors-muted)',
        }}
      >
        <p className="text-sm">
          {locale === 'ar'
            ? 'لا توجد أعمدة فوتر بعد. أضف عموداً من البيلدر.'
            : 'No footer columns yet. Add one from the builder.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: bg, color: fg }}>
      <div
        className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-12"
        style={{ maxWidth: 'var(--theme-container-max)' }}
      >
        <div
          className="grid gap-8"
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))` }}
        >
          {columns.map((col, i) => (
            <div key={i} className="space-y-3">
              {col.heading && (
                <h3
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: headingColor }}
                >
                  {col.heading}
                </h3>
              )}
              {col.links && col.links.length > 0 && (
                <ul className="space-y-2">
                  {col.links
                    .filter((l) => l.label)
                    .map((link, j) => (
                      <li key={j}>
                        <Link
                          href={link.url || '#'}
                          className="text-sm hover:opacity-70 transition-opacity"
                          style={{ color: linkColor }}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const footerColumnsSection: SectionDefinition = {
  schema: {
    id: 'footer-columns',
    label: { en: 'Footer Columns', ar: 'أعمدة الفوتر' },
    icon: 'columns',
    category: 'footer',
    description: {
      en: 'Responsive column-based link list. Auto-fits columns to the container width (160px min per column).',
      ar: 'قائمة روابط متعدّدة الأعمدة. تتكيّف الأعمدة مع عرض الحاوية تلقائياً (160px كحد أدنى لكل عمود).',
    },
    pageTypes: ['FOOTER'],
    translatable: ['columns'],
    schema: [
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'heading_color', type: 'color', label: { en: 'Column heading color', ar: 'لون عناوين الأعمدة' } },
      { key: 'link_color', type: 'color', label: { en: 'Link color', ar: 'لون الروابط' } },
      {
        key: 'columns',
        type: 'repeater',
        label: { en: 'Columns', ar: 'الأعمدة' },
        fields: [
          { key: 'heading', type: 'text', label: { en: 'Column heading', ar: 'عنوان العمود' } },
          { key: 'menu_key', type: 'menuPicker', label: { en: 'Menu (optional — overrides links below)', ar: 'القائمة (اختياري — تلغي الروابط أدناه)' } },
          {
            key: 'links',
            type: 'repeater',
            label: { en: 'Links (used when no menu key)', ar: 'الروابط (تُستخدم عند عدم وجود مفتاح قائمة)' },
            fields: [
              { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
              { key: 'url', type: 'url', label: { en: 'URL', ar: 'الرابط' } },
            ],
          },
        ],
      },
    ],
  },
  Component: FooterColumns,
  defaultSettings: {},
  defaultContent: {
    columns: [
      {
        heading: 'Shop',
        links: [
          { label: 'All products', url: '/products' },
          { label: 'New arrivals', url: '/products?sort=newest' },
        ],
      },
      {
        heading: 'Help',
        links: [
          { label: 'Contact', url: '/pages/contact' },
          { label: 'Shipping', url: '/pages/shipping' },
          { label: 'Returns', url: '/pages/returns' },
        ],
      },
      {
        heading: 'Company',
        links: [
          { label: 'About', url: '/pages/about' },
          { label: 'Terms', url: '/pages/terms' },
          { label: 'Privacy', url: '/pages/privacy' },
        ],
      },
    ],
  },
};
