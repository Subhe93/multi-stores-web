import { getTranslations } from 'next-intl/server';
import { Check, ArrowRight } from 'lucide-react';
import { SectionHead } from '@/components/marketing/ui/SectionHead';
import { Reveal } from '@/components/marketing/ui/Reveal';
import { MagneticButton } from '@/components/marketing/ui/MagneticButton';
import { PricingGhost } from './PricingGhost';

const POINTS = ['p1', 'p2', 'p3'] as const;

// Pricing is not published yet: a single glass card says so plainly in front
// of a huge outlined "EARLY ACCESS" and routes interested sellers to the
// contact form. No numbers anywhere.
export async function Pricing({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <section id="pricing" className="sd-section sd-pricing">
      <div className="sd-container">
        <SectionHead eyebrow={t('pricing.eyebrow')} title={t('pricing.title')} lead={t('pricing.lead')} locale={locale} />
      </div>
      <div className="sd-pricing-stage">
        <PricingGhost word={t('pricing.ghost')} />
        <div className="sd-container">
          <Reveal y={80} className="sd-pricing-wrap">
            <article className="sd-pricing-card">
              <div className="sd-pricing-main">
                <span className="sd-chip sd-chip-soon sd-pricing-badge">{t('pricing.badge')}</span>
                <h3 className="sd-pricing-plan">{t('pricing.planName')}</h3>
                <p className="sd-pricing-desc">{t('pricing.planDesc')}</p>
                <p className="sd-pricing-price">{t('pricing.price')}</p>
                <div className="sd-pricing-cta">
                  <MagneticButton href="#contact" variant="primary">
                    {t('pricing.cta')}
                    <ArrowRight aria-hidden="true" />
                  </MagneticButton>
                </div>
              </div>
              <div className="sd-pricing-side">
                <p className="sd-pricing-included">{t('pricing.included')}</p>
                <ul className="sd-pricing-points">
                  {POINTS.map((key) => (
                    <li key={key}>
                      <span className="sd-pricing-check" aria-hidden="true">
                        <Check strokeWidth={3} />
                      </span>
                      <span>{t(`pricing.points.${key}`)}</span>
                    </li>
                  ))}
                </ul>
                <p className="sd-pricing-note">{t('pricing.note')}</p>
              </div>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
