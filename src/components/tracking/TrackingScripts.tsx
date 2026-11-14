'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { setActiveTrackers, type StoreTracking } from '@/lib/consent';

// Vendor tags (GA4, Meta Pixel, TikTok Pixel). <StoreTracking> decides per
// category (consent v2 §7.1) and passes the enabled vendors explicitly:
// GA4 only with analytics (or ungated), Meta / TikTok only with marketing
// (or ungated), so a visitor who refused a category never has its tags in
// the document. Google Consent Mode v2 runs in basic mode: the tag loads
// only after analytics consent, with the ad_* signals following marketing.
// Microsoft Clarity is not here: it has its own route gate
// (<ClarityScript>, mounted by <StoreTracking>).

interface TrackingScriptsProps {
  tracking: StoreTracking;
  /** Mount GA4 (analytics granted, or GA4 ungated). */
  ga4: boolean;
  /** Mount the Meta Pixel (marketing granted, or ungated). */
  meta: boolean;
  /** Mount the TikTok Pixel (marketing granted, or ungated). */
  tiktok: boolean;
  /** Google ad_storage / ad_user_data / ad_personalization granted. */
  adSignals: boolean;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: {
      page?: () => void;
      track?: (event: string, params?: Record<string, unknown>) => void;
      /** TikTok consent API: stops cookies and events after a withdrawal. */
      revokeConsent?: () => void;
      grantConsent?: () => void;
    };
  }
}

// Ids are validated by the API (G-XXXX / digits / alnum) so they are safe to
// inline; the guard below is belt and braces for the inline snippets.
function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '');
}

/** Consent Mode v2 update for the current choice (analytics is granted whenever GA4 is mounted). */
function ga4ConsentUpdate(adSignals: boolean): Record<string, 'granted' | 'denied'> {
  const ads = adSignals ? 'granted' : 'denied';
  return { analytics_storage: 'granted', ad_storage: ads, ad_user_data: ads, ad_personalization: ads };
}

export function TrackingScripts({ tracking, ga4: ga4On, meta: metaOn, tiktok: tiktokOn, adSignals }: TrackingScriptsProps) {
  const pathname = usePathname();
  const ga4 = ga4On && tracking.ga4_measurement_id ? safeId(tracking.ga4_measurement_id) : '';
  const meta = metaOn && tracking.meta_pixel_id ? safeId(tracking.meta_pixel_id) : '';
  const tiktok = tiktokOn && tracking.tiktok_pixel_id ? safeId(tracking.tiktok_pixel_id) : '';

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

  // The enabled vendors are exactly the allowed ones, so this component owns
  // the "Meta pixel active" flag checkout reads before sending `_fbp` /
  // `_fbc` to the API (cleared again when consent is withdrawn).
  useEffect(() => {
    setActiveTrackers({ ga4: Boolean(ga4), meta: Boolean(meta), tiktok: Boolean(tiktok) });
    return () => setActiveTrackers(null);
  }, [ga4, meta, tiktok]);

  // Re-sent on every change of the ad signals and on a re-accept in the same
  // document (withdraw, then accept again without a reload): next/script
  // dedupes the inline init by id, so it does not run again and GA4 would
  // stay on the earlier update. On the first mount `gtag` is usually not
  // defined yet and the inline init sends the update itself; a repeated
  // update is harmless.
  useEffect(() => {
    if (ga4 && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', ga4ConsentUpdate(adSignals));
    }
  }, [ga4, adSignals]);

  // A pixel that already ran in this document (re-grant without a reload,
  // which happens only when its consent was revoked and the reload was
  // skipped): its snippet is deduped, so grant explicitly.
  useEffect(() => {
    if (meta && typeof window.fbq === 'function') window.fbq('consent', 'grant');
  }, [meta]);
  useEffect(() => {
    if (tiktok && typeof window.ttq?.grantConsent === 'function') window.ttq.grantConsent();
  }, [tiktok]);

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
gtag('set','ads_data_redaction',true);
gtag('consent','update',${JSON.stringify(ga4ConsentUpdate(adSignals))});
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
