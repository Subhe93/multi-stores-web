import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { localePath } from '@/lib/locale-path';
import { SplitReveal } from '@/components/marketing/ui/SplitReveal';
import { MagneticButton } from '@/components/marketing/ui/MagneticButton';
import { ShaderBackdrop } from '@/components/marketing/ui/ShaderBackdrop';
import { Marquee } from '@/components/marketing/ui/Marquee';
import { HeroStage } from './HeroStage';

// Store categories that scroll in the bottom marquee: the "many stores".
const MARQUEE_KEYS = ['fashion', 'ceramics', 'coffee', 'jewellery', 'books', 'skincare', 'furniture', 'plants', 'vintage', 'bakeries', 'art', 'toys'] as const;
// The four factual statements of the retired trust strip, folded into the hero foot.
const FACT_KEYS = ['stripe', 'markets', 'eu', 'domains'] as const;

/**
 * Landing hero: ivory-silk shader under a soft scrim, a left-aligned display
 * headline (chars in LTR locales, words in Arabic) with the second line as an
 * outlined teal stroke, lead + two CTAs beside it, and a foot made of the four
 * trust facts plus a full-bleed marquee of store categories.
 */
export async function Hero({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <section id="hero" className="sd-hero">
      <ShaderBackdrop />
      <div className="sd-hero-scrim" aria-hidden="true" />
      <HeroStage scrollLabel={t('hero.scroll')}>
        <div className="sd-container sd-hero-inner">
          <div className="sd-hero-badge" data-reveal="block" data-hero-fade>
            <span className="sd-hero-badge-dot" aria-hidden="true" />
            <span>{t('hero.badge')}</span>
          </div>

          <div className="sd-hero-grid">
            <h1 className="sd-hero-title">
              <SplitReveal as="span" className="sd-hero-t1" type="chars" immediate locale={locale} delay={0.1}>
                {t('hero.title1')}
              </SplitReveal>
              <SplitReveal as="span" className="sd-hero-t2" type="words" immediate locale={locale} delay={0.75}>
                {t('hero.title2')}
              </SplitReveal>
            </h1>
            <div className="sd-hero-side">
              <p className="sd-hero-lead" data-reveal="block" data-hero-fade>
                {t('hero.lead')}
              </p>
              <div className="sd-hero-actions" data-reveal="block" data-hero-fade>
                <MagneticButton href={localePath('/auth/register', locale)} variant="primary">
                  {t('hero.ctaPrimary')}
                  <ArrowRight aria-hidden="true" />
                </MagneticButton>
                <MagneticButton href="#how-it-works" variant="ghost" className="sd-hero-ghost">
                  {t('hero.ctaSecondary')}
                  <ArrowRight aria-hidden="true" />
                </MagneticButton>
              </div>
            </div>
          </div>
        </div>

        <div className="sd-hero-foot" data-reveal="block" data-hero-fade>
          <div className="sd-container">
            <ul className="sd-hero-facts">
              {FACT_KEYS.map((key) => (
                <li key={key}>{t(`trust.${key}`)}</li>
              ))}
            </ul>
          </div>
          <Marquee
            className="sd-hero-marquee"
            duration={38}
            separator={<span className="sd-hero-marquee-dot" />}
            items={MARQUEE_KEYS.map((key) => t(`hero.marquee.${key}`))}
          />
        </div>
      </HeroStage>
    </section>
  );
}
