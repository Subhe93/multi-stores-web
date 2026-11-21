// Section "hero-dawn": a night sky turning into dawn. A sun (the built-in
// one, the owner's single emblem, or the owner's emblem layers) rises behind
// a far ridge, an arch photograph rises in front of it, an optional small
// photo card follows, the copy enters line by line and a light ridge in the
// colour of the next section closes the first screen.
//
// Intro: CSS only, behind the motion gate (css/heroDawn.css.ts). It holds
// its first frame until the arch photo has loaded (at most 2.5 s) and, when
// the hero starts below the first screen, until it is seen (DAWN_WAIT_SCRIPT).
// After hydration the `dawn` behaviour adds the WebGL dawn light (lazy,
// paused off screen, CSS gradients as the fallback) and the scroll layers
// through the engine's lazy GSAP ScrollTrigger. Without JavaScript, with
// reduced motion or in the builder the hero is at rest and complete.
//
// The first-screen height and the header overlap are measured by an inline
// script before the first paint (DAWN_SIZE_SCRIPT), so nothing shifts; a
// transparent store header is taken from --store-header-h.
//
// Every word, image and colour is a setting; the platform ships none.

import { useId, type CSSProperties, type ReactNode } from 'react';
import { StoreImage } from '@/components/StoreImage';
import type { SectionRenderProps } from '../../types';
import { Heading } from '../../minimal/sections/_shared/Heading';
import { headingTag } from '../../minimal/sections/_shared/headingLevel';
import { sectionHref } from '../../minimal/sections/_shared/links';
import { HERO_DAWN_CSS, hdTone } from '../css/heroDawn.css';
import { CxSection, EmptyState } from '../primitives';
import { defineCreativeSection } from '../schemas';
import { lightColorsAttr } from './dawnLight';
import { HD_GROUPS, HD_PREFIX, HD_TONES } from './dawnTones';
import { heroMedia, scriptOf, str, unoptimized } from './heroShared';
import { toneVars } from './tones';

const KEY = 'hero-dawn';

/**
 * First child of the root: the first-screen height (distance of the hero
 * from the top of the page: an announcement bar, a header in the flow) and
 * how much of a store header lies over the hero. Runs at parse time, again on
 * load and on width changes. A client-side render never runs it: the
 * behaviour then measures once.
 */
export const DAWN_SIZE_SCRIPT =
  "(function(){try{var s=document.currentScript,r=s&&s.parentElement,w=window,d=document,last=-1;if(!r)return;" +
  'function size(f){if(!r.isConnected){w.removeEventListener(\'resize\',on);return}if(!f&&w.innerWidth===last)return;last=w.innerWidth;' +
  "var rt=r.getBoundingClientRect().top+w.scrollY;if(rt>=0&&rt<260)r.style.setProperty('--cx-hd-top',Math.round(rt)+'px');" +
  "var hd=d.querySelector('#store-nav-header header')||d.querySelector('header');if(hd&&!r.contains(hd)){var hr=hd.getBoundingClientRect();" +
  "var hb=hr.bottom+(getComputedStyle(hd).position==='fixed'?0:w.scrollY),ov=Math.round(hb-rt);r.style.setProperty('--cx-hd-hdr',(ov>8&&ov<220?ov:0)+'px')}}" +
  "function on(){size(false)}size(true);w.addEventListener('resize',on);w.addEventListener('load',function(){size(true)},{once:true})}catch(e){}})()";

/**
 * Placed right after the arch photo: marks the root data-cx-wait (every
 * animation inside holds its first frame, behind the motion gate) until the
 * photo has loaded or failed (at most 2.5 s), and, when the hero starts below
 * the first screen, until it comes into view. Without the gate nothing is
 * marked and the hero is at rest.
 */
export const DAWN_WAIT_SCRIPT =
  "(function(){try{var s=document.currentScript,r=s&&s.closest('[data-cx-section]'),h=document.documentElement,n=0;" +
  "if(!r||!h.hasAttribute('data-cx-motion'))return;function go(){if(--n<=0)r.removeAttribute('data-cx-wait')}" +
  "var img=r.querySelector('.cx-hd-img img');if(img&&!img.complete){n++;var done=false,f=function(){if(done)return;done=true;go()};" +
  "img.addEventListener('load',f);img.addEventListener('error',f);setTimeout(f,2500)}" +
  "var v=window.innerHeight||h.clientHeight;if(typeof IntersectionObserver!=='undefined'&&r.getBoundingClientRect().top>=v*0.9){n++;" +
  "var io=new IntersectionObserver(function(es){for(var i=0;i<es.length;i++){if(es[i].isIntersecting){io.disconnect();go();return}}},{rootMargin:'0px 0px -18% 0px'});io.observe(r)}" +
  "if(n>0)r.setAttribute('data-cx-wait','')}catch(e){}})()";

// The far ridge, and the light ridge in its two states (same structure, so
// the scroll layer can morph one into the other without spikes).
const RIDGE_LINE =
  'M0 132C6.7 130.9 26.7 126.6 40 125.4C53.3 124.2 66.7 125.9 80 124.9C93.3 123.9 106.7 121.1 120 119.6C133.3 118 146.7 115.9 160 115.7C173.3 115.4 186.7 119.6 200 118.1C213.3 116.5 226.7 109 240 106.2C253.3 103.4 266.7 102.5 280 101.1C293.3 99.8 306.7 100.1 320 98.2C333.3 96.3 346.7 92.9 360 89.8C373.3 86.6 386.7 81.8 400 79.5C413.3 77.2 426.7 77.3 440 75.8C453.3 74.4 466.7 74.2 480 70.9C493.3 67.7 506.7 59.2 520 56.4C533.3 53.6 546.7 56.6 560 54C573.3 51.4 586.7 44.2 600 40.6C613.3 37.1 626.7 36.6 640 32.9C653.3 29.3 666.7 23.4 680 18.9C693.3 14.5 706.7 6.6 720 6.3C733.3 6 746.7 13.3 760 17.2C773.3 21 786.7 24.4 800 29.3C813.3 34.2 826.7 41.5 840 46.7C853.3 51.9 866.7 56.9 880 60.5C893.3 64.1 906.7 65.2 920 68.3C933.3 71.4 946.7 76.6 960 79.1C973.3 81.6 986.7 81 1000 83.1C1013.3 85.2 1026.7 91.1 1040 91.8C1053.3 92.6 1066.7 87.5 1080 87.6C1093.3 87.7 1106.7 90 1120 92.3C1133.3 94.7 1146.7 99.3 1160 101.6C1173.3 103.8 1186.7 105.6 1200 105.9C1213.3 106.2 1226.7 102 1240 103.3C1253.3 104.5 1266.7 110.3 1280 113.3C1293.3 116.4 1306.7 120.2 1320 121.5C1333.3 122.7 1346.7 120.7 1360 120.8C1373.3 120.8 1386.7 120.6 1400 121.8C1413.3 123 1433.3 127 1440 128';
const RIDGE_FILL = `${RIDGE_LINE}L1440 160L0 160Z`;
const DAY_REST =
  'M0 150C8 149 32 146 48 144C64 142 80 139.5 96 138.1C112 136.7 128 135.7 144 135.7C160 135.6 176 136.7 192 137.6C208 138.5 224 139.7 240 140.9C256 142.2 272 144 288 145.1C304 146.1 320 148.2 336 147.3C352 146.5 368 143.9 384 140.1C400 136.3 416 128.2 432 124.5C448 120.9 464 118 480 118.2C496 118.4 512 123.3 528 125.8C544 128.3 560 133.1 576 133.4C592 133.8 608 129.9 624 128C640 126 656 125.4 672 121.9C688 118.3 704 110.1 720 106.8C736 103.4 752 103.6 768 101.9C784 100.2 800 99.3 816 96.6C832 93.8 848 87.1 864 85.3C880 83.6 896 85.2 912 86.4C928 87.5 944 90.1 960 92.2C976 94.2 992 96.1 1008 98.6C1024 101.1 1040 103.7 1056 107.4C1072 111 1088 117.4 1104 120.7C1120 124 1136 126.7 1152 127.4C1168 128.1 1184 126.4 1200 124.7C1216 122.9 1232 118.9 1248 117C1264 115.2 1280 113.6 1296 113.7C1312 113.8 1328 114.8 1344 117.5C1360 120.1 1376 126.8 1392 129.5C1408 132.3 1432 133.3 1440 134L1440 200L0 200Z';
const DAY_RISE =
  'M0 120C8 118.4 32 113.5 48 110.4C64 107.2 80 103.1 96 100.9C112 98.7 128 97.2 144 97.1C160 96.9 176 98.8 192 100.2C208 101.5 224 103.5 240 105.4C256 107.4 272 110.4 288 112.1C304 113.8 320 117 336 115.7C352 114.4 368 110.2 384 104.1C400 98 416 85.1 432 79.3C448 73.4 464 68.8 480 69.2C496 69.5 512 77.2 528 81.3C544 85.3 560 92.9 576 93.5C592 94.1 608 87.8 624 84.8C640 81.7 656 80.6 672 75C688 69.3 704 56.1 720 50.8C736 45.5 752 45.8 768 43.1C784 40.3 800 38.9 816 34.5C832 30.1 848 19.3 864 16.6C880 13.8 896 16.4 912 18.2C928 20 944 24.2 960 27.5C976 30.7 992 33.7 1008 37.8C1024 41.8 1040 45.9 1056 51.8C1072 57.7 1088 67.8 1104 73.1C1120 78.4 1136 82.8 1152 83.8C1168 84.9 1184 82.2 1200 79.5C1216 76.7 1232 70.2 1248 67.3C1264 64.4 1280 61.8 1296 61.9C1312 62.1 1328 63.7 1344 67.9C1360 72.1 1376 82.8 1392 87.2C1408 91.6 1432 93.2 1440 94.4L1440 200L0 200Z';

// The built-in sun lives in a 500-unit square (290..790) centred on 540:
// the disc has radius 141 (28.2 % of the box), 24 tapered rays reach 226.
const SUN_BOX = '290 290 500 500';
const CENTER = 540;

function builtInRays(): string {
  const n = 24;
  const [r0, r1, w0, w1] = [146, 226, 4.2, 8.5];
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const at = (r: number, w: number) => `${(CENTER + c * r - s * w).toFixed(2)},${(CENTER + s * r + c * w).toFixed(2)}`;
    d += `M${at(r0, w0)}L${at(r1, w1)}L${at(r1, -w1)}L${at(r0, -w0)}Z`;
  }
  return d;
}
const RAYS_D = builtInRays();

function Arrow() {
  return (
    <svg className="cx-hd-arrow" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 5l5 5-5 5" />
    </svg>
  );
}

/** One sun layer from an owner image, filling its box (decorative). */
function Art({ src, sizes }: { src: string; sizes: string }) {
  return (
    <div className="cx-hd-art">
      <StoreImage src={src} alt="" fill sizes={sizes} unoptimized={unoptimized(src)} style={{ objectFit: 'contain' }} />
    </div>
  );
}

/** Gradient stop whose colour is a tone of the hero. */
const stop = (offset: string, tone: string) => <stop offset={offset} style={{ stopColor: hdTone(tone) }} />;

/** Text of a copy element, marked when it is Arabic. */
function Run({ className, text }: { className?: string; text: string }) {
  return (
    <span className={className} data-cx-script={scriptOf(text)}>
      {text}
    </span>
  );
}

function HeroDawn({ settings, content, locale, primaryLocale, pathPrefix, builderPreview, motion }: SectionRenderProps) {
  const headingId = useId();
  const uid = headingId.replace(/[^a-zA-Z0-9]/g, '');
  const line1 = str(content.heading_1);
  const line2 = str(content.heading_2);
  const arch = heroMedia(settings.arch_image);
  if (!line1 && !line2 && !arch) return builderPreview ? <EmptyState name={KEY} /> : null;

  const eyebrow = str(content.eyebrow);
  const text = str(content.text);
  const cta = str(content.cta_text);
  const secondary = str(content.cta_secondary_text);
  const cueText = str(content.cue_text);
  const cardImage = settings.card !== false ? heroMedia(settings.card_image) : '';
  const cue = settings.cue !== false && !!cueText;
  const light = settings.light !== false;
  const priority = motion !== 'scroll';

  // The sun: separate layers give the full motion; the single emblem rises
  // and opens as one piece; nothing set = the built-in sun.
  const whole = heroMedia(settings.emblem);
  const raysArt = heroMedia(settings.emblem_rays);
  const discArt = heroMedia(settings.emblem_disc);
  const frontArt = heroMedia(settings.emblem_front);
  const single = !!whole && !(raysArt || discArt || frontArt);
  const sunSizes = '(min-width: 900px) min(58vw, 870px), 89vw';

  let rays: ReactNode = null;
  if (!single) {
    rays = raysArt ? (
      <Art src={raysArt} sizes={sunSizes} />
    ) : (
      <svg className="cx-hd-art" viewBox={SUN_BOX} focusable="false">
        <defs>
          <linearGradient id={`${uid}r`} x1="0" y1="0" x2="0" y2="1">
            {stop('0', 'ray0')}
            {stop('.55', 'ray1')}
            {stop('1', 'ray2')}
          </linearGradient>
        </defs>
        <path fill={`url(#${uid}r)`} d={RAYS_D} />
      </svg>
    );
  }
  let disc: ReactNode;
  if (single) disc = <Art src={whole} sizes={sunSizes} />;
  else if (discArt) disc = <Art src={discArt} sizes={sunSizes} />;
  else
    disc = (
      <svg className="cx-hd-art" viewBox={SUN_BOX} focusable="false">
        <defs>
          <linearGradient id={`${uid}d`} x1="0" y1="0" x2="0" y2="1">
            {stop('0', 'halo')}
            {stop('.6', 'gold')}
            {stop('1', 'disc2')}
          </linearGradient>
        </defs>
        <circle cx={CENTER} cy={CENTER} r="141" fill={`url(#${uid}d)`} />
      </svg>
    );

  const style = toneVars(HD_PREFIX, HD_TONES, HD_GROUPS, settings) as CSSProperties;
  const headingText = `${line1} ${line2}`.trim();

  return (
    <CxSection
      name={KEY}
      css={HERO_DAWN_CSS}
      className="cx-hd"
      style={style}
      aria-labelledby={line1 || line2 ? headingId : undefined}
      data-cx-height={settings.height === 'compact' ? 'compact' : undefined}
      data-cx-light={light ? 'on' : undefined}
      data-cx-light-colors={light ? lightColorsAttr(settings) : undefined}
      data-cx-behavior="dawn"
    >
      <script dangerouslySetInnerHTML={{ __html: DAWN_SIZE_SCRIPT }} />
      <div className="cx-hd-sky" aria-hidden="true">
        <div className="cx-hd-glow" />
        <div className="cx-hd-warm" />
        <div className="cx-hd-scrim" />
        <div className="cx-hd-grain" />
      </div>

      <div className="cx-hd-vis">
        <div className="cx-hd-sunpar" aria-hidden="true">
          <div className="cx-hd-sun">
            <div className="cx-hd-halo" data-cx-loop="" />
            <div className="cx-hd-beams" />
            {rays ? (
              <div className="cx-hd-raysturn">
                <div className="cx-hd-spin" data-cx-loop="">
                  <div className="cx-hd-rays">{rays}</div>
                </div>
              </div>
            ) : null}
            <div className="cx-hd-disc" data-cx-disc="">
              {disc}
              {frontArt && !single ? (
                <div className="cx-hd-front">
                  <Art src={frontArt} sizes={sunSizes} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {arch ? (
          <div className="cx-hd-archpar">
            <div className="cx-hd-arch">
              <div className="cx-hd-archzoom">
                <div className="cx-hd-img">
                  <StoreImage
                    src={arch}
                    alt={str(content.arch_alt)}
                    fill
                    priority={priority}
                    sizes="(min-width: 900px) min(30vw, 450px), min(46vw, 220px)"
                    unoptimized={unoptimized(arch)}
                    style={{ objectFit: 'cover', objectPosition: '50% 16%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <script dangerouslySetInnerHTML={{ __html: DAWN_WAIT_SCRIPT }} />

        {cardImage ? (
          <div className="cx-hd-cardpar">
            <div className="cx-hd-card">
              <div className="cx-hd-cardclip">
                <div className="cx-hd-cardimg">
                  <StoreImage
                    src={cardImage}
                    alt={str(content.card_alt)}
                    fill
                    priority={priority}
                    sizes="(min-width: 900px) 180px, 102px"
                    unoptimized={unoptimized(cardImage)}
                    style={{ objectFit: 'cover', objectPosition: '50% 22%' }}
                  />
                </div>
                <span className="cx-hd-tone" aria-hidden="true" />
                <span className="cx-hd-sheen" aria-hidden="true" />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="cx-hd-ridgepar" aria-hidden="true">
        <div className="cx-hd-ridgewrap">
          <svg className="cx-hd-ridge" viewBox="0 0 1440 160" preserveAspectRatio="none" focusable="false">
            <path d={RIDGE_FILL} />
          </svg>
          <svg className="cx-hd-ridgeline" viewBox="0 0 1440 160" preserveAspectRatio="none" focusable="false">
            <path vectorEffect="non-scaling-stroke" d={RIDGE_LINE} />
          </svg>
        </div>
      </div>

      <div className="cx-hd-inner">
        <div className="cx-hd-copy">
          {eyebrow ? (
            <p className="cx-hd-eb">
              <span className="cx-hd-rule" aria-hidden="true" />
              <Run className="cx-hd-ebt" text={eyebrow} />
            </p>
          ) : null}
          {line1 || line2 ? (
            <Heading level={headingTag(settings.heading_level, 'h1')} id={headingId} className="cx-hd-title">
              <span className="cx-hd-ht" data-cx-script={scriptOf(headingText)}>
                {line1 ? (
                  <span className="cx-hd-line">
                    <span className="cx-hd-l1">{line1}</span>
                  </span>
                ) : null}
                {line1 && line2 ? ' ' : null}
                {line2 ? (
                  <span className="cx-hd-line cx-hd-line2">
                    <span className="cx-hd-l2">{line2}</span>
                  </span>
                ) : null}
              </span>
            </Heading>
          ) : null}
          {text ? (
            <p className="cx-hd-lead">
              <Run className="cx-hd-leadt" text={text} />
            </p>
          ) : null}
          {cta || secondary ? (
            <div className="cx-hd-actions">
              {cta ? (
                <a className="cx-hd-btn" href={sectionHref(settings.cta_url, { locale, primaryLocale, pathPrefix })}>
                  <span className="cx-hd-btnfill" aria-hidden="true" />
                  <span className="cx-hd-btntext">
                    <Run text={cta} />
                  </span>
                  <Arrow />
                </a>
              ) : null}
              {secondary ? (
                <a className="cx-hd-link" href={sectionHref(settings.cta_secondary_url, { locale, primaryLocale, pathPrefix })}>
                  <Run text={secondary} />
                  <Arrow />
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {cue ? (
        <div className="cx-hd-cue" aria-hidden="true">
          <span className="cx-hd-cueline">
            <span className="cx-hd-cuedot" data-cx-loop="" />
          </span>
          <Run className="cx-hd-cuet" text={cueText} />
        </div>
      ) : null}

      <div className="cx-hd-daypar" aria-hidden="true">
        <svg className="cx-hd-day" viewBox="0 0 1440 200" preserveAspectRatio="none" focusable="false">
          <path data-rise={DAY_RISE} d={DAY_REST} />
        </svg>
      </div>
    </CxSection>
  );
}

export const heroDawnSection = defineCreativeSection(KEY, HeroDawn);
