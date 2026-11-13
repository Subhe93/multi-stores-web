'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { setClarityActive } from '@/lib/consent';
import { clarityLoader, grantClarityConsent, safeClarityId } from './clarity';

// Microsoft Clarity tag. <StoreTracking> mounts it only while the visitor's
// stored choice is "granted" and the route allows Clarity (never account,
// auth or order confirmation pages).
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
