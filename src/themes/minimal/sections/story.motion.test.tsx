import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSelectedLayoutSegment: () => null,
}));

import { SectionRenderer } from '../../SectionRenderer';
import type { SectionInstance, SectionRenderProps } from '../../types';
import { G, G_RTL } from '../../creative/css/base.css';
import { ORNAMENT_LINE_CSS } from '../../creative/css/ornamentLine.css';
import { STORY_CSS } from '../../creative/css/story.css';
import { minimalTheme } from '../theme';
import { AnimatedFeatures } from './AnimatedFeatures.client';
import { brandBandSection } from './BrandBand';
import { callToActionSection } from './CallToAction';
import { comparisonTableSection } from './ComparisonTable';
import { countdownSection } from './Countdown';
import { faqListSection } from './FaqList';
import { featureGridSection } from './FeatureGrid';
import { logoListSection } from './LogoList';
import { logoMarqueeSection } from './LogoMarquee';
import { marqueeTextSection } from './MarqueeText';
import { newsletterSignupSection } from './NewsletterSignup';
import { pricingTableSection } from './PricingTable';
import { progressSpotlightSection } from './ProgressSpotlight';
import { projectCardsSection } from './ProjectCards';
import { quoteBannerSection } from './QuoteBanner';
import { richTextSection } from './RichText';
import { socialIconsSection } from './SocialIcons';
import { statsBarSection } from './StatsBar';
import { stepsSection } from './Steps';
import { StickyCtaBar } from './StickyCtaBar.client';
import { teamGridSection } from './TeamGrid';
import { testimonialCarouselSection } from './TestimonialCarousel';
import { testimonialsSection } from './Testimonials';
import { timelineSection } from './Timeline';
import { trustBadgesSection } from './TrustBadges';
import { MotionGroup, MotionItem, MotionRise } from './_shared/MotionStagger';
import { ProgressBar } from './_shared/ProgressBar';

// Store motion style on the story and proof sections (contract S6): without
// the `motion` prop every section renders the markup it always had; with it
// the recipes appear, and the text never changes.

type Motion = SectionRenderProps['motion'];
type Component = ComponentType<SectionRenderProps>;

interface Case {
  name: string;
  C: Component;
  settings?: Record<string, unknown>;
  content: Record<string, unknown>;
  /** Attribute fragments expected with motion="scroll". */
  scroll: string[];
  /** The section has no entrance of its own (a fixed bar). */
  noEntrance?: boolean;
}

const IMG = '/uploads/pages/photo.jpg';
const THREE = [1, 2, 3];

const CASES: Case[] = [
  {
    name: 'rich-text',
    C: richTextSection.Component,
    content: { eyebrow: 'Our story', heading: 'A longer heading', html: '<p>First paragraph.</p><p>Second paragraph.</p>' },
    scroll: ['data-cx-reveal="words"', 'data-cx-reveal="rise"'],
  },
  {
    name: 'progress-spotlight',
    C: progressSpotlightSection.Component,
    settings: { ...progressSpotlightSection.defaultSettings, image: IMG, goal: 100, reached: 60, cta_url: '/impact' },
    content: {
      eyebrow: 'Our goal', heading: 'Follow our progress', body: 'Body copy.', item_title: 'A school', item_meta: 'North',
      unit_label: 'completed', cta_text: 'Learn more',
    },
    scroll: [
      'data-cx-reveal="mask"', 'data-cx-dir="start"', 'data-cx-reveal="words"', 'data-cx-reveal="rise"', 'data-cx-reveal="line"',
      'data-cx-hover="press"', 'data-cx-magnetic',
    ],
  },
  {
    name: 'project-cards',
    C: projectCardsSection.Component,
    settings: { ...projectCardsSection.defaultSettings, link_url: '/projects' },
    content: {
      heading: 'Our projects', subheading: 'Planned and done.', link_label: 'All projects',
      items: THREE.map((n) => ({ image: IMG, title: `Project ${n}`, description: 'Text.', url: `/p-${n}`, status: 'planned' })),
    },
    scroll: [
      'data-cx-reveal="stagger"', 'data-cx-item', 'data-cx-card', 'data-cx-hover="media"', 'data-cx-hover="lift"',
      'data-cx-hover="underline"', 'data-cx-reveal="words"',
    ],
  },
  {
    name: 'trust-badges (strip)',
    C: trustBadgesSection.Component,
    settings: { layout: 'strip' },
    content: { items: THREE.map((n) => ({ icon: 'truck', label: `Badge ${n}`, description: 'Text' })) },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item'],
  },
  {
    name: 'trust-badges (inline)',
    C: trustBadgesSection.Component,
    settings: { layout: 'inline' },
    content: { items: THREE.map((n) => ({ icon: 'truck', label: `Badge ${n}` })) },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item'],
  },
  {
    name: 'trust-badges (cards)',
    C: trustBadgesSection.Component,
    settings: { layout: 'cards' },
    content: { items: THREE.map((n) => ({ icon: 'truck', label: `Badge ${n}` })) },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item'],
  },
  {
    name: 'brand-band',
    C: brandBandSection.Component,
    settings: { image: IMG, logo: '/uploads/pages/mark.svg', cta_url: '/about' },
    content: { heading: 'The brand', tagline: 'A quiet line.', cta_text: 'Read more' },
    scroll: [
      'data-cx-behavior="scrub"', 'data-cx-y="-6"', 'data-cx-reveal="line"', 'data-cx-reveal="words"', 'data-cx-reveal="rise"',
      'data-cx-hover="press"', 'data-cx-magnetic',
    ],
  },
  {
    name: 'stats-bar',
    C: statsBarSection.Component,
    content: { heading: 'In numbers', items: THREE.map((n) => ({ value: `${n}20`, label: `Stat ${n}`, suffix: '+' })) },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item', 'data-cx-reveal="words"'],
  },
  {
    name: 'testimonials',
    C: testimonialsSection.Component,
    content: { heading: 'Voices', items: THREE.map((n) => ({ quote: `Quote ${n}`, author: `Author ${n}`, rating: 5 })) },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item', 'data-cx-reveal="words"'],
  },
  {
    name: 'testimonial-carousel',
    C: testimonialCarouselSection.Component,
    content: { heading: 'Voices', items: THREE.map((n) => ({ quote: `Quote ${n}`, author: `Author ${n}` })) },
    scroll: ['data-cx-reveal="rise"', 'data-cx-swap', 'data-cx-hover="press"', 'data-cx-reveal="words"'],
  },
  {
    name: 'faq-list',
    C: faqListSection.Component,
    content: { heading: 'Questions', subheading: 'Answers.', items: THREE.map((n) => ({ question: `Question ${n}`, answer: `Answer ${n}` })) },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item', 'data-cx-acc', 'data-cx-reveal="words"', 'data-cx-reveal="rise"'],
  },
  {
    name: 'newsletter-signup',
    C: newsletterSignupSection.Component,
    content: { heading: 'Stay close', subheading: 'One letter a month.' },
    scroll: ['data-cx-reveal="words"', 'data-cx-reveal="rise"', 'data-cx-hover="press"'],
  },
  {
    name: 'call-to-action (solid)',
    C: callToActionSection.Component,
    settings: { cta_url: '/shop' },
    content: { heading: 'Ready when you are', subheading: 'A line of text.', cta_text: 'Shop now' },
    scroll: ['data-cx-reveal="words"', 'data-cx-reveal="rise"', 'data-cx-hover="press"', 'data-cx-magnetic'],
  },
  {
    name: 'call-to-action (split)',
    C: callToActionSection.Component,
    settings: { style: 'split', image: IMG, cta_url: '/shop' },
    content: { heading: 'Ready when you are', subheading: 'A line of text.', cta_text: 'Shop now' },
    scroll: ['data-cx-reveal="mask"', 'data-cx-reveal="words"'],
  },
  {
    name: 'call-to-action (image)',
    C: callToActionSection.Component,
    settings: { style: 'image-bg', image: IMG, cta_url: '/shop' },
    content: { heading: 'Ready when you are', cta_text: 'Shop now' },
    scroll: ['data-cx-behavior="scrub"', 'data-cx-reveal="words"'],
  },
  {
    name: 'timeline',
    C: timelineSection.Component,
    content: { heading: 'Our path', items: THREE.map((n) => ({ label: `201${n}`, title: `Step ${n}`, description: 'Text.' })) },
    scroll: ['data-cx-rail', 'data-cx-reveal="line"', 'data-cx-reveal="stagger"', 'data-cx-item'],
  },
  {
    name: 'steps',
    C: stepsSection.Component,
    content: { heading: 'How it works', items: THREE.map((n) => ({ title: `Step ${n}`, description: 'Text.' })) },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item', 'data-cx-reveal="line"'],
  },
  {
    name: 'feature-grid',
    C: featureGridSection.Component,
    content: { heading: 'Why us', items: THREE.map((n) => ({ icon: 'truck', title: `Feature ${n}`, description: 'Text.' })) },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item'],
  },
  {
    name: 'team-grid',
    C: teamGridSection.Component,
    content: { heading: 'The team', members: THREE.map((n) => ({ name: `Person ${n}`, role: 'Role' })) },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item'],
  },
  {
    name: 'quote-banner',
    C: quoteBannerSection.Component,
    content: { quote: 'A calm sentence that says it all.', author: 'Someone', role: 'Founder' },
    scroll: ['data-cx-reveal="words"', 'data-cx-reveal="rise"'],
  },
  {
    name: 'logo-list',
    C: logoListSection.Component,
    content: { heading: 'As seen in', items: THREE.map((n) => ({ image: IMG, alt: `Logo ${n}` })) },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item', 'data-cx-reveal="rise"'],
  },
  {
    name: 'logo-marquee',
    C: logoMarqueeSection.Component,
    content: { heading: 'As seen in', items: THREE.map((n) => ({ image: IMG, alt: `Logo ${n}` })) },
    scroll: ['data-cx-loop', 'data-cx-reveal="rise"'],
  },
  {
    name: 'marquee-text',
    C: marqueeTextSection.Component,
    content: { text: 'A phrase' },
    scroll: ['data-cx-loop', 'data-cx-reveal="fade"'],
  },
  {
    name: 'pricing-table',
    C: pricingTableSection.Component,
    content: { heading: 'Plans', plans: THREE.map((n) => ({ name: `Plan ${n}`, price: `${n}9`, features: 'One\nTwo', cta_text: 'Choose', cta_url: '/plan' })) },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item', 'data-cx-hover="press"'],
  },
  {
    name: 'comparison-table',
    C: comparisonTableSection.Component,
    content: { heading: 'Compare', rows: THREE.map((n) => ({ feature: `Feature ${n}`, a: 'yes', b: 'no' })) },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item'],
  },
  {
    name: 'countdown',
    C: countdownSection.Component,
    settings: { end_date: '2999-01-01T00:00:00Z', target_date: '2999-01-01T00:00:00Z' },
    content: { heading: 'Soon', subheading: 'Not long now.' },
    scroll: ['data-cx-reveal="words"', 'data-cx-reveal="rise"'],
  },
  {
    name: 'animated-features',
    C: AnimatedFeatures as Component,
    content: { heading: 'Made well', subheading: 'Three reasons.', items: THREE.map((n) => ({ icon: 'check', title: `Reason ${n}` })) },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item', 'data-cx-reveal="words"'],
  },
  {
    name: 'sticky-cta-bar',
    C: StickyCtaBar as Component,
    settings: { cta_url: '/shop' },
    content: { text: 'Free shipping this week', cta_text: 'Shop' },
    scroll: ['data-cx-section="sticky-cta-bar"', 'data-cx-hover="press"'],
    noEntrance: true,
  },
  {
    name: 'social-icons',
    C: socialIconsSection.Component,
    content: {
      heading: 'Follow us', subheading: 'Wherever you are.',
      items: [{ platform: 'instagram', url: 'https://instagram.com/example' }, { platform: 'facebook', url: 'https://facebook.com/example' }],
    },
    scroll: ['data-cx-reveal="stagger"', 'data-cx-item', 'data-cx-reveal="words"'],
  },
];

function render(c: Case, motion?: Motion, extra: Partial<SectionRenderProps> = {}) {
  const { C } = c;
  return renderToStaticMarkup(
    <C
      locale="en"
      primaryLocale="en"
      storeSlug="demo"
      settings={c.settings ?? {}}
      content={c.content}
      builderPreview={false}
      {...(motion ? { motion } : null)}
      {...extra}
    />,
  );
}

const text = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el.textContent;
};

describe('story and proof sections with the store motion style', () => {
  describe.each(CASES)('$name', (c) => {
    it('without the motion prop the markup carries nothing of the engine', () => {
      const plain = render(c);
      expect(plain).not.toBe('');
      expect(plain).not.toContain('data-cx-');
      expect(plain).not.toMatch(/class="[^"]*\bcx-/);
      expect(plain).toBe(render(c, undefined, { motion: undefined }));
    });

    it('scroll: the recipes of the section are in the markup', () => {
      const html = render(c, 'scroll');
      for (const fragment of c.scroll) expect(html, fragment).toContain(fragment);
      expect(html).not.toContain('data-cx-intro');
      // The legacy entrance never runs beside the engine.
      expect(html).not.toMatch(/data-stagger-|data-reveal=/);
    });

    it('intro: the same elements use the load-time variants, nothing waits for the scroll', () => {
      const html = render(c, 'intro');
      expect(html).not.toContain('data-cx-reveal');
      if (!c.noEntrance) expect(html).toContain('data-cx-intro');
    });

    it('the text is the same with and without motion', () => {
      const plain = text(render(c));
      expect(text(render(c, 'scroll'))).toBe(plain);
      expect(text(render(c, 'intro'))).toBe(plain);
    });
  });

  it('a grid without motion keeps the legacy stagger wrappers', () => {
    const c = CASES.find((x) => x.name === 'project-cards')!;
    const plain = render(c);
    expect(plain).toContain('data-stagger-group=""');
    expect(plain.match(/data-stagger-item=""/g)?.length).toBe(3);
    // The link zoom of today stays without the switch and is replaced with it.
    expect(plain).toContain('motion-safe:group-hover:scale-[1.03]');
    expect(render(c, 'scroll')).not.toContain('group-hover:scale-[1.03]');
  });

  it('the shared wrappers return the old elements or the recipe elements', () => {
    const group = (m?: Motion) =>
      renderToStaticMarkup(
        <MotionGroup motion={m} className="grid">
          <MotionItem motion={m} index={2} className="h-full">
            x
          </MotionItem>
        </MotionGroup>,
      );
    expect(group()).toBe('<div class="grid" data-stagger-group=""><div class="h-full" data-stagger-item="">x</div></div>');
    expect(group('scroll')).toBe('<div class="grid" data-cx-reveal="stagger"><div class="h-full" data-cx-item="">x</div></div>');
    expect(group('intro')).toBe('<div class="grid"><div class="h-full" data-cx-intro="rise" data-cx-i="2">x</div></div>');
    expect(renderToStaticMarkup(<MotionRise motion={undefined}><b>x</b></MotionRise>)).toBe('<b>x</b>');
    expect(renderToStaticMarkup(<MotionRise motion="scroll" i={3}><b>x</b></MotionRise>)).toBe(
      '<div data-cx-reveal="rise" data-cx-i="3"><b>x</b></div>',
    );
  });

  describe('progress bar', () => {
    const bar = (m?: Motion) =>
      renderToStaticMarkup(<ProgressBar percent={60} text="60 of 100" label="Goal" barColor="red" motion={m} />);

    it('keeps the real width and the spoken value while the fill draws', () => {
      expect(bar()).not.toContain('data-cx-');
      const html = bar('scroll');
      expect(html).toContain('aria-valuenow="60"');
      expect(html).toContain('aria-valuetext="60 of 100"');
      expect(html).toMatch(/style="width:60%;background:red" data-cx-reveal="line"/);
    });

    it('the percentage keeps its text and reserves its width while it counts', () => {
      const c = CASES.find((x) => x.name === 'progress-spotlight')!;
      const html = render(c, 'scroll');
      expect(text(html)).toContain('60%');
      expect(html).toContain('min-inline-size:calc(3ch + 0.4em)');
      expect(html.match(/data-cx-reveal="line"/g)?.length).toBe(1);
    });
  });

  it('project cards: only linked cards answer the pointer, plain cards never lift', () => {
    const c = CASES.find((x) => x.name === 'project-cards')!;
    const unlinked = { ...c, content: { ...c.content, items: [{ image: IMG, title: 'Still' }] } };
    expect(render(unlinked, 'scroll')).not.toMatch(/data-cx-card|data-cx-hover="(media|lift)"/);
    const plainStyle = { ...c, settings: { ...c.settings, card_style: 'plain' } };
    const html = render(plainStyle, 'scroll');
    expect(html).toContain('data-cx-hover="media"');
    expect(html).not.toContain('data-cx-hover="lift"');
  });

  it('rich text: the body is one block, never split per paragraph', () => {
    const c = CASES.find((x) => x.name === 'rich-text')!;
    const html = render(c, 'scroll');
    expect(html.match(/data-cx-reveal="rise"/g)?.length).toBe(2); // eyebrow + body
    expect(html).toContain('<p>First paragraph.</p><p>Second paragraph.</p>');
  });

  it('newsletter: the submit button is pressed, never magnetic', () => {
    const c = CASES.find((x) => x.name === 'newsletter-signup')!;
    expect(render(c, 'scroll')).not.toContain('data-cx-magnetic');
  });

  it('Arabic headings are split into words only', () => {
    const c = CASES.find((x) => x.name === 'quote-banner')!;
    const html = render({ ...c, content: { quote: 'كل عملية شراء فرصة' } }, 'scroll', { locale: 'ar' });
    expect(html.match(/class="cx-wi"/g)?.length).toBe(4);
    expect(text(html)).toContain('كل عملية شراء فرصة');
  });

  describe('through the section renderer', () => {
    const section = (id: string, key: string, settings: Record<string, unknown>, content: Record<string, unknown>): SectionInstance => ({
      id,
      section_key: key,
      settings,
      sort_order: Number(id.replace(/\D/g, '')),
      translations: [{ locale: 'en', content }],
    });
    const stats = { heading: 'In numbers', items: THREE.map((n) => ({ value: `${n}20`, label: `Stat ${n}` })) };
    const PAGE = [
      section('s1', 'rich-text', {}, { heading: 'First', html: '<p>Body</p>' }),
      section('s2', 'stats-bar', {}, stats),
      section('s3', 'stats-bar', { _style: { motion: 'none' } }, stats),
    ];
    const page = (motion: boolean) =>
      renderToStaticMarkup(
        <SectionRenderer theme={minimalTheme} sections={PAGE} locale="en" primaryLocale="en" storeSlug="demo" motion={motion} />,
      );
    const part = (html: string, id: string) => html.split(`data-section-id="${id}"`)[1].split('data-section-id="')[0];

    it('the store switch off: no engine markup at all', () => {
      expect(page(false)).not.toContain('data-cx-');
    });

    it('the first section plays on load, the next on scroll, and "_style.motion: none" stays as it was', () => {
      const on = page(true);
      expect(part(on, 's1')).toContain('data-cx-intro="words"');
      expect(part(on, 's1')).not.toContain('data-cx-reveal');
      expect(part(on, 's2')).toContain('data-cx-reveal="stagger"');
      expect(part(on, 's3')).not.toContain('data-cx-');
      expect(part(on, 's3')).toContain('data-stagger-group');
    });
  });

  describe('stylesheets', () => {
    const rules = (css: string) => css.split('}').map((r) => r.trim()).filter(Boolean);

    it('every rule of the story slot sits behind the gate', () => {
      const body = STORY_CSS.replace(/@media[^{]+\{/g, '').replace(/@keyframes[^{]+\{from\{[^}]+\}to\{[^}]+\}\}/g, '');
      for (const rule of rules(body)) {
        const selectors = rule.split('{')[0].split(/,(?![^(]*\))/);
        for (const selector of selectors) {
          expect(selector.startsWith(G) || selector.startsWith(G_RTL), selector).toBe(true);
        }
      }
    });

    it('hover rules need a fine pointer', () => {
      const hoverOutside = STORY_CSS.replace(/@media \(hover:hover\) and \(pointer:fine\)\{.*?\}\}/g, '');
      expect(hoverOutside).not.toContain(':hover');
    });

    it('the ornament divider draws once over 1.6 s on the in-out ease and slower under the calm profile', () => {
      expect(ORNAMENT_LINE_CSS).toContain('--cx-ol-dur:1.6s');
      expect(ORNAMENT_LINE_CSS).toContain('.store-root[data-motion-reveal="calm"] .cx-ol{--cx-ol-dur:2.1s}');
      expect(ORNAMENT_LINE_CSS).toMatch(/stroke-dashoffset var\(--cx-ol-dur,1\.6s\) var\(--cx-ease-io/);
      // The hidden start state exists only behind the gate and the behaviour's marker.
      const hidden = rules(ORNAMENT_LINE_CSS).filter((r) => r.includes('stroke-dashoffset:1') && !r.includes('@media print'));
      expect(hidden.length).toBe(1);
      expect(hidden[0].startsWith(`${G} [data-cx-draw="once"][data-cx-armed]`)).toBe(true);
      // Only the divider is left: no framed panel rules.
      expect(ORNAMENT_LINE_CSS).not.toMatch(/cx-ol-(frame|corner|rail|ft|deco|cta)/);
    });
  });
});
