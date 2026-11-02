import { getTranslations } from 'next-intl/server';
import { Package, PenTool, Truck, Gift } from 'lucide-react';
import { Eyebrow } from '@/components/marketing/ui/Eyebrow';
import { Reveal } from '@/components/marketing/ui/Reveal';
import { SplitReveal } from '@/components/marketing/ui/SplitReveal';
import { Marquee } from '@/components/marketing/ui/Marquee';
import { SellShelf, SellArt, type SellKey } from './SellArt';

// The four product kinds the platform runs today. Digital products and
// services are deliberately absent: they are not supported yet.
const KINDS: ReadonlyArray<{ key: SellKey; Icon: typeof Package; tile?: 'amber' | 'navy' }> = [
  { key: 'own', Icon: Package },
  { key: 'custom', Icon: PenTool, tile: 'amber' },
  { key: 'supplier', Icon: Truck, tile: 'navy' },
  { key: 'bundle', Icon: Gift },
];

// Categories with live stores on the platform, split over two marquee rows.
const CATEGORIES = ['gifts', 'signs', 'apparel', 'wood', 'jewellery', 'nfc', 'shoes', 'tech'] as const;

/**
 * "What you can sell": a two-column head, a shelf of four product-kind cards
 * (horizontal scroll-snap row on phones) and two counter-running marquees of
 * category pills. Card reveals and illustration loops live in SellShelf.
 */
export async function Sell({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home' });
  const pills = CATEGORIES.map((key) => t(`sell.categories.${key}`));
  const rowA = pills.filter((_, i) => i % 2 === 0);
  const rowB = pills.filter((_, i) => i % 2 === 1);
  const pill = (label: string) => <span className="sd-sell-pill">{label}</span>;

  return (
    <section id="sell" className="sd-section sd-sell">
      <div className="sd-container">
        <div className="sd-sell-head">
          <div className="sd-sell-head-main">
            <Reveal y={16} duration={0.9}>
              <Eyebrow>{t('sell.eyebrow')}</Eyebrow>
            </Reveal>
            <SplitReveal as="h2" className="sd-h2 sd-sell-title" type="lines" locale={locale}>
              {t('sell.title')}
            </SplitReveal>
          </div>
          <Reveal y={24} delay={0.15} className="sd-sell-head-side">
            <p className="sd-lead sd-sell-lead">{t('sell.lead')}</p>
          </Reveal>
        </div>
      </div>

      <div className="sd-container sd-sell-shelf-wrap">
        <SellShelf>
          {KINDS.map(({ key, Icon, tile }) => (
            <li key={key} className="sd-card sd-sell-card" data-kind={key}>
              <div className="sd-sell-art">
                <SellArt art={key} />
              </div>
              <div className="sd-sell-body">
                <span className={`sd-icon-tile sd-sell-tile${tile ? ` sd-icon-tile-${tile}` : ''}`} aria-hidden="true">
                  <Icon size={22} strokeWidth={1.8} />
                </span>
                <h3 className="sd-sell-card-title">{t(`sell.cards.${key}.title`)}</h3>
                <p className="sd-sell-card-desc">{t(`sell.cards.${key}.desc`)}</p>
                <span className="sd-chip sd-chip-live sd-sell-chip">
                  <span className="sd-sell-chip-dot" aria-hidden="true" />
                  {t('sell.available')}
                </span>
              </div>
            </li>
          ))}
        </SellShelf>
      </div>

      <div className="sd-sell-categories">
        <div className="sd-container">
          <Reveal y={16} duration={0.9}>
            <p className="sd-sell-categories-label">{t('sell.categoriesLabel')}</p>
          </Reveal>
        </div>
        {/* Marquees are decorative (aria-hidden); the list below carries the same names for assistive tech. */}
        <ul className="sd-sr-only">
          {pills.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
        <Reveal y={20} delay={0.1} className="sd-sell-rows">
          <Marquee items={rowA.map(pill)} duration={34} separator="" className="sd-sell-marquee" />
          <Marquee items={rowB.map(pill)} duration={38} reverse separator="" className="sd-sell-marquee" />
        </Reveal>
      </div>
    </section>
  );
}
