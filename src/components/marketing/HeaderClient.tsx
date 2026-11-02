'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ShopsDoorLogo } from '@/components/brand/ShopsDoorLogo';
import { gsap, useGSAP, EASE, onPageReveal } from '@/lib/animations';
import { LanguageMenu } from './LanguageMenu';

interface NavLink {
  id: string;
  label: string;
  href: string;
}

interface Props {
  locale: string;
  homeHref: string;
  links: NavLink[];
  loginHref: string;
  loginLabel: string;
  ctaHref: string;
  ctaLabel: string;
  menuLabel: string;
  closeLabel: string;
  languageLabel: string;
  solid: boolean;
}

/**
 * Fixed header: transparent over the hero, frosted ivory once the page
 * scrolls. Intro slides down after the page-reveal handshake.
 */
export function HeaderClient({ locale, homeHref, links, loginHref, loginLabel, ctaHref, ctaLabel, menuLabel, closeLabel, languageLabel, solid }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(solid);
  const [open, setOpen] = useState(false);
  const [overDark, setOverDark] = useState(false);

  // Scrolled state plus "over a dark section" detection: sample the element
  // under the header's midpoint and check whether it sits inside a navy
  // section, so the bar flips to a navy frosted look instead of greying out.
  useEffect(() => {
    const header = ref.current;
    let raf = 0;
    const probe = () => {
      raf = 0;
      if (!solid) setScrolled(window.scrollY > 24);
      if (!header) return;
      const prev = header.style.pointerEvents;
      header.style.pointerEvents = 'none';
      const el = document.elementFromPoint(window.innerWidth / 2, 60);
      header.style.pointerEvents = prev;
      setOverDark(!!el?.closest('.sd-door, .sd-how, .sd-section-dark, .sd-footer'));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(probe);
    };
    probe();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [solid]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [open]);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      gsap.set(el, { yPercent: -100, autoAlpha: 0 });
      return onPageReveal(() => {
        gsap.to(el, { yPercent: 0, autoAlpha: 1, duration: 1.1, ease: EASE.expo, delay: 0.2 });
      });
    },
    { scope: ref },
  );

  return (
    <header ref={ref} className={`sd-header ${scrolled || open ? 'is-solid' : ''} ${overDark && !open ? 'is-dark' : ''}`.replace(/\s+/g, ' ').trim()} data-reveal="block">
      <div className="sd-container sd-header-inner">
        <Link href={homeHref} className="sd-header-logo" aria-label="ShopsDoor">
          <ShopsDoorLogo size={30} variant={overDark && !open ? 'reversed' : 'color'} />
        </Link>
        <nav className="sd-header-nav" aria-label="Primary">
          {links.map((l) => (
            <a key={l.id} href={l.href} className="sd-link sd-header-link">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="sd-header-actions">
          <Link href={loginHref} className="sd-link sd-header-link sd-header-login">
            {loginLabel}
          </Link>
          <Link href={ctaHref} className="sd-btn sd-btn-primary sd-header-cta">
            <span className="sd-btn-label">{ctaLabel}</span>
          </Link>
          <button type="button" className="sd-header-burger" aria-expanded={open} aria-label={open ? closeLabel : menuLabel} onClick={() => setOpen((v) => !v)}>
            <span />
            <span />
          </button>
        </div>
      </div>
      <div className={`sd-header-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <nav aria-label="Mobile">
          {links.map((l) => (
            <a key={l.id} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link href={loginHref} onClick={() => setOpen(false)}>
            {loginLabel}
          </Link>
          <Link href={ctaHref} className="sd-btn sd-btn-primary" onClick={() => setOpen(false)}>
            <span className="sd-btn-label">{ctaLabel}</span>
          </Link>
        </nav>
      </div>
      <style jsx global>{`
        .sd-header { position: fixed; top: 0; inset-inline: 0; z-index: 90; transition: background-color .4s ease, box-shadow .4s ease, backdrop-filter .4s ease; }
        .sd-header.is-solid { background: rgba(247, 244, 236, 0.86); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 1px 0 rgba(20, 45, 54, 0.08); }
        .sd-header.is-dark.is-solid { background: rgba(14, 33, 41, 0.78); box-shadow: 0 1px 0 rgba(247, 244, 236, 0.1); }
        .sd-header.is-dark .sd-header-link, .sd-header.is-dark .sd-header-burger span { color: var(--sd-ivory); background-color: transparent; }
        .sd-header.is-dark .sd-header-burger span { background: var(--sd-ivory); }
        .sd-header-inner { height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .sd-header-logo { display: inline-flex; text-decoration: none; }
        .sd-header-nav { display: none; align-items: center; gap: 32px; }
        .sd-header-link { font-size: 0.93rem; font-weight: 500; color: var(--sd-navy); }
        .sd-header-actions { display: flex; align-items: center; gap: 18px; }
        .sd-lang { position: relative; }
        .sd-lang-btn { display: inline-flex; align-items: center; gap: 6px; background: transparent; border: 0; cursor: pointer; padding: 8px 6px; font: inherit; font-size: 0.85rem; font-weight: 600; letter-spacing: 0.02em; }
        .sd-lang-menu { position: absolute; top: calc(100% + 8px); inset-inline-end: 0; min-width: 160px; margin: 0; padding: 6px; list-style: none; background: var(--sd-ivory); border: 1px solid var(--sd-line); border-radius: 12px; box-shadow: 0 18px 40px -18px rgba(20, 45, 54, 0.35); z-index: 95; }
        .sd-lang-menu a { display: block; padding: 9px 12px; border-radius: 8px; font-size: 0.9rem; color: var(--sd-navy); text-decoration: none; }
        .sd-lang-menu a:hover { background: rgba(20, 45, 54, 0.06); }
        .sd-lang-menu a.is-active { font-weight: 700; color: var(--sd-teal-deep, #0F9484); }
        .sd-lang-drawer { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
        .sd-lang-drawer a { padding: 8px 14px; border: 1px solid var(--sd-line); border-radius: 999px; font-size: 0.9rem; color: var(--sd-navy); text-decoration: none; }
        .sd-lang-drawer a.is-active { background: var(--sd-navy); color: var(--sd-ivory); border-color: var(--sd-navy); }
        .sd-header-login { display: none; }
        .sd-header-cta { height: 44px; padding-inline: 20px; font-size: 0.9rem; display: none; }
        .sd-header-burger { width: 44px; height: 44px; display: inline-flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px; background: transparent; border: 0; cursor: pointer; }
        .sd-header-burger span { display: block; width: 22px; height: 2px; background: var(--sd-navy); border-radius: 2px; transition: transform .35s ease, opacity .35s ease; }
        .sd-header-burger[aria-expanded="true"] span:first-child { transform: translateY(4px) rotate(45deg); }
        .sd-header-burger[aria-expanded="true"] span:last-child { transform: translateY(-4px) rotate(-45deg); }
        .sd-header-drawer { position: fixed; inset: 72px 0 0 0; background: var(--sd-ivory); transform: translateY(-8px); opacity: 0; pointer-events: none; transition: opacity .35s ease, transform .35s ease; }
        .sd-header-drawer.is-open { opacity: 1; transform: none; pointer-events: auto; }
        .sd-header-drawer nav { display: flex; flex-direction: column; gap: 6px; padding: 24px 20px; }
        .sd-header-drawer nav > a { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; color: var(--sd-navy); text-decoration: none; padding: 12px 0; border-bottom: 1px solid var(--sd-line); }
        .sd-header-drawer nav > a.sd-btn { margin-top: 20px; border: 0; font-size: 1rem; }
        @media (min-width: 900px) {
          .sd-header-nav { display: flex; }
          .sd-header-login, .sd-header-cta { display: inline-flex; }
          .sd-header-burger, .sd-header-drawer { display: none; }
        }
      `}</style>
    </header>
  );
}
