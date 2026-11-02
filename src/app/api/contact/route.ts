import { NextRequest, NextResponse } from 'next/server';

// Contact form endpoint for the marketing site. Validates the payload and
// forwards it as JSON to CONTACT_WEBHOOK_URL (Slack/Make/n8n/any HTTP sink).
// Without a webhook configured the client gets 503 `not_configured` and shows
// the direct email instead. No external packages.
//
// POST /api/contact
//   body: { name, email, message, website? }  — `website` is a honeypot and
//   must stay empty; bots that fill it get a silent 200.

export const runtime = 'nodejs';

const LIMITS = { name: 120, email: 254, message: 4000 } as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Body = { name?: unknown; email?: unknown; message?: unknown; website?: unknown };

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Honeypot: real users never see this field. Pretend success so bots stop.
  if (str(body.website).length > 0) {
    return NextResponse.json({ ok: true });
  }

  const name = str(body.name);
  const email = str(body.email);
  const message = str(body.message);

  const errors: Record<string, string> = {};
  if (!name) errors.name = 'required';
  else if (name.length > LIMITS.name) errors.name = 'too_long';
  if (!email) errors.email = 'required';
  else if (email.length > LIMITS.email || !EMAIL_RE.test(email)) errors.email = 'invalid';
  if (!message) errors.message = 'required';
  else if (message.length > LIMITS.message) errors.message = 'too_long';
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation', fields: errors }, { status: 400 });
  }

  const webhook = process.env.CONTACT_WEBHOOK_URL;
  if (!webhook) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const payload = {
    source: 'shopsdoor.com',
    name,
    email,
    message,
    locale: req.headers.get('x-locale') || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
    receivedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'upstream' }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
