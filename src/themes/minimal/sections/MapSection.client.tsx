'use client';

// Component implementation. Definition lives in MapSection.tsx.
//
// A modern, feature-rich store-locator / contact map:
//   • One or many locations with a branch switcher (chips).
//   • Google Maps embed (no API key) with style filters (grayscale/muted/dark).
//   • Four layouts: full, split-left, split-right, floating overlay card.
//   • Info card (solid or glassmorphism) with address, phone, email, hours and
//     a one-tap "Get directions" button. Fully RTL-aware.
//   • Privacy: the Google iframe is not requested until the visitor clicks
//     "Show map" (two-click facade, same principle as external videos), so
//     Google gets no IP address / cookies on a plain page view. "Always allow
//     external media" stores the per-store external-media consent (consent v2
//     category external_media) and loads it; with that consent the map loads
//     without the facade (never in SSR markup). The builder preview loads it
//     directly so editors can check the location.

import { useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, Mail, MapPin, Navigation, Phone } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { grantExternalMediaConsent, subscribeConsent } from '@/lib/consent';
import { consentTextHash } from '@/lib/consentLog';
import { embedAllowed } from '@/lib/productVideo';
import type { SectionRenderProps } from '../../types';
import { colorOr, numberOr } from '../../elementStyles';
import { headingTag, textTag } from './_shared/headingLevel';
import { Heading } from './_shared/Heading';

interface MapLocation {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  hours?: string;
  lat?: string;
  lng?: string;
}

type MapStyle = 'standard' | 'grayscale' | 'muted' | 'dark';
type Layout = 'full' | 'split-left' | 'split-right' | 'overlay';

const STYLE_FILTER: Record<MapStyle, string | undefined> = {
  standard: undefined,
  grayscale: 'grayscale(1)',
  muted: 'grayscale(0.65) contrast(0.92) saturate(0.9)',
  dark: 'invert(0.92) hue-rotate(180deg) contrast(0.9)',
};

function queryFor(loc: MapLocation): string {
  if (loc.lat && loc.lng) return `${loc.lat},${loc.lng}`;
  return loc.address || loc.name || '';
}
function embedUrl(loc: MapLocation, zoom: number): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(queryFor(loc))}&z=${zoom}&output=embed`;
}
function directionsUrl(loc: MapLocation): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(queryFor(loc))}`;
}

export function MapSection({ settings, content, locale, storeSlug, builderPreview }: SectionRenderProps) {
  const headingLevel = headingTag(settings.heading_level, 'h2');
  const subheadingTag = textTag(settings.subheading_tag, 'p');
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const locations = ((content.locations as MapLocation[]) || []).filter(
    (l) => l.address || l.name || (l.lat && l.lng),
  );
  const zoom = Math.round(numberOr(settings.zoom, 14));
  const height = Math.max(220, numberOr(settings.height, 440));
  const mapStyle = (settings.map_style as MapStyle) || 'standard';
  const layout = (settings.layout as Layout) || 'split-right';
  const rounded = settings.rounded !== false;
  const glass = (settings.card_style as 'solid' | 'glass') === 'glass';
  const showDirections = settings.show_directions !== false;

  const [active, setActive] = useState(0);
  // Two-click: the Google iframe loads only after "Show map" (per page view).
  const [mapLoaded, setMapLoaded] = useState(false);
  // External-media consent for this store: server snapshot false, so SSR
  // never renders the Google iframe (same pattern as VideoEmbed).
  const allowed = useSyncExternalStore(subscribeConsent, () => embedAllowed(storeSlug), () => false);
  // Withdrawing external media (Cookie settings) on this page unloads the
  // map again, also when it was loaded by a click: the facade locks with the
  // category, just as it unlocks with it.
  const [prevAllowed, setPrevAllowed] = useState(allowed);
  if (prevAllowed !== allowed) {
    setPrevAllowed(allowed);
    if (!allowed) setMapLoaded(false);
  }
  const ar = locale === 'ar';

  if (locations.length === 0) {
    return (
      <section className="py-12">
        <div
          className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center"
          style={{
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
            color: 'var(--theme-colors-muted)',
          }}
        >
          <MapPin className="size-6 opacity-60" />
          <p className="text-sm">
            {ar ? 'أضف موقعاً واحداً على الأقل من البيلدر.' : 'Add at least one location from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  const loc = locations[Math.min(active, locations.length - 1)];
  const radius = rounded ? 'var(--theme-radius-lg)' : '0';

  const mapFrame = (
    <div
      className="relative w-full overflow-hidden card-lift"
      style={{ height, borderRadius: radius, boxShadow: 'var(--theme-shadow-md)' }}
    >
      {mapLoaded || allowed || builderPreview ? (
        <iframe
          key={queryFor(loc)}
          title={loc.name || 'Map'}
          src={embedUrl(loc, zoom)}
          className="absolute inset-0 w-full h-full"
          style={{ border: 0, filter: STYLE_FILTER[mapStyle] }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <MapFacade
          top={layout === 'overlay'}
          onLoad={() => setMapLoaded(true)}
          onAlwaysAllow={(textHash) => {
            grantExternalMediaConsent(storeSlug, textHash);
            setMapLoaded(true);
          }}
        />
      )}
      {/* Floating card for the overlay layout */}
      {layout === 'overlay' && (
        <div className="absolute inset-x-4 bottom-4 sm:inset-x-auto sm:bottom-6 sm:inset-s-6 sm:max-w-sm">
          <InfoCard
            loc={loc}
            glass
            ar={ar}
            showDirections={showDirections}
          />
        </div>
      )}
    </div>
  );

  const panel = (
    <div className="flex flex-col gap-4">
      {locations.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {locations.map((l, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className="px-3.5 py-1.5 text-xs font-medium rounded-full transition"
              style={
                i === active
                  ? { backgroundColor: 'var(--theme-colors-primary)', color: 'var(--theme-colors-primaryContrast, #fff)' }
                  : { backgroundColor: 'var(--theme-colors-surface)', color: 'var(--theme-colors-text)', border: '1px solid var(--theme-colors-border)' }
              }
            >
              {l.name || `${ar ? 'فرع' : 'Branch'} ${i + 1}`}
            </button>
          ))}
        </div>
      )}
      <InfoCard loc={loc} glass={glass} ar={ar} showDirections={showDirections} />
    </div>
  );

  const isSplit = layout === 'split-left' || layout === 'split-right';

  return (
    <section className="py-12">
      {(heading || subheading) && (
        <div className="text-center mb-8 max-w-2xl mx-auto">
          {heading && (
            <Heading level={headingLevel}
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h2)',
                fontWeight: 'var(--theme-weight-heading)',
                lineHeight: 'var(--theme-line-heading)',
                color: colorOr(settings.heading_color, 'var(--theme-colors-text)'),
              }}
            >
              {heading}
            </Heading>
          )}
          {subheading && (
            <Heading level={subheadingTag} look="body" className="text-sm mt-2" style={{ color: colorOr(settings.subheading_color, 'var(--theme-colors-muted)') }}>
              {subheading}
            </Heading>
          )}
        </div>
      )}

      {isSplit ? (
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 items-center">
          <div className={layout === 'split-left' ? 'md:order-2' : ''}>{mapFrame}</div>
          <div className={layout === 'split-left' ? 'md:order-1' : ''}>{panel}</div>
        </div>
      ) : layout === 'overlay' ? (
        mapFrame
      ) : (
        <div className="flex flex-col gap-6">
          {locations.length > 1 || loc.address || loc.phone ? panel : null}
          {mapFrame}
        </div>
      )}
    </section>
  );
}

// ── Two-click facade ─────────────────────────────────────────

// Both buttons share one style: loading once is as prominent as always allowing.
const FACADE_BUTTON =
  'cursor-pointer rounded-full px-5 py-2 text-sm font-semibold transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-colors-primary)]';
const FACADE_BUTTON_STYLE = { backgroundColor: 'var(--theme-colors-primary)', color: 'var(--theme-colors-primaryContrast, #fff)' };

function MapFacade({
  top,
  onLoad,
  onAlwaysAllow,
}: {
  top: boolean;
  onLoad(): void;
  /** `textHash`: the pending sha256 of the notice (consent-log proof, §5.4). */
  onAlwaysAllow(textHash: Promise<string>): void;
}) {
  const t = useTranslations('externalMap');
  const lp = useLocalePath();
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={rootRef}
      data-map-facade=""
      className={`absolute inset-0 flex flex-col items-center gap-3 p-5 text-center ${top ? 'justify-start' : 'justify-center'}`}
      style={{ backgroundColor: 'var(--theme-colors-surface)', color: 'var(--theme-colors-muted)' }}
    >
      <MapPin className="size-7 shrink-0" style={{ color: 'var(--theme-colors-primary)' }} aria-hidden="true" />
      <p className="max-w-md text-sm leading-relaxed" data-consent-text="">
        {t('notice')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <button type="button" onClick={onLoad} className={FACADE_BUTTON} style={FACADE_BUTTON_STYLE}>
          {t('load')}
        </button>
        <button
          type="button"
          data-consent-text=""
          onClick={() => onAlwaysAllow(consentTextHash(rootRef.current))}
          className={FACADE_BUTTON}
          style={FACADE_BUTTON_STYLE}
        >
          {t('alwaysAllow')}
        </button>
        <a href={lp('/legal/privacy')} className="text-xs underline underline-offset-2" style={{ color: 'inherit' }}>
          {t('privacy')}
        </a>
      </div>
    </div>
  );
}

// ── Info card ────────────────────────────────────────────────

function InfoCard({
  loc,
  glass,
  ar,
  showDirections,
}: {
  loc: MapLocation;
  glass: boolean;
  ar: boolean;
  showDirections: boolean;
}) {
  const rows: Array<{ icon: typeof MapPin; node: React.ReactNode }> = [];
  if (loc.address) rows.push({ icon: MapPin, node: loc.address });
  if (loc.phone) {
    rows.push({
      icon: Phone,
      node: (
        <a href={`tel:${loc.phone}`} className="hover:underline" style={{ color: 'inherit' }}>
          {loc.phone}
        </a>
      ),
    });
  }
  if (loc.email) {
    rows.push({
      icon: Mail,
      node: (
        <a href={`mailto:${loc.email}`} className="hover:underline break-all" style={{ color: 'inherit' }}>
          {loc.email}
        </a>
      ),
    });
  }
  if (loc.hours) rows.push({ icon: Clock, node: <span className="whitespace-pre-line">{loc.hours}</span> });

  return (
    <div
      className={glass ? 'p-5 backdrop-blur-md' : 'p-6'}
      style={
        glass
          ? {
              backgroundColor: 'color-mix(in srgb, var(--theme-colors-background) 78%, transparent)',
              border: '1px solid var(--theme-colors-border)',
              borderRadius: 'var(--theme-radius-lg)',
              boxShadow: 'var(--theme-shadow-lg)',
            }
          : {
              backgroundColor: 'var(--theme-colors-surface)',
              border: '1px solid var(--theme-colors-border)',
              borderRadius: 'var(--theme-radius-lg)',
            }
      }
    >
      {loc.name && (
        <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--theme-colors-text)' }}>
          {loc.name}
        </h3>
      )}
      <ul className="space-y-2.5">
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--theme-colors-muted)' }}>
              <Icon className="size-4 mt-0.5 shrink-0" style={{ color: 'var(--theme-colors-primary)' }} />
              <span className="min-w-0">{r.node}</span>
            </li>
          );
        })}
      </ul>
      {showDirections && queryFor(loc) && (
        <a
          href={directionsUrl(loc)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full transition hover:opacity-90 hover:-translate-y-px"
          style={{
            backgroundColor: 'var(--theme-colors-primary)',
            color: 'var(--theme-colors-primaryContrast, #fff)',
            boxShadow: 'var(--theme-shadow-md)',
          }}
        >
          <Navigation className="size-4" />
          {ar ? 'الاتجاهات' : 'Get directions'}
        </a>
      )}
    </div>
  );
}
