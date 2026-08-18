import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { localePath, buildPlatformAlternates } from '@/lib/locale-path';
import { HeroBackground } from '@/components/home/HeroBackground';
import { Reveal, Parallax, Magnetic, CountUp } from '@/components/home/ScrollAnimations';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

// The marketing homepage had no metadata of its own, so every locale served
// the root layout's hardcoded English title with no canonical and no hreflang.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  const alternates = buildPlatformAlternates('/', locale);
  const title = t('title');
  const description = t('subtitle');

  return {
    title,
    description,
    alternates,
    openGraph: { title, description, type: 'website', url: alternates.canonical },
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  const tc = await getTranslations({ locale, namespace: 'common' });

  return (
    <div className="min-h-screen overflow-x-hidden noise relative" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <MarketingHeader locale={locale} />

      {/* =================== HERO =================== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <HeroBackground />

        {/* Radial gradient overlay */}
        <div className="absolute inset-0" style={{ background: 'var(--gradient-overlay)', zIndex: 1 }} />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-24 pb-32">
          <Reveal animation="zoom-in" duration={600}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-10 backdrop-blur-sm" style={{ border: '1px solid var(--badge-border)', background: 'var(--badge-bg)', color: 'var(--badge-text)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              {t('badge')}
            </div>
          </Reveal>

          <Reveal animation="blur-in" duration={1200} delay={200}>
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-bold tracking-tight leading-[0.95] mb-8">
              <span style={{ color: 'var(--hero-text)' }}>{t('heroLine1')}</span>
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                {t('heroLine2')}
              </span>
            </h1>
          </Reveal>

          <Reveal animation="fade-up" delay={600}>
            <p className="text-lg md:text-xl max-w-xl mx-auto mb-14 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('subtitle')}
            </p>
          </Reveal>

          {/* CTA Buttons */}
          <Reveal animation="fade-up" delay={800}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Magnetic strength={0.12}>
                <Link
                  href={localePath('/auth/register?role=creator', locale)}
                  className="group relative inline-flex items-center gap-3 px-8 py-4 bg-violet-600 hover:bg-violet-500 rounded-full font-semibold transition-all duration-300 shadow-[0_0_40px_rgba(139,92,246,0.3)] hover:shadow-[0_0_60px_rgba(139,92,246,0.4)]"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
                  </svg>
                  {t('joinCreator')}
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </Magnetic>
              <Magnetic strength={0.12}>
                <Link
                  href={localePath('/auth/register?role=provider', locale)}
                  className="group inline-flex items-center gap-3 px-8 py-4 rounded-full font-semibold transition-all duration-300"
                  style={{ border: '1px solid var(--border-hover)', color: 'var(--text-secondary)' }}
                >
                  <svg className="w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                  <span>{t('joinProvider')}</span>
                </Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>

        {/* Scroll line */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--scroll-color)' }}>Scroll</span>
          <div className="w-px h-12 animate-pulse" style={{ background: 'linear-gradient(to bottom, var(--scroll-color), transparent)' }} />
        </div>
      </section>

      {/* =================== STATS =================== */}
      <section className="relative py-20" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="absolute inset-0 grid-pattern" />
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { end: 500, suffix: '+', label: 'Creators' },
              { end: 120, suffix: '+', label: 'Providers' },
              { end: 10000, suffix: '+', label: 'Products' },
              { end: 25, suffix: '+', label: 'Countries' },
            ].map((stat, i) => (
              <Reveal key={i} animation="fade-up" delay={i * 120}>
                <div className="text-center">
                  <div className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'var(--stat-gradient)' }}>
                    <CountUp end={stat.end} suffix={stat.suffix} />
                  </div>
                  <p className="text-sm mt-2 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* =================== HOW IT WORKS =================== */}
      <section className="py-32 relative">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal animation="fade-up">
            <p className="text-sm font-medium text-center uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--text-brand)' }}>{t('howItWorks')}</p>
          </Reveal>
          <Reveal animation="blur-in" delay={100}>
            <h2 className="text-3xl md:text-5xl font-bold text-center mb-6 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--stat-gradient)' }}>
              Three Steps to Launch
            </h2>
          </Reveal>
          <Reveal animation="fade-up" delay={200}>
            <p className="text-center max-w-xl mx-auto mb-20 text-lg" style={{ color: 'var(--text-secondary)' }}>
              {t('howItWorksDesc')}
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <Reveal animation="fade-up" delay={200}>
              <div className="group relative p-8 rounded-2xl border theme-card transition-all duration-500 hover:border-violet-500/20">
                {/* Glow on hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-violet-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <Parallax speed={0.08}>
                    <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6 group-hover:glow-violet transition-shadow duration-500">
                      <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                      </svg>
                    </div>
                  </Parallax>
                  <span className="text-xs font-bold text-violet-400/60 uppercase tracking-widest">Step 01</span>
                  <h3 className="font-bold text-xl mt-2 mb-3" style={{ color: 'var(--text-primary)' }}>{t('step1Title')}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('step1Desc')}</p>
                </div>
              </div>
            </Reveal>

            {/* Step 2 */}
            <Reveal animation="fade-up" delay={400}>
              <div className="group relative p-8 rounded-2xl border theme-card transition-all duration-500 hover:border-blue-500/20">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <Parallax speed={0.12}>
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:glow-blue transition-shadow duration-500">
                      <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
                      </svg>
                    </div>
                  </Parallax>
                  <span className="text-xs font-bold text-blue-400/60 uppercase tracking-widest">Step 02</span>
                  <h3 className="font-bold text-xl mt-2 mb-3" style={{ color: 'var(--text-primary)' }}>{t('step2Title')}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('step2Desc')}</p>
                </div>
              </div>
            </Reveal>

            {/* Step 3 */}
            <Reveal animation="fade-up" delay={600}>
              <div className="group relative p-8 rounded-2xl border theme-card transition-all duration-500 hover:border-indigo-500/20">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-indigo-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <Parallax speed={0.16}>
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6">
                      <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                      </svg>
                    </div>
                  </Parallax>
                  <span className="text-xs font-bold text-indigo-400/60 uppercase tracking-widest">Step 03</span>
                  <h3 className="font-bold text-xl mt-2 mb-3" style={{ color: 'var(--text-primary)' }}>{t('step3Title')}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('step3Desc')}</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* =================== FEATURES =================== */}
      <section className="py-32 relative" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/5 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-6">
          <Reveal animation="fade-up">
            <p className="text-sm font-medium text-center uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--text-brand)' }}>Features</p>
          </Reveal>
          <Reveal animation="blur-in" delay={100}>
            <h2 className="text-3xl md:text-5xl font-bold text-center mb-20 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--stat-gradient)' }}>
              {t('whyUs')}
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: IconStore, title: t('feat1Title'), desc: t('feat1Desc'), gradient: 'from-violet-500/10 to-violet-600/5', border: 'hover:border-violet-500/30', iconColor: 'text-violet-400' },
              { icon: IconDesign, title: t('feat2Title'), desc: t('feat2Desc'), gradient: 'from-blue-500/10 to-blue-600/5', border: 'hover:border-blue-500/30', iconColor: 'text-blue-400' },
              { icon: IconMoney, title: t('feat3Title'), desc: t('feat3Desc'), gradient: 'from-emerald-500/10 to-emerald-600/5', border: 'hover:border-emerald-500/30', iconColor: 'text-emerald-400' },
              { icon: IconGlobe, title: t('feat4Title'), desc: t('feat4Desc'), gradient: 'from-orange-500/10 to-orange-600/5', border: 'hover:border-orange-500/30', iconColor: 'text-orange-400' },
              { icon: IconPalette, title: t('feat5Title'), desc: t('feat5Desc'), gradient: 'from-pink-500/10 to-pink-600/5', border: 'hover:border-pink-500/30', iconColor: 'text-pink-400' },
              { icon: IconShield, title: t('feat6Title'), desc: t('feat6Desc'), gradient: 'from-indigo-500/10 to-indigo-600/5', border: 'hover:border-indigo-500/30', iconColor: 'text-indigo-400' },
            ].map((feat, i) => (
              <Reveal key={i} animation="fade-up" delay={i * 100}>
                <div className={`group relative p-6 rounded-2xl border theme-card ${feat.border} transition-all duration-500 hover:-translate-y-1`}>
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${feat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                      <feat.icon className={`w-6 h-6 ${feat.iconColor}`} />
                    </div>
                    <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{feat.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{feat.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* =================== CTA =================== */}
      <section className="py-32">
        <Reveal animation="zoom-in" duration={900}>
          <div className="max-w-4xl mx-auto px-6">
            <div className="relative overflow-hidden rounded-3xl border p-[1px]" style={{ borderColor: 'var(--cta-border)' }}>
              {/* Animated gradient border */}
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-blue-600 to-indigo-600 opacity-20" />

              <div className="relative rounded-3xl px-8 py-20 md:px-16 text-center overflow-hidden" style={{ background: 'var(--cta-bg)' }}>
                {/* Glowing orbs */}
                <div className="absolute -top-20 -right-20 w-80 h-80 bg-violet-600/10 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1.5s' }} />

                <div className="relative">
                  <Reveal animation="blur-in" delay={200}>
                    <h2 className="text-3xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                      {t('ctaTitle')}
                    </h2>
                  </Reveal>
                  <Reveal animation="fade-up" delay={400}>
                    <p className="max-w-lg mx-auto mb-12 text-lg" style={{ color: 'var(--text-secondary)' }}>
                      {t('ctaDesc')}
                    </p>
                  </Reveal>
                  <Reveal animation="fade-up" delay={600}>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Magnetic strength={0.1}>
                        <Link
                          href={localePath('/auth/register?role=creator', locale)}
                          className="px-10 py-4 font-semibold rounded-full transition-all duration-300 hover:scale-105"
                          style={{ background: 'var(--cta-btn-bg)', color: 'var(--cta-btn-text)' }}
                        >
                          {t('joinCreator')}
                        </Link>
                      </Magnetic>
                      <Magnetic strength={0.1}>
                        <Link
                          href={localePath('/auth/register?role=provider', locale)}
                          className="px-10 py-4 font-semibold rounded-full transition-all duration-300"
                          style={{ border: '1px solid var(--border-hover)', color: 'var(--text-secondary)' }}
                        >
                          {t('joinProvider')}
                        </Link>
                      </Magnetic>
                    </div>
                  </Reveal>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* =================== FOOTER =================== */}
      <MarketingFooter locale={locale} />
    </div>
  );
}

/* ============ Icon Components ============ */

function IconStore({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
    </svg>
  );
}

function IconDesign({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
    </svg>
  );
}

function IconMoney({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
    </svg>
  );
}

function IconGlobe({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9 9 0 0 1 3 12c0-1.47.353-2.856.978-4.08" />
    </svg>
  );
}

function IconPalette({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
    </svg>
  );
}

function IconShield({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}
