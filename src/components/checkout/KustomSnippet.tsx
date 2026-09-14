'use client';

import { useEffect, useRef } from 'react';

interface KustomSnippetProps {
  /** The `html_snippet` returned by Kustom (checkout or confirmation). */
  html: string;
  className?: string;
}

// Renders a Kustom `html_snippet`. Assigning the snippet through innerHTML
// inserts the markup, but the browser deliberately does not execute <script>
// elements created that way. So after injection every script is re-created
// (attributes + inline text copied onto a fresh element) and swapped in place
// of the inert one: a freshly constructed script node does run when it is
// connected to the document. The Kustom container itself is left unstyled and
// free to grow so the iframe can resize itself; only the 320px min-width that
// Kustom's integration guide requires is applied.
export function KustomSnippet({ html, className }: KustomSnippetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = html;

    const scripts = Array.from(container.querySelectorAll('script'));
    for (const inert of scripts) {
      const script = document.createElement('script');
      for (const attr of Array.from(inert.attributes)) {
        script.setAttribute(attr.name, attr.value);
      }
      script.text = inert.text;
      inert.parentNode?.replaceChild(script, inert);
    }

    return () => {
      // Drop the injected markup (and the iframe it owns) when the snippet
      // changes or the component unmounts so nothing leaks between renders.
      container.innerHTML = '';
    };
  }, [html]);

  return (
    <div className={className}>
      <div ref={containerRef} style={{ minWidth: 320 }} />
    </div>
  );
}
