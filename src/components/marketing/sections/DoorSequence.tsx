import { getTranslations } from 'next-intl/server';
import { DoorStage } from './DoorStage';

/**
 * "Through the door" film: a navy full-viewport stage pinned for ~250vh. A
 * teal door swings open, the camera pushes through it into a street of
 * storefront cards and three captions crossfade. The server part only
 * resolves copy; DoorStage owns the scrubbed timeline.
 */
export async function DoorSequence({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <DoorStage
      labels={{
        eyebrow: t('door.eyebrow'),
        title: t('door.title'),
        captions: [
          { title: t('door.c1'), sub: t('door.c1sub') },
          { title: t('door.c2'), sub: t('door.c2sub') },
          { title: t('door.c3'), sub: t('door.c3sub') },
        ],
        chips: { currencies: t('door.chipCurrencies'), languages: t('door.chipLanguages'), domain: t('door.chipDomain') },
        scrollHint: t('door.scrollHint'),
      }}
    />
  );
}
