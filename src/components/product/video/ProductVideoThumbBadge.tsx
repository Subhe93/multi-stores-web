import { Play } from 'lucide-react';
import { formatVideoDuration } from '@/lib/productVideo';

/**
 * Decorative Play mark (and duration chip) laid over a gallery thumbnail of
 * a video item. The thumbnail button itself carries the accessible name.
 */
export function ProductVideoThumbBadge({ durationS }: { durationS?: number | null }) {
  const duration = formatVideoDuration(durationS);
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white">
        <Play className="h-3 w-3 translate-x-[1px] fill-current" />
      </span>
      {duration && (
        <span dir="ltr" className="absolute bottom-0.5 end-0.5 rounded bg-black/65 px-1 text-[10px] leading-4 tabular-nums text-white">
          {duration}
        </span>
      )}
    </span>
  );
}
