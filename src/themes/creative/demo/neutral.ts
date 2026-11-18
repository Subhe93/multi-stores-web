// Neutral placeholder content of the motion demo route: the same kinds of
// sections a store home uses, with generic copy (en + ar) and the neutral
// artwork in public/creative-demo/shared. Used when no external fixture is
// configured (see ./fixture.ts). Nothing here belongs to a client.

import type { DemoFixture, DemoSection } from './fixture';

const photo = (n: 1 | 2 | 3 | 4) => `/creative-demo/shared/photo-${n}.svg`;

const both = (en: Record<string, unknown>, ar: Record<string, unknown>): DemoSection['content'] => ({ en, ar });

const product = (n: number, en: string, ar: string, price: number): Record<string, unknown> => ({
  id: `demo-product-${n}`,
  base_price: price,
  status: 'PUBLISHED',
  track_inventory: false,
  stock_quantity: null,
  pricing_type: 'SINGLE',
  product_type: 'PHYSICAL',
  translations: [
    { locale: 'en', title: en, slug: `demo-product-${n}`, description: '<p>Placeholder product of the motion demo.</p>' },
    { locale: 'ar', title: ar, slug: `demo-product-${n}`, description: '<p>منتج تجريبي لصفحة عرض الحركة.</p>' },
  ],
  images: [
    { id: `demo-image-${n}`, url: photo((((n - 1) % 4) + 1) as 1 | 2 | 3 | 4), alt_text: en, sort_order: 0, is_featured: true },
  ],
  variants: [],
  attributes: [],
  promotions: [],
  vendor: null,
  _type: 'custom_product',
});

const PRODUCTS = [
  product(1, 'Linen overshirt', 'قميص كتان', 89),
  product(2, 'Ceramic cup', 'كوب خزفي', 24),
  product(3, 'Canvas tote', 'حقيبة قماشية', 32),
  product(4, 'Wool scarf', 'وشاح صوفي', 58),
  product(5, 'Brass ring', 'خاتم نحاسي', 41),
  product(6, 'Printed poster', 'ملصق مطبوع', 19),
  product(7, 'Leather belt', 'حزام جلدي', 64),
  product(8, 'Cotton cap', 'قبعة قطنية', 27),
];

const tiles = (labels: Array<[string, string]>) =>
  labels.map(([title, subtitle], i) => ({
    image: photo(((i % 4) + 1) as 1 | 2 | 3 | 4),
    title,
    subtitle,
    url: '/products',
  }));

export const NEUTRAL_FIXTURE: DemoFixture = {
  version: 1,
  name: 'Demo store',
  currency: 'EUR',
  primaryLocale: 'en',
  secondaryLocales: ['ar'],
  themeCustomizations: {},
  tax: null,
  pages: [],
  menus: [
    {
      id: 'demo-menu',
      key: 'header',
      name: 'Main menu',
      items: [
        { id: 'demo-menu-1', parent_id: null, label: 'Shop', label_i18n: { ar: 'تسوّق' }, url: '/products' },
        { id: 'demo-menu-2', parent_id: null, label: 'Collections', label_i18n: { ar: 'المجموعات' }, url: '/collections' },
        { id: 'demo-menu-3', parent_id: null, label: 'About', label_i18n: { ar: 'من نحن' }, url: '/about' },
      ],
    },
  ],
  header: [
    {
      section_key: 'announcement-bar',
      settings: { layout: 'simple', dismissible: false },
      content: both(
        { messages: [{ text: 'Free delivery on orders over 60' }] },
        { messages: [{ text: 'توصيل مجاني للطلبات فوق 60' }] },
      ),
    },
    {
      section_key: 'header-bar',
      settings: { show_logo: false, show_store_name: true, show_search: true, show_cart: true, show_locale: true, sticky_mode: 'always', menu_key: 'header' },
      content: {},
    },
  ],
  footer: [
    {
      section_key: 'copyright-bar',
      settings: { alignment: 'center', show_payment_icons: false },
      content: both({ text: '© {year} Demo store' }, { text: '© {year} متجر تجريبي' }),
    },
  ],
  home: [
    {
      section_key: 'hero-split',
      settings: { variant: 'bleed', image: photo(1), image_side: 'end', height: 'lg', image_width: 'half', tone: 'surface', cta_url: '/products', cta_secondary_url: '/about', cta_arrow: true },
      content: both(
        { heading: 'Made with care.\nMade to last.', subheading: 'A short introduction to the store, two lines at most, that says what it sells and why.', cta_text: 'Shop now', cta_secondary_text: 'Our story', alt: 'Placeholder artwork' },
        { heading: 'صُنع بعناية.\nليبقى طويلاً.', subheading: 'تعريف قصير بالمتجر في سطرين على الأكثر: ماذا يبيع ولماذا.', cta_text: 'تسوّق الآن', cta_secondary_text: 'قصتنا', alt: 'عمل فني تجريبي' },
      ),
    },
    {
      section_key: 'trust-badges',
      settings: { layout: 'strip', padding: 'compact' },
      content: both(
        { items: [{ icon: 'truck', label: 'Fast delivery', description: 'Sent within two days.' }, { icon: 'shield', label: 'Secure payment', description: 'Card and invoice.' }, { icon: 'gem', label: 'Chosen quality', description: 'Selected piece by piece.' }] },
        { items: [{ icon: 'truck', label: 'توصيل سريع', description: 'يُرسل خلال يومين.' }, { icon: 'shield', label: 'دفع آمن', description: 'بطاقة أو فاتورة.' }, { icon: 'gem', label: 'جودة مختارة', description: 'قطعة قطعة.' }] },
      ),
    },
    {
      section_key: 'category-tiles',
      settings: { card_style: 'caption', aspect: 'square', columns: 4, columns_tablet: 3, columns_mobile: 2, mobile_scroll: true, heading_align: 'center', heading_rule: true, show_arrow: true, card_surface: true, rounded: true },
      content: both(
        { heading: 'Explore the collections', items: tiles([['Clothing', 'Shirts and knitwear'], ['Home', 'Cups and textiles'], ['Accessories', 'Bags and belts'], ['Gifts', 'Small things']]) },
        { heading: 'استكشف المجموعات', items: tiles([['ملابس', 'قمصان ومنسوجات'], ['المنزل', 'أكواب وأقمشة'], ['إكسسوارات', 'حقائب وأحزمة'], ['هدايا', 'أشياء صغيرة']]) },
      ),
    },
    {
      section_key: 'featured-products',
      settings: { filter: 'newest', aspect: 'portrait', limit: 8, columns: 4, columns_tablet: 3, columns_mobile: 2, link_url: '/products' },
      content: both({ heading: 'New in', link_label: 'View all' }, { heading: 'وصل حديثاً', link_label: 'عرض الكل' }),
    },
    {
      section_key: 'progress-spotlight',
      settings: { layout: 'split', image: photo(3), image_side: 'start', tone: 'none', icon: 'graduation', status: 'active', goal: 100, reached: 64, show_progress: true, show_percent: true, cta_url: '/about', cta_arrow: true },
      content: both(
        { eyebrow: 'Our project', heading: 'A goal we share.', body: 'A paragraph about the project the store supports and how each order helps.', item_title: 'Project one', item_meta: 'This year', unit_label: 'units', cta_text: 'Read more', alt: 'Placeholder artwork' },
        { eyebrow: 'مشروعنا', heading: 'هدف نتشاركه.', body: 'فقرة عن المشروع الذي يدعمه المتجر وكيف يساهم كل طلب.', item_title: 'المشروع الأول', item_meta: 'هذا العام', unit_label: 'وحدة', cta_text: 'اقرأ المزيد', alt: 'عمل فني تجريبي' },
      ),
    },
    {
      section_key: 'image-with-text',
      settings: { image: photo(2), image_style: 'bleed', image_position: 'right', aspect: 'landscape', min_height: 'md', tone: 'surface', cta_url: '/about' },
      content: both(
        { heading: 'The story behind it.', body: 'A paragraph that tells where the products come from and what the store stands for.', cta_text: 'Our story', alt: 'Placeholder artwork' },
        { heading: 'القصة وراء المتجر.', body: 'فقرة تحكي من أين تأتي المنتجات وما الذي يمثّله المتجر.', cta_text: 'قصتنا', alt: 'عمل فني تجريبي' },
      ),
    },
  ],
  story: [
    {
      section_key: 'rich-text',
      settings: { width: 'normal', alignment: 'left', padding: 'medium', heading_level: 'h1' },
      content: both(
        { heading: 'About', html: '<p>A paragraph of body text for the story page.</p><p>A second paragraph, so the page has some length.</p>' },
        { heading: 'من نحن', html: '<p>فقرة نصية لصفحة القصة.</p><p>فقرة ثانية ليكون للصفحة طول.</p>' },
      ),
    },
  ],
  products: PRODUCTS,
  product: PRODUCTS[0],
};
