'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

// First frame of an uploaded MP4 that has no poster (QA 2026-11-14 #17: a
// video without a poster rendered as a black box in the gallery and the
// stories). The tile itself is a neutral placeholder with the Play button;
// this layer adds the frame at 0.1 s through a muted `preload="metadata"`
// <video> with the `#t=0.1` media fragment, which fetches the file header
// and the first frame only.
//
// No extra download for items the visitor does not see: nothing renders on
// the server, the <video> mounts only once the tile is on screen
// (IntersectionObserver; a gallery renders only its active slide anyway),
// and never with Save-Data. Once mounted it stays (the frame is cached).

interface NetworkInformationLike {
  saveData?: boolean;
}

function saveData(): boolean {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { connection?: NetworkInformationLike }) : null;
  return nav?.connection?.saveData === true;
}

const noopSubscribe = () => () => {};

export function VideoFirstFrame({ src }: { src: string }) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [seen, setSeen] = useState(false);
  // Client only (server snapshot false): no IntersectionObserver means the
  // frame cannot be gated on visibility, so it shows right away.
  const noObserver = useSyncExternalStore(
    noopSubscribe,
    () => typeof IntersectionObserver === 'undefined' && !saveData(),
    () => false,
  );
  const visible = seen || (noObserver && !!src);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el || !src || saveData() || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '100px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  return (
    <span ref={anchorRef} aria-hidden="true" className="pointer-events-none absolute inset-0" data-video-first-frame="">
      {visible && (
        <video
          src={`${src}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
          // Transparent until its frame decodes: the placeholder shows through.
          className="h-full w-full object-cover"
        />
      )}
    </span>
  );
}
