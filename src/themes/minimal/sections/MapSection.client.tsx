'use client';

// Component implementation. Definition lives in MapSection.tsx.
//
// A modern, feature-rich store-locator / contact map:
//   • One or many locations with a branch switcher (chips).
//   • Google Maps embed (no API key) with style filters (grayscale/muted/dark).
//   • Four layouts: full, split-left, split-right, floating overlay card.
//   • Info card (solid or glassmorphism) with address, phone, email, hours and
//     a one-tap "Get directions" button. Fully RTL-aware.

import { useState } from 'react';
import { Clock, Mail, MapPin, Navigation, Phone } from 'lucide-react';
import type { SectionRenderProps } from '../../types';
import { colorOr, numberOr } from '../../elementStyles';

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

export function MapSection({ settings, content, locale }: SectionRenderProps) {
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
      <iframe
        key={queryFor(loc)}
        title={loc.name || 'Map'}
        src={embedUrl(loc, zoom)}
        className="absolute inset-0 w-full h-full"
        style={{ border: 0, filter: STYLE_FILTER[mapStyle] }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
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
            <h2
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h2)',
                fontWeight: 'var(--theme-weight-heading)',
                lineHeight: 'var(--theme-line-heading)',
                color: colorOr(settings.heading_color, 'var(--theme-colors-text)'),
              }}
            >
              {heading}
            </h2>
          )}
          {subheading && (
            <p className="text-sm mt-2" style={{ color: colorOr(settings.subheading_color, 'var(--theme-colors-muted)') }}>
              {subheading}
            </p>
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
