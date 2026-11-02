import { getTranslations } from 'next-intl/server';
import { Eyebrow } from '@/components/marketing/ui/Eyebrow';
import { Reveal } from '@/components/marketing/ui/Reveal';
import { SplitReveal } from '@/components/marketing/ui/SplitReveal';
import { HowTrack } from './HowTrack';
import { HowArt } from './HowArt';

const STEPS = ['s1', 's2', 's3'] as const;

// Navy stage with a horizontal track of three panels (pinned on wide screens,
// stacked below 1024px). Numerals are figures, not text: they stay LTR in
// every locale. The illustrations are inline SVG so they can be clip-revealed
// and drawn by the client track.
export async function HowItWorks({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home' });
  const total = String(STEPS.length).padStart(2, '0');

  return (
    <section id="how-it-works" className="sd-how">
      <HowTrack>
        <div className="sd-how-head sd-container">
          <div className="sd-how-head-main">
            <Reveal y={16} duration={0.9}>
              <Eyebrow tone="ivory">{t('how.eyebrow')}</Eyebrow>
            </Reveal>
            <SplitReveal as="h2" className="sd-h2 sd-how-title" type="lines" locale={locale}>
              {t('how.title')}
            </SplitReveal>
          </div>
          <Reveal y={24} delay={0.15} className="sd-how-head-side">
            <p className="sd-lead sd-how-lead">{t('how.lead')}</p>
          </Reveal>
        </div>

        <div className="sd-how-viewport">
          <ol className="sd-how-track">
            {STEPS.map((key, i) => {
              const n = String(i + 1).padStart(2, '0');
              return (
                <li key={key} className="sd-how-panel">
                  <span className="sd-how-num" dir="ltr" aria-hidden="true">
                    {n}
                  </span>
                  <div className="sd-how-panel-copy">
                    <span className="sd-how-step">
                      <span className="sd-how-step-label">{t('how.stepLabel')}</span>
                      <span dir="ltr">{n}</span>
                    </span>
                    <h3 className="sd-how-panel-title">{t(`how.steps.${key}.title`)}</h3>
                    <p className="sd-how-panel-desc">{t(`how.steps.${key}.desc`)}</p>
                  </div>
                  <div className="sd-how-figure">
                    <div className="sd-how-figure-inner">
                      <HowArt art={key} />
                      <span className="sd-how-caption" dir="auto">
                        <span className="sd-how-caption-dot" aria-hidden="true" />
                        {t(`how.steps.${key}.caption`)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="sd-how-foot sd-container" aria-hidden="true">
          <div className="sd-how-progress">
            <div className="sd-how-progress-fill" />
          </div>
          <div className="sd-how-counter" dir="ltr">
            <span className="sd-how-counter-now">01</span>
            <span className="sd-how-counter-total"> / {total}</span>
          </div>
        </div>
      </HowTrack>
    </section>
  );
}
