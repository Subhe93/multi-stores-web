import { getTranslations } from 'next-intl/server';
import { CONTACT_EMAIL } from '@/lib/brand';
import { Eyebrow } from '@/components/marketing/ui/Eyebrow';
import { Reveal } from '@/components/marketing/ui/Reveal';
import { SplitReveal } from '@/components/marketing/ui/SplitReveal';
import { ContactForm } from './ContactForm';

// Contact: 5/7 split. Copy and the email as a giant link on the start side,
// the form inside a navy panel on the end side. The arrow next to the email is
// an inline SVG whose stroke draws on hover (CSS), mirrored in RTL.
export async function Contact({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <section id="contact" className="sd-section sd-section-white sd-contact">
      <div className="sd-container sd-contact-grid">
        <div className="sd-contact-copy">
          <Reveal y={16} duration={0.9}>
            <Eyebrow>{t('contact.eyebrow')}</Eyebrow>
          </Reveal>
          <SplitReveal as="h2" className="sd-h2 sd-contact-title" type="lines" locale={locale}>
            {t('contact.title')}
          </SplitReveal>
          <Reveal y={24} delay={0.1}>
            <p className="sd-lead sd-contact-lead">{t('contact.lead')}</p>
          </Reveal>
          <Reveal y={32} delay={0.2} className="sd-contact-direct">
            <span className="sd-contact-label">{t('contact.emailLabel')}</span>
            <a href={`mailto:${CONTACT_EMAIL}`} className="sd-contact-mail">
              <span className="sd-contact-mail-text" dir="ltr">
                {CONTACT_EMAIL.includes('@') ? (
                  <>
                    {CONTACT_EMAIL.slice(0, CONTACT_EMAIL.indexOf('@') + 1)}
                    <wbr />
                    {CONTACT_EMAIL.slice(CONTACT_EMAIL.indexOf('@') + 1)}
                  </>
                ) : (
                  CONTACT_EMAIL
                )}
              </span>
              <svg className="sd-contact-mail-arrow" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                <g className="sd-contact-arrow-ghost">
                  <path d="M6 24 H40" />
                  <path d="M26 10 L40 24 L26 38" />
                </g>
                <g className="sd-contact-arrow-ink">
                  <path className="sd-contact-arrow-line" d="M6 24 H40" pathLength="1" />
                  <path className="sd-contact-arrow-head" d="M26 10 L40 24 L26 38" pathLength="1" />
                </g>
              </svg>
            </a>
            <p className="sd-contact-company">{t('contact.companyLine')}</p>
          </Reveal>
        </div>

        <Reveal y={64} delay={0.1} className="sd-contact-panel">
          <div className="sd-contact-panel-glow" aria-hidden="true" />
          <div className="sd-contact-panel-head">
            <h3 className="sd-contact-panel-title">{t('contact.formTitle')}</h3>
            <p className="sd-contact-panel-hint">{t('contact.formHint')}</p>
          </div>
          <ContactForm
            labels={{
              name: t('contact.name'),
              email: t('contact.email'),
              message: t('contact.message'),
              send: t('contact.send'),
              sending: t('contact.sending'),
              sent: t('contact.sent'),
              error: t('contact.error'),
              notConfigured: t('contact.notConfigured'),
            }}
          />
        </Reveal>
      </div>
    </section>
  );
}
