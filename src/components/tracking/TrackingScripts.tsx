'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import type { StoreTracking } from '@/lib/consent';

// Vendor tags (GA4, Meta Pixel, TikTok Pixel) — Namez go-live 3.9. Rendered
// only once consent is granted (or the store does not require it), so a
// "denied" visitor never has a tracker script in the document at all.

interface TrackingScriptsProps {
  tracking: StoreTracking;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: { page?: () => void };
  }
}

// Ids are validated by the API (G-XXXX / digits / alnum) so they are safe to
// inline; the guard below is belt and braces for the inline snippets.
function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '');
}

export function TrackingScripts({ tracking }: TrackingScriptsProps) {
  const pathname = usePathname();
  const ga4 = tracking.ga4_measurement_id ? safeId(tracking.ga4_measurement_id) : '';
  const meta = tracking.meta_pixel_id ? safeId(tracking.meta_pixel_id) : '';
  const tiktok = tracking.tiktok_pixel_id ? safeId(tracking.tiktok_pixel_id) : '';

  // The vendor snippets send the first page view themselves; later client
  // navigations (App Router keeps the document) are reported here for Meta
  // and TikTok. GA4 is left out on purpose: Enhanced Measurement already
  // reports history changes, so a manual page_view would double count.
  const firstPath = useRef<string | null>(null);
  useEffect(() => {
    if (firstPath.current === null) {
      firstPath.current = pathname;
      return;
    }
    if (firstPath.current === pathname) return;
    firstPath.current = pathname;
    if (meta && typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
    }
    if (tiktok && typeof window.ttq?.page === 'function') {
      window.ttq.page();
    }
  }, [pathname, meta, tiktok]);

  if (!ga4 && !meta && !tiktok) return null;

  return (
    <>
      {ga4 && (
        <>
          <Script
            id="ms-ga4-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
            strategy="afterInteractive"
          />
          <Script id="ms-ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});
gtag('js',new Date());gtag('config','${ga4}');`}
          </Script>
        </>
      )}
      {meta && (
        <Script id="ms-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${meta}');fbq('track','PageView');`}
        </Script>
      )}
      {tiktok && (
        <Script id="ms-tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
ttq.load('${tiktok}');ttq.page();}(window,document,'ttq');`}
        </Script>
      )}
    </>
  );
}
