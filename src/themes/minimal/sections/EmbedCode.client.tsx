'use client';

// Component implementation. Definition lives in EmbedCode.tsx.
//
// Custom code widget for the store owner: paste HTML, CSS and JS. Two render
// modes:
//   • isolated (default) — a sandboxed <iframe srcdoc> that runs scripts in
//     isolation, auto-resizing to its content via postMessage. Best for
//     third-party widgets/embeds; CSS/JS can't leak into the storefront.
//   • inline — injects the HTML/CSS into the page and executes scripts in the
//     page context. Use when the snippet must interact with the storefront.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Code2 } from 'lucide-react';
import type { SectionRenderProps } from '../../types';
import { numberOr } from '../../elementStyles';

export function EmbedCode({ settings, locale }: SectionRenderProps) {
  const html = (settings.html as string) || '';
  const css = (settings.css as string) || '';
  const js = (settings.js as string) || '';
  const mode = (settings.mode as 'isolated' | 'inline') || 'isolated';
  const minHeight = Math.max(0, numberOr(settings.min_height, 0));

  if (!html.trim() && !css.trim() && !js.trim()) {
    return (
      <section className="py-10">
        <div
          className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center"
          style={{
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
            color: 'var(--theme-colors-muted)',
          }}
        >
          <Code2 className="size-6 opacity-60" />
          <p className="text-sm">
            {locale === 'ar'
              ? 'الصق كود HTML / CSS / JavaScript من البيلدر.'
              : 'Paste HTML / CSS / JavaScript from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  return mode === 'inline' ? (
    <InlineEmbed html={html} css={css} js={js} minHeight={minHeight} />
  ) : (
    <IsolatedEmbed html={html} css={css} js={js} minHeight={minHeight} />
  );
}

// ── Isolated (sandboxed iframe) ──────────────────────────────

function buildSrcDoc(html: string, css: string, js: string, channel: string): string {
  // The reporter posts the content height to the parent so the iframe can grow
  // to fit. JSON.stringify(channel) keeps the id safely quoted.
  const reporter = `(function(){
    function report(){try{var h=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);parent.postMessage({__embed:${JSON.stringify(channel)},height:h},'*');}catch(e){}}
    window.addEventListener('load',report);setTimeout(report,250);setTimeout(report,1200);
    if(window.ResizeObserver){try{new ResizeObserver(report).observe(document.body);}catch(e){}}
  })();`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif}*{box-sizing:border-box}${css}</style></head>
<body>${html}<script>${reporter}</script><script>${js}</script></body></html>`;
}

function IsolatedEmbed({ html, css, js, minHeight }: { html: string; css: string; js: string; minHeight: number }) {
  const channel = `embed-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [height, setHeight] = useState(minHeight || 280);
  const srcDoc = useMemo(() => buildSrcDoc(html, css, js, channel), [html, css, js, channel]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (data && data.__embed === channel && typeof data.height === 'number') {
        setHeight(Math.max(minHeight, Math.ceil(data.height)));
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [channel, minHeight]);

  return (
    <section className="py-6">
      <iframe
        title="Embedded content"
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
        loading="lazy"
        className="w-full block"
        style={{ height, border: 0, borderRadius: 'var(--theme-radius-md)' }}
      />
    </section>
  );
}

// ── Inline (in-page) ─────────────────────────────────────────

function InlineEmbed({ html, css, js, minHeight }: { html: string; css: string; js: string; minHeight: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // innerHTML-inserted <script> tags don't execute — re-create them so they
    // run, then append the standalone JS field.
    el.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      for (const attr of Array.from(old.attributes)) s.setAttribute(attr.name, attr.value);
      s.textContent = old.textContent;
      old.replaceWith(s);
    });
    if (js.trim()) {
      const s = document.createElement('script');
      s.textContent = js;
      el.appendChild(s);
    }
  }, [html, js]);

  return (
    <section className="py-6" style={{ minHeight: minHeight || undefined }}>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}
