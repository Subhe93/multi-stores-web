'use client';

// `product-stories` block (customer-stories contract section 7): the
// product's customer stories as a slider (VICE-style portrait cards), a grid,
// or cards with the text over the media (stars + name + verified + quote).
//
// Text safety: name, subtitle and quote are untrusted plain text. They are
// rendered only as React text children / attribute values; quote newlines
// use `white-space: pre-line`. No JSON-LD (contract S9).
//
// Video stories reuse the product video components: before Play only a
// lazy poster and a Play button exist (no <video>/<iframe> in SSR); Play
// mounts ProductVideoSlide, whose player chunk loads after that click and
// which applies the YouTube / Vimeo consent rule. One video plays at a time:
// starting another unmounts the previous player. Overlay text hides only
// while a video actually plays (or the consent notice occupies the card);
// it returns on pause, and a video that ends goes back to its poster.
//
// Muted autoplay (CONTRACT-AUTOPLAY 6.7): a video story with `autoplay`
// keeps today's markup until hydration; then, unless the visitor prefers
// reduced motion / saves data, or it is a YouTube / Vimeo story without the
// external-media consent, the shared slide mounts over the lazy poster and
// autoplays muted while it is the page's most visible autoplay video (one at
// a time page-wide; the slider never auto-advances). The overlay text stays
// during muted autoplay; a tap switches to the full player with sound
// through the same activeId flow. YouTube / Vimeo stories use the compact
// two-click facade of the shared slide.
//
// Known reuse cost: once Play is clicked the shared ProductVideoSlide draws
// its own poster (duration chip at bottom-end, alt = name as contract 7.1
// requires, since the same alt names the <video> / iframe). The story Play
// button uses the shared poster's look so the hand-off does not jump.

import {
  createElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { BadgeCheck, ChevronLeft, ChevronRight, Play, Star } from 'lucide-react';
import { StoreImage } from '@/components/StoreImage';
import { useOptionalProductPageState } from '@/components/product/state/ProductPageState';
import { isSvgSrc } from '@/lib/storeMedia';
import { subscribeConsent } from '@/lib/consent';
import { embedAllowed, formatVideoDuration } from '@/lib/productVideo';
import { useAutoplayBlocked } from '@/lib/videoAutoplay';
import {
  MOBILE_PEEK,
  readStoriesSettings,
  storySizes,
  toStoryCards,
  type StoriesAspect,
  type StoriesSettings,
  type StoryCard,
} from '@/lib/productStories';
import type { SectionRenderProps } from '../../../../types';
import { blockLabel, ProductBlockPlaceholder, ProductBlockScope } from './b2Shared';
import { headingText } from './b3Shared';
import { headingTag } from '../../_shared/headingLevel';

// The shared video slide (and, inside it, the player chunk) is requested
// only after a Play click, or after hydration for an autoplay story, so a
// product without story videos, or a visitor who never clicks, downloads no
// video code. The lazy poster stays underneath while it loads.
const ProductVideoSlide = dynamic(
  () => import('@/components/product/video/ProductVideoSlide').then((m) => m.ProductVideoSlide),
  { ssr: false, loading: () => null },
);

const ASPECT_CLASS: Record<StoriesAspect, string> = {
  portrait: 'aspect-[9/16]',
  square: 'aspect-square',
  landscape: 'aspect-video',
};

// Overlay quote clamp per card shape (at most 6 lines, contract 7.3): shorter
// boxes get fewer lines so stars, quote and name fit without being clipped.
const OVERLAY_CLAMP: Record<StoriesAspect, string> = {
  portrait: 'line-clamp-6',
  square: 'line-clamp-4',
  landscape: 'line-clamp-3',
};

// Literal class names per column count so Tailwind generates them.
const GRID_COLS_MOBILE: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2' };
const GRID_COLS_TABLET: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};
const GRID_COLS_DESKTOP: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
};

/** Slider card width per breakpoint: `cols` cards and `cols - 1` 1rem gaps per row. */
function sliderBasis(cols: number): string {
  const gaps = Math.max(Math.ceil(cols) - 1, 0);
  return `calc((100% - ${gaps}rem) / ${Number(cols.toFixed(2))})`;
}

export function ProductStoriesBlock({
  settings,
  content,
  locale,
  primaryLocale,
  storeSlug,
  product,
  builderPreview,
}: SectionRenderProps) {
  const t = useTranslations();
  const state = useOptionalProductPageState();
  const baseId = useId();
  const lang = state?.locale ?? locale;
  const primary = state?.primaryLocale ?? primaryLocale ?? lang;
  const stories = state?.product.stories;
  const cards = useMemo(() => toStoryCards(stories, lang, primary), [stories, lang, primary]);
  const s = readStoriesSettings(settings);
  // activeId: the card whose shared slide is mounted (one at a time).
  // playingId: the card whose video is actually playing.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const setPlaying = useCallback((id: string, playing: boolean) => {
    setPlayingId((cur) => (playing ? id : cur === id ? null : cur));
  }, []);
  const close = useCallback((id: string) => {
    setActiveId((cur) => (cur === id ? null : cur));
    setPlayingId((cur) => (cur === id ? null : cur));
  }, []);

  if (!state || cards.length === 0) {
    return (
      <ProductBlockPlaceholder
        builderPreview={builderPreview ?? !product}
        label={blockLabel(locale, 'Customer stories', 'قصص العملاء')}
        hint={state ? blockLabel(locale, 'This product has no customer stories.', 'لا توجد قصص عملاء لهذا المنتج.') : undefined}
      />
    );
  }

  const headingId = `${baseId}-heading`;
  const heading = headingText(content, 'heading', t('product.storiesHeading'));
  const subheading = typeof content?.subheading === 'string' ? content.subheading.trim() : '';
  const slug = state.storeSlug || storeSlug || '';

  // Tags follow the builder's SEO selects (heading_level / subheading_tag).
  const header = s.showHeading ? (
    <div className="min-w-0">
      {createElement(
        headingTag(settings?.heading_level, 'h2'),
        {
          id: headingId,
          className: 'text-xl font-semibold text-gray-900 wrap-break-word',
          'data-product-block-heading': '',
        },
        heading,
      )}
      {subheading &&
        createElement(
          headingTag(settings?.subheading_tag, 'p'),
          { className: 'mt-1 text-sm text-gray-600 wrap-break-word' },
          subheading,
        )}
    </div>
  ) : null;

  const cardProps: CardSharedProps = {
    settings: s,
    storeSlug: slug,
    activeId,
    playingId,
    onPlay: setActiveId,
    onPlayingChange: setPlaying,
    onClose: close,
  };
  const labelAttrs = s.showHeading ? { 'aria-labelledby': headingId } : { 'aria-label': heading };

  return (
    <ProductBlockScope>
      <section data-product-stories="" data-layout={s.layout} {...labelAttrs}>
        {s.layout === 'slider' ? (
          <StoriesSlider cards={cards} header={header} labelAttrs={labelAttrs} {...cardProps} />
        ) : (
          <>
            {header && <div className="mb-4">{header}</div>}
            <ul
              role="list"
              className={`grid gap-4 ${GRID_COLS_MOBILE[s.columnsMobile]} ${GRID_COLS_TABLET[s.columnsTablet]} ${GRID_COLS_DESKTOP[s.columns]}`}
            >
              {cards.map((card) => (
                <li key={card.id} className="min-w-0">
                  <StoryCardView card={card} sizes={storySizes(s, false)} {...cardProps} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </ProductBlockScope>
  );
}

interface CardSharedProps {
  settings: StoriesSettings;
  storeSlug: string;
  activeId: string | null;
  playingId: string | null;
  onPlay(id: string): void;
  onPlayingChange(id: string, playing: boolean): void;
  onClose(id: string): void;
}

type LabelAttrs = { 'aria-labelledby': string } | { 'aria-label': string };

const noopSubscribe = () => () => {};
/** Autoplay toggles sit top-start: the duration chip is top-end. */
const STORY_CONTROLS = 'top-2 start-2';

/**
 * Breakpoint classes of the prev / next buttons. Card widths are exact
 * fractions of the row, so whether the row overflows at md / lg is known
 * from the counts alone: the buttons render from the first paint where
 * needed (no layout shift after hydration) and never where all cards fit.
 * Mobile has no buttons (native swipe).
 */
function navVisibility(count: number, s: StoriesSettings): { md: boolean; lg: boolean; className: string } {
  const md = count > s.columnsTablet;
  const lg = count > s.columns;
  const cls = ['hidden'];
  if (md) cls.push('md:flex');
  if (lg && !md) cls.push('lg:flex');
  if (!lg && md) cls.push('lg:hidden');
  return { md, lg, className: cls.join(' ') };
}

function StoriesSlider({
  cards,
  header,
  labelAttrs,
  settings: s,
  ...rest
}: CardSharedProps & { cards: StoryCard[]; header: ReactNode; labelAttrs: LabelAttrs }) {
  const t = useTranslations();
  const scroller = useRef<HTMLDivElement>(null);
  // Before measuring, the row is at its start: next enabled, prev disabled.
  const [nav, setNav] = useState({ prev: false, next: true, scrollable: false });
  const peek = cards.length > s.columnsMobile;
  const vis = navVisibility(cards.length, s);

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    // scrollLeft is 0..max in LTR and 0..-max in RTL: compare magnitudes.
    const pos = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    const next = { prev: pos > 1, next: max - pos > 1, scrollable: max > 1 };
    setNav((cur) =>
      cur.prev === next.prev && cur.next === next.next && cur.scrollable === next.scrollable ? cur : next,
    );
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [update, cards.length, s.columns, s.columnsTablet, s.columnsMobile]);

  // Prev / next move one page towards the start / end of the row; in RTL
  // the end of the row is on the left (negative scroll direction).
  const go = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    const rtl = typeof window !== 'undefined' && window.getComputedStyle(el).direction === 'rtl';
    const step = Math.max(el.clientWidth * 0.9, 1);
    el.scrollBy({ left: dir * step * (rtl ? -1 : 1), behavior: 'smooth' });
  };

  const style = {
    ['--story-basis' as string]: sliderBasis(peek ? s.columnsMobile + MOBILE_PEEK : s.columnsMobile),
    ['--story-basis-md' as string]: sliderBasis(s.columnsTablet),
    ['--story-basis-lg' as string]: sliderBasis(s.columns),
  } as CSSProperties;
  const hasNav = vis.md || vis.lg;
  const navButton =
    'flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900';

  return (
    <>
      {(header || hasNav) && (
        // Without a heading the row exists only where the buttons show.
        <div className={`mb-4 items-end justify-between gap-4 ${header ? 'flex' : vis.className}`}>
          {header ?? <span />}
          {hasNav && (
            <div className={`shrink-0 gap-2 ${vis.className}`} data-stories-nav="">
              <button
                type="button"
                className={navButton}
                aria-label={t('product.storiesPrevious')}
                disabled={!nav.prev}
                onClick={() => go(-1)}
              >
                {/* Chevrons point along the reading direction (mirrored in RTL). */}
                <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={navButton}
                aria-label={t('product.storiesNext')}
                disabled={!nav.next}
                onClick={() => go(1)}
              >
                <ChevronRight className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
      <div
        ref={scroller}
        className="overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
        // A named, focusable region only when it scrolls, so keyboard users
        // can move the row with the arrow keys (no empty tab stop otherwise).
        {...(nav.scrollable ? { tabIndex: 0, role: 'region', ...labelAttrs } : {})}
        data-stories-scroller=""
        style={style}
      >
        <ul role="list" className="flex gap-4">
          {cards.map((card) => (
            <li
              key={card.id}
              className="min-w-0 shrink-0 grow-0 basis-(--story-basis) md:basis-(--story-basis-md) lg:basis-(--story-basis-lg) snap-start"
            >
              <StoryCardView card={card} sizes={storySizes(s, peek)} settings={s} {...rest} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function Stars({ rating, overlay }: { rating: number; overlay: boolean }) {
  const t = useTranslations();
  return (
    <div role="img" aria-label={t('product.storyRating', { rating })} className="flex gap-0.5" data-story-rating={rating}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`h-4 w-4 ${
            i <= rating ? 'fill-amber-400 text-amber-400' : overlay ? 'text-white/50' : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  );
}

function StoryCardView({
  card,
  sizes,
  settings: s,
  storeSlug,
  activeId,
  playingId,
  onPlay,
  onPlayingChange,
  onClose,
}: CardSharedProps & { card: StoryCard; sizes: string }) {
  const t = useTranslations();
  const overlay = s.textPosition === 'overlay';
  const active = activeId === card.id;
  const playing = active && playingId === card.id;
  const media = card.media;
  const verifiedLabel = t('product.storyVerified');
  const showStars = s.showRating && card.rating !== null;
  const showSubtitle = s.showSubtitle && !!card.subtitle;
  // The consent notice of the shared slide sits where the overlay text is.
  const consentShown =
    active && !playing && media.type === 'video' && media.source.type !== 'file' && !embedAllowed(storeSlug);
  // Overlay text hides while this card's video plays (contract 7.4).
  const hideText = overlay && (playing || consentShown);

  const mediaRef = useRef<HTMLDivElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const refocusPlay = useRef(false);
  const cardId = card.id;
  const handlePlayingChange = useCallback((p: boolean) => onPlayingChange(cardId, p), [onPlayingChange, cardId]);

  // Muted autoplay layer: only after hydration, never when the visitor
  // blocks motion / saves data, never for an external story without the
  // external-media consent. Server snapshots keep today's markup.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const blocked = useAutoplayBlocked();
  const externalAllowed = useSyncExternalStore(subscribeConsent, () => embedAllowed(storeSlug), () => false);
  const autoLayer =
    hydrated &&
    !blocked &&
    media.type === 'video' &&
    media.autoplay === true &&
    (media.source.type === 'file' || externalAllowed);
  // Remounts the autoplay slide (back to muted autoplay) when its full
  // player closes because another story started or the clip ended.
  const [layerGen, setLayerGen] = useState(0);
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    if (prevActive && !active && autoLayer) setLayerGen((g) => g + 1);
  }
  const handleLayerPlaying = useCallback(
    (p: boolean) => {
      // The tap on a muted story opened its full player: it becomes the
      // block's active story (one at a time, overlay text hides).
      if (p) onPlay(cardId);
      onPlayingChange(cardId, p);
    },
    [onPlay, onPlayingChange, cardId],
  );

  // A video that ended goes back to its poster; focus returns to its Play
  // button when it was inside the card.
  useEffect(() => {
    if (active || !refocusPlay.current) return;
    refocusPlay.current = false;
    try {
      playButtonRef.current?.focus({ preventScroll: true });
    } catch {
      // Focus is best effort.
    }
  }, [active]);

  const start = () => {
    // The focused Play button unmounts on click: keep focus in the card while
    // the slide / player chunks load (the player then focuses itself).
    try {
      mediaRef.current?.focus({ preventScroll: true });
    } catch {
      // Focus is best effort.
    }
    onPlay(cardId);
  };

  // Media events of the file <video> propagate through the React tree.
  const mediaProps =
    media.type === 'video'
      ? {
          ref: mediaRef,
          tabIndex: -1,
          ...(active
            ? {
                onPlay: () => onPlayingChange(cardId, true),
                onPause: () => onPlayingChange(cardId, false),
                onEnded: () => {
                  const el = mediaRef.current;
                  refocusPlay.current = !!el && typeof document !== 'undefined' && el.contains(document.activeElement);
                  onClose(cardId);
                },
              }
            : {}),
        }
      : {};
  const mediaFocus = 'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white';

  const mediaInner =
    media.type === 'image' ? (
      <StoreImage
        src={media.src}
        // The figcaption names the person; an alt would repeat the name.
        alt=""
        fill
        sizes={sizes}
        loading="lazy"
        unoptimized={isSvgSrc(media.src)}
        className="object-cover"
        draggable={false}
      />
    ) : autoLayer ? (
      <>
        {/* The shared slide on top owns Play, autoplay and the toggles. */}
        <StoryVideoPoster card={card} sizes={sizes} label="" />
        <div className="absolute inset-0 z-20">
          <ProductVideoSlide
            key={`${card.id}:${layerGen}`}
            item={media}
            storeSlug={storeSlug}
            sizes={sizes}
            controlsClassName={STORY_CONTROLS}
            compactFacade
            posterLoading="lazy"
            onPlayingChange={handleLayerPlaying}
          />
        </div>
      </>
    ) : active ? (
      <>
        <StoryVideoPoster card={card} sizes={sizes} label="" />
        <div className="absolute inset-0 z-20">
          <ProductVideoSlide
            key={card.id}
            item={media}
            storeSlug={storeSlug}
            sizes={sizes}
            autoStart
            controlsClassName={STORY_CONTROLS}
            compactFacade
            posterLoading="lazy"
            onPlayingChange={handlePlayingChange}
          />
        </div>
      </>
    ) : (
      <StoryVideoPoster
        card={card}
        sizes={sizes}
        onPlay={start}
        buttonRef={playButtonRef}
        label={t('product.storyPlayNamed', { name: card.name })}
      />
    );

  const textTone = overlay ? 'text-white' : 'text-gray-900';
  const subTone = overlay ? 'text-white/80' : 'text-gray-600';
  const text = hideText ? null : (
    <>
      {showStars && (
        <div className={overlay ? 'relative z-10 pointer-events-none shrink-0 px-4' : 'mt-3'}>
          <Stars rating={card.rating as number} overlay={overlay} />
        </div>
      )}
      {card.quote && (
        // Overlay: in a tight box only the quote shrinks, so the stars and
        // the name always stay visible.
        <blockquote
          className={`whitespace-pre-line wrap-break-word text-sm leading-relaxed ${textTone} ${
            overlay ? `relative z-10 pointer-events-none mt-2 min-h-0 px-4 ${OVERLAY_CLAMP[s.aspect]}` : 'mt-2'
          }`}
        >
          {card.quote}
        </blockquote>
      )}
      <figcaption className={overlay ? 'relative z-10 pointer-events-none shrink-0 mt-2 px-4 pb-4' : 'mt-2'}>
        <span className={`inline-flex max-w-full items-center gap-1 text-sm font-semibold ${textTone}`}>
          <span className="min-w-0 wrap-break-word">{card.name}</span>
          {s.showVerified && card.verified && (
            <span className="inline-flex shrink-0" title={verifiedLabel} data-story-verified="">
              <BadgeCheck aria-hidden="true" className={`h-4 w-4 ${overlay ? 'text-white' : 'text-sky-600'}`} />
              <span className="sr-only">{verifiedLabel}</span>
            </span>
          )}
        </span>
        {showSubtitle && <span className={`block text-xs wrap-break-word ${subTone}`}>{card.subtitle}</span>}
      </figcaption>
    </>
  );

  if (overlay) {
    return (
      <figure
        className={`relative m-0 flex flex-col justify-end overflow-hidden rounded-xl bg-neutral-900 ${ASPECT_CLASS[s.aspect]}`}
        data-story-card=""
        data-story-kind={media.type}
      >
        {/* z-0: the media (and an open player) stays under the text layer,
            so the text can return over a paused video. */}
        <div className={`absolute inset-0 z-0 ${mediaFocus}`} {...mediaProps}>
          {mediaInner}
        </div>
        {!hideText && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/80 via-black/40 to-transparent"
          />
        )}
        {text}
      </figure>
    );
  }

  return (
    <figure className="m-0" data-story-card="" data-story-kind={media.type}>
      <div className={`relative overflow-hidden rounded-xl bg-neutral-900 ${ASPECT_CLASS[s.aspect]} ${mediaFocus}`} {...mediaProps}>
        {mediaInner}
      </div>
      {text}
    </figure>
  );
}

/** Lazy poster (or a dark tile) with the Play button and the duration chip. */
function StoryVideoPoster({
  card,
  sizes,
  onPlay,
  buttonRef,
  label,
}: {
  card: StoryCard;
  sizes: string;
  /** Absent while the card's player is open (no Play button then). */
  onPlay?(): void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  label: string;
}) {
  const media = card.media;
  if (media.type !== 'video') return null;
  const duration = formatVideoDuration(media.durationS);
  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-900" data-story-poster="">
      {media.url ? (
        <StoreImage
          src={media.url}
          alt=""
          fill
          sizes={sizes}
          loading="lazy"
          unoptimized={isSvgSrc(media.url)}
          className="object-cover"
          draggable={false}
        />
      ) : null}
      {onPlay && (
        <button
          ref={buttonRef}
          type="button"
          onClick={onPlay}
          aria-label={label}
          className="group/play absolute inset-0 z-10 flex items-center justify-center focus-visible:outline-none"
        >
          {/* Same look as the shared ProductVideoPoster button, so the
              hand-off on Play does not jump. The Play triangle points right
              in every direction (not mirrored in RTL). */}
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-white shadow-lg transition-transform group-hover/play:scale-105 group-focus-visible/play:ring-4 group-focus-visible/play:ring-white/80">
            <Play className="h-7 w-7 translate-x-[2px] fill-current" aria-hidden="true" />
          </span>
        </button>
      )}
      {duration && (
        <span
          dir="ltr"
          className="pointer-events-none absolute top-2 end-2 z-10 rounded bg-black/65 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white"
        >
          {duration}
        </span>
      )}
    </div>
  );
}
