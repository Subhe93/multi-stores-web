'use client';

import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile on the platform sign-up (onboarding wave 3). The
 * widget exists only while `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set; the API
 * then requires `turnstile_token` (TURNSTILE_SECRET_KEY). The script is
 * loaded lazily on this page only, rendered explicitly (light theme, the
 * page locale as the widget language; RTL is handled by Turnstile itself).
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  'timeout-callback'?: () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Loads api.js once; resolves when `window.turnstile` is available. */
export function loadTurnstile(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error('Turnstile script failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface TurnstileWidgetProps {
  siteKey: string;
  /** Widget language (the page locale). */
  language: string;
  /** Accessible name of the widget region. */
  label: string;
  /** Fresh token, or null when it expired / errored / was reset. */
  onToken: (token: string | null) => void;
  /** Bump to reset the widget (tokens are single-use: after every failed submit). */
  resetSignal?: number;
}

export function TurnstileWidget({ siteKey, language, label, onToken, resetSignal = 0 }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    loadTurnstile()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          language,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
          'timeout-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        // Script blocked: the submit will report captchaRequired and the
        // API would refuse anyway; nothing else to do client-side.
      });
    return () => {
      cancelled = true;
      const id = widgetIdRef.current;
      widgetIdRef.current = null;
      if (id && window.turnstile) {
        try {
          window.turnstile.remove(id);
        } catch {
          // Already gone.
        }
      }
      onTokenRef.current(null);
    };
  }, [siteKey, language]);

  // A used token is dead: reset after every failed submit.
  useEffect(() => {
    if (resetSignal === 0) return;
    const id = widgetIdRef.current;
    if (id && window.turnstile) {
      try {
        window.turnstile.reset(id);
      } catch {
        // Widget not rendered yet.
      }
    }
    onTokenRef.current(null);
  }, [resetSignal]);

  return <div ref={containerRef} className="sd-auth-captcha" role="group" aria-label={label} />;
}
