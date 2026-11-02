'use client';

import { useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';

interface Labels {
  name: string;
  email: string;
  message: string;
  send: string;
  sending: string;
  sent: string;
  error: string;
  notConfigured: string;
}

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'notConfigured';

/**
 * Contact form posting JSON to /api/contact. The route answers 503 with
 * `{ error: 'not_configured' }` until mail delivery is set up, which the form
 * turns into a friendly hint rather than a failure. The `website` field is a
 * honeypot: hidden from people, filled by bots, rejected by the API.
 */
export function ContactForm({ labels }: { labels: Labels }) {
  const [status, setStatus] = useState<Status>('idle');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
      website: String(data.get('website') ?? ''),
    };
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        form.reset();
        setStatus('sent');
        return;
      }
      if (res.status === 503) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (body?.error === 'not_configured') {
          setStatus('notConfigured');
          return;
        }
      }
      setStatus('error');
    } catch {
      setStatus('error');
    }
  }

  const feedback = status === 'sent' ? labels.sent : status === 'error' ? labels.error : status === 'notConfigured' ? labels.notConfigured : '';

  return (
    <form className="sd-contact-form" onSubmit={onSubmit}>
      <div className="sd-field">
        <label htmlFor="sd-contact-name">{labels.name}</label>
        <input id="sd-contact-name" name="name" type="text" autoComplete="name" required maxLength={120} />
      </div>
      <div className="sd-field">
        <label htmlFor="sd-contact-email">{labels.email}</label>
        <input id="sd-contact-email" name="email" type="email" autoComplete="email" required maxLength={200} dir="ltr" />
      </div>
      <div className="sd-field">
        <label htmlFor="sd-contact-message">{labels.message}</label>
        <textarea id="sd-contact-message" name="message" rows={5} required maxLength={4000} />
      </div>
      {/* Honeypot: visually removed and skipped by assistive tech */}
      <div className="sd-field-trap" aria-hidden="true">
        <label htmlFor="sd-contact-website">Website</label>
        <input id="sd-contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="sd-contact-form-foot">
        <button type="submit" className="sd-btn sd-btn-primary" disabled={status === 'sending'}>
          <span className="sd-btn-label">
            {status === 'sending' ? labels.sending : labels.send}
            <Send aria-hidden="true" />
          </span>
        </button>
        <p className={`sd-contact-feedback ${status === 'sent' ? 'is-ok' : status === 'idle' || status === 'sending' ? '' : 'is-warn'}`.trim()} role="status" aria-live="polite">
          {feedback}
        </p>
      </div>
    </form>
  );
}
