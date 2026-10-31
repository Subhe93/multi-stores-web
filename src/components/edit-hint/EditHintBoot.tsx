'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { consumeEditHintHandoff, readEditHintToken } from './editHintStorage';

interface EditHintButtonProps {
  storeSlug: string;
}

/**
 * Mounted once in the store layout. Renders nothing on the server and,
 * for every visitor without an owner token, nothing on the client either:
 * the button chunk is loaded with a dynamic import() only when a token is
 * stored in this browser.
 */
export function EditHintBoot({ storeSlug }: EditHintButtonProps) {
  const [Button, setButton] = useState<ComponentType<EditHintButtonProps> | null>(null);

  useEffect(() => {
    consumeEditHintHandoff();
    let embedded = true;
    try {
      embedded = window.self !== window.top;
    } catch {
      /* cross-origin parent: treat as embedded */
    }
    // Never inside an iframe (dashboard previews), never without a token.
    if (embedded || !readEditHintToken()) return;
    let alive = true;
    import('./EditHintButton')
      .then((m) => {
        if (alive) setButton(() => m.EditHintButton);
      })
      .catch(() => {
        /* chunk failed to load: no button */
      });
    return () => {
      alive = false;
    };
  }, []);

  return Button ? <Button storeSlug={storeSlug} /> : null;
}
