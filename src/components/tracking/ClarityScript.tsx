'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { setClarityActive } from '@/lib/consent';
import { clarityLoader, grantClarityConsent, safeClarityId } from './clarity';

// Microsoft Clarity tag. <StoreTracking> mounts it only while the visitor
// allows the analytics category (consent v2) and the route allows Clarity
// (never account, auth or order confirmation pages). Consent API v2:
// analytics_Storage granted, ad_Storage always denied.
//
// The consent signal is sent from an effect, not from the inline script:
// next/script dedupes inline scripts by id, so a second mount in the same
// document (e.g. after a client navigation back from an excluded route)
// would not run the snippet again.

interface ClarityScriptProps {
  projectId: string;
}

export function ClarityScript({ projectId }: ClarityScriptProps) {
  const id = safeClarityId(projectId);

  useEffect(() => {
    if (!id) return;
    grantClarityConsent();
    setClarityActive(true);
    return () => setClarityActive(false);
  }, [id]);

  if (!id) return null;

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {clarityLoader(id)}
    </Script>
  );
}
