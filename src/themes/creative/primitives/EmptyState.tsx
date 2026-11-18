import { useTranslations } from 'next-intl';
import { BASE_CSS } from '../css/base.css';
import { CxStyle } from './CxStyle';

/** 'ornament-line' -> 'ornamentLine' (the key under creative.empty). */
function emptyKey(name: string): string {
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Builder-only placeholder of a creative section that has nothing set. The
 * live store renders nothing instead (the section returns null).
 */
export function EmptyState({ name }: { name: string }) {
  const t = useTranslations('creative');
  return (
    <>
      <CxStyle id="base" css={BASE_CSS} />
      <div className="cx-empty" data-cx-empty={name}>
        {t(`empty.${emptyKey(name)}`)}
      </div>
    </>
  );
}
