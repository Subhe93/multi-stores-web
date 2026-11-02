import { getTranslations } from 'next-intl/server';
import { Eyebrow } from '@/components/marketing/ui/Eyebrow';
import { SplitReveal } from '@/components/marketing/ui/SplitReveal';
import { Reveal } from '@/components/marketing/ui/Reveal';
import { FeaturePreview, type FeatureKey } from './FeaturePreview';

// Honest status per feature: only the ones that exist today are "live".
const ITEMS: ReadonlyArray<{ key: FeatureKey; live: boolean }> = [
  { key: 'builder', live: true },
  { key: 'products', live: true },
  { key: 'orders', live: true },
  { key: 'payments', live: true },
  { key: 'markets', live: true },
  { key: 'domains', live: true },
  { key: 'analytics', live: false },
  { key: 'marketing', live: false },
];

/**
 * Editorial feature index: a two-column head (eyebrow + headline left, lead
 * right) and a numbered list of rows instead of cards. On fine pointers a
 * small preview card follows the cursor over the rows (FeaturePreview).
 */
export async function Features({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <section id="features" className="sd-section sd-section-white sd-features">
      <div className="sd-container">
        <div className="sd-features-head">
          <div className="sd-features-head-main">
            <Reveal y={16} duration={0.9}>
              <Eyebrow>{t('features.eyebrow')}</Eyebrow>
            </Reveal>
            <SplitReveal as="h2" className="sd-features-title" type="lines" locale={locale}>
              {t('features.title')}
            </SplitReveal>
          </div>
          <Reveal y={24} delay={0.15} className="sd-features-head-side">
            <p className="sd-features-lead">{t('features.lead')}</p>
            <p className="sd-features-count" dir="ltr" aria-hidden="true">
              {String(ITEMS.filter((i) => i.live).length).padStart(2, '0')} / {String(ITEMS.length).padStart(2, '0')}
            </p>
          </Reveal>
        </div>

        <FeaturePreview
          soonLabel={t('features.comingSoon')}
          liveLabel={t('features.live')}
          items={ITEMS.map(({ key, live }, i) => ({
            key,
            live,
            index: String(i + 1).padStart(2, '0'),
            title: t(`features.items.${key}.title`),
            desc: t(`features.items.${key}.desc`),
          }))}
        />
      </div>
    </section>
  );
}
