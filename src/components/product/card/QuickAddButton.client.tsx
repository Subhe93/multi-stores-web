'use client';

// Quick-add button of a product card. OWNER: builder W4.
//
// The listing ships only this button: the dialog (and with it the product
// page state, the variant picker and the add-to-cart button) is a separate
// chunk fetched on the first click, warmed up on hover / focus. The button
// is a sibling of the card's stretched link (never inside it) and sits above
// it through the `.pcard-actions` layer of the card.

import { useCallback, useRef, useState, type ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Plus } from 'lucide-react';
import type { QuickAddDialogProps } from './QuickAddDialog.client';
import type { QuickAddButtonProps } from './types';
import './quick-add.css';

type DialogComponent = ComponentType<QuickAddDialogProps>;

// One import for every card of the page; a failed load is retried on the
// next click.
let dialogLoader: Promise<DialogComponent> | null = null;
function loadDialog(): Promise<DialogComponent> {
  if (!dialogLoader) {
    dialogLoader = import('./QuickAddDialog.client')
      .then((m) => m.QuickAddDialog)
      .catch((err) => {
        dialogLoader = null;
        throw err;
      });
  }
  return dialogLoader;
}

export function QuickAddButton({ productSlug, title, href, card, currency }: QuickAddButtonProps) {
  const t = useTranslations('product');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [Dialog, setDialog] = useState<DialogComponent | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const warm = useCallback(() => {
    void loadDialog().catch(() => undefined);
  }, []);

  const handleClick = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      const loaded = await loadDialog();
      setDialog(() => loaded);
      setOpen(true);
    } catch {
      // The chunk did not arrive (offline, deploy in between): the product
      // page still answers.
      window.location.assign(href);
    } finally {
      setPending(false);
    }
  }, [pending, href]);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Focus goes back to the button that opened the dialog.
    buttonRef.current?.focus();
  }, []);

  // Nothing to add on a sold-out product: the card says so, no button.
  if (card?.stock?.soldOut) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="qadd-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={pending || undefined}
        aria-label={t('quickAddFor', { title })}
        title={t('quickAdd')}
        data-quick-add=""
        onClick={handleClick}
        onPointerEnter={warm}
        onFocus={warm}
      >
        {pending ? (
          <Loader2 className="qadd-btn-icon animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="qadd-btn-icon" strokeWidth={1.5} aria-hidden="true" />
        )}
        <span className="qadd-btn-label" aria-hidden="true">
          {t('quickAdd')}
        </span>
      </button>
      {open && Dialog ? (
        <Dialog
          anchor={buttonRef.current}
          productSlug={productSlug}
          title={title}
          href={href}
          currency={currency}
          onClose={handleClose}
        />
      ) : null}
    </>
  );
}
