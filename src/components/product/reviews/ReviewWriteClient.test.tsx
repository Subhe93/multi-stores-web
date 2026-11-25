import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Review write page (M171): the review-link flow (token read from the
// fragment, stripped, sent in JSON bodies only), the signed-in flow, client
// validation, coded server errors and the success states.

const { auth, calls } = vi.hoisted(() => ({
  auth: { token: null as string | null, loading: false },
  calls: {
    linkContext: vi.fn(),
    submitLink: vi.fn(),
    eligibility: vi.fn(),
    submitMine: vi.fn(),
    deleteMine: vi.fn(),
    orderItems: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/reviews/write',
  useParams: () => ({ storeSlug: 'demo' }),
}));
vi.mock('next-intl', () => {
  const t = Object.assign(
    (k: string, values?: Record<string, unknown>) => (values ? `${k}:${JSON.stringify(values)}` : k),
    // An unknown code has no translation: the form must fall back to `generic`.
    { has: (k: string) => k !== 'SOMETHING_NEW' },
  );
  return { useLocale: () => 'sv', useTranslations: () => t };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/components/auth/CustomerCaptcha', () => ({ CUSTOMER_CAPTCHA_ON: false, CustomerCaptcha: () => null }));
vi.mock('@/lib/reviewsApi', () => ({ reviewsApi: calls }));

import { ReviewWriteClient } from './ReviewWriteClient';

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.review-link.signature';
const PRODUCT_ID = '3f0c1c1e-0b7e-4a57-9a53-000000000001';

const CONTEXT = {
  product: {
    id: PRODUCT_ID,
    translations: [
      { locale: 'en', title: 'Name necklace', slug: 'name-necklace' },
      { locale: 'sv', title: 'Namnhalsband', slug: 'namnhalsband' },
    ],
    image_url: '/uploads/a.jpg',
  },
  display_name_suggestion: 'Anna S.',
  review: null,
  expires_at: '2027-02-01T00:00:00.000Z',
};

const coded = (code: string, status = 400) => Object.assign(new Error('raw server text'), { code, status });

function setUrl(pathAndHash: string) {
  window.history.replaceState(null, '', pathAndHash);
}

async function fillValidForm() {
  fireEvent.click(await screen.findByRole('radio', { name: 'starsLabel:{"rating":4}' }));
  fireEvent.change(screen.getByLabelText('form.body'), { target: { value: 'Snabb leverans och fin gravyr.' } });
}

beforeEach(() => {
  for (const fn of Object.values(calls)) fn.mockReset();
  auth.token = null;
  auth.loading = false;
  setUrl('/reviews/write');
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('review link', () => {
  beforeEach(() => {
    setUrl(`/reviews/write#token=${TOKEN}`);
    calls.linkContext.mockResolvedValue(CONTEXT);
  });

  it('reads the token, strips the fragment at once and never stores it', async () => {
    render(<ReviewWriteClient storeSlug="demo" />);
    await screen.findByRole('radio', { name: 'starsLabel:{"rating":5}' });
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain(TOKEN);
    expect(calls.linkContext).toHaveBeenCalledTimes(1);
    expect(calls.linkContext).toHaveBeenCalledWith('demo', TOKEN);
    expect(JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage })).not.toContain(TOKEN);
    expect(document.cookie).not.toContain(TOKEN);
    // The token is nowhere in the page either.
    expect(document.body.innerHTML).not.toContain(TOKEN);
    // No login is involved.
    expect(calls.eligibility).not.toHaveBeenCalled();
  });

  it('shows the product in the page language and prefills the name suggestion', async () => {
    render(<ReviewWriteClient storeSlug="demo" />);
    expect(await screen.findByText('Namnhalsband')).toBeTruthy();
    expect((screen.getByLabelText('form.displayName') as HTMLInputElement).value).toBe('Anna S.');
    expect(screen.queryByText('form.editingNotice')).toBeNull();
  });

  it('submits through the link route with the token in the body', async () => {
    calls.submitLink.mockResolvedValue({ id: 'r1', status: 'PENDING' });
    render(<ReviewWriteClient storeSlug="demo" />);
    await fillValidForm();
    fireEvent.change(screen.getByLabelText('form.reviewTitle'), { target: { value: '  Perfekt  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.submit' }));
    await waitFor(() => expect(calls.submitLink).toHaveBeenCalledTimes(1));
    expect(calls.submitLink).toHaveBeenCalledWith('demo', {
      rating: 4,
      title: 'Perfekt',
      body: 'Snabb leverans och fin gravyr.',
      display_name: 'Anna S.',
      locale: 'sv',
      token: TOKEN,
    });
    expect(calls.submitMine).not.toHaveBeenCalled();
    expect(await screen.findByText('form.successPendingTitle')).toBeTruthy();
    expect(screen.getByText('form.successPendingText')).toBeTruthy();
    // Back to the product, by its slug in the page language.
    expect(screen.getByRole('link', { name: 'form.backToProduct' }).getAttribute('href')).toBe('/products/namnhalsband');
  });

  it('auto-published review: the "published" success state', async () => {
    calls.submitLink.mockResolvedValue({ id: 'r1', status: 'APPROVED' });
    render(<ReviewWriteClient storeSlug="demo" />);
    await fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'form.submit' }));
    expect(await screen.findByText('form.successPublishedText')).toBeTruthy();
  });

  it('an existing review is prefilled with the "back for approval" notice', async () => {
    calls.linkContext.mockResolvedValue({
      ...CONTEXT,
      review: { rating: 3, title: 'Ok', body: 'Helt okej halsband.', display_name: 'Anna', status: 'APPROVED' },
    });
    render(<ReviewWriteClient storeSlug="demo" />);
    expect(await screen.findByText('form.editingNotice')).toBeTruthy();
    expect((screen.getByRole('radio', { name: 'starsLabel:{"rating":3}' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('form.body') as HTMLTextAreaElement).value).toBe('Helt okej halsband.');
    expect((screen.getByLabelText('form.displayName') as HTMLInputElement).value).toBe('Anna');
    // A link-only buyer cannot delete (no id, no session).
    expect(screen.queryByRole('button', { name: 'form.delete' })).toBeNull();
  });

  it.each([
    ['REVIEW_LINK_INVALID', 401, 'form.linkInvalidTitle'],
    ['REVIEW_ORDER_NOT_ELIGIBLE', 409, 'form.notEligibleTitle'],
    ['STORE_APP_NOT_ENABLED', 403, 'form.unavailableTitle'],
    ['REVIEW_PRODUCT_NOT_FOUND', 404, 'form.unavailableTitle'],
  ])('context %s: a friendly full-page state, no form', async (code, status, title) => {
    calls.linkContext.mockRejectedValue(coded(code, status));
    render(<ReviewWriteClient storeSlug="demo" />);
    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'form.submit' })).toBeNull();
    expect(document.body.textContent).not.toContain('raw server text');
    expect(screen.getByRole('link', { name: 'form.backToStore' })).toBeTruthy();
  });

  it('a network failure reads as a link that does not work', async () => {
    calls.linkContext.mockRejectedValue(new Error('Failed to fetch'));
    render(<ReviewWriteClient storeSlug="demo" />);
    expect(await screen.findByText('form.linkInvalidTitle')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Failed to fetch');
  });

  it('the link expired while the form was open: full-page state on submit', async () => {
    calls.submitLink.mockRejectedValue(coded('REVIEW_LINK_INVALID', 401));
    render(<ReviewWriteClient storeSlug="demo" />);
    await fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'form.submit' }));
    expect(await screen.findByText('form.linkInvalidTitle')).toBeTruthy();
  });

  it('a filled honeypot is sent as `website` (the API then drops the post)', async () => {
    calls.submitLink.mockResolvedValue({ id: null, status: 'PENDING' });
    const { container } = render(<ReviewWriteClient storeSlug="demo" />);
    await fillValidForm();
    const trap = container.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
    fireEvent.change(trap, { target: { value: 'https://spam.example' } });
    fireEvent.click(screen.getByRole('button', { name: 'form.submit' }));
    await waitFor(() => expect(calls.submitLink).toHaveBeenCalledTimes(1));
    expect(calls.submitLink.mock.calls[0]![1].website).toBe('https://spam.example');
    expect(await screen.findByText('form.successPendingTitle')).toBeTruthy();
  });
});

describe('without a token', () => {
  it('no token and no product: the link state', async () => {
    render(<ReviewWriteClient storeSlug="demo" />);
    expect(await screen.findByText('form.linkInvalidTitle')).toBeTruthy();
    expect(calls.linkContext).not.toHaveBeenCalled();
    expect(calls.eligibility).not.toHaveBeenCalled();
  });

  it('signed out: asks to sign in, links to the login page, calls nothing', async () => {
    render(<ReviewWriteClient storeSlug="demo" productId={PRODUCT_ID} />);
    expect(await screen.findByText('form.signInRequired')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'form.signIn' }).getAttribute('href')).toBe('/auth/login');
    expect(calls.eligibility).not.toHaveBeenCalled();
  });

  it('waits for the session before deciding', async () => {
    auth.loading = true;
    const { rerender } = render(<ReviewWriteClient storeSlug="demo" productId={PRODUCT_ID} />);
    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(screen.queryByText('form.signInRequired')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
    auth.loading = false;
    auth.token = 'session';
    calls.eligibility.mockResolvedValue({ eligible: true, reason: null, display_name_suggestion: 'Erik', review: null });
    rerender(<ReviewWriteClient storeSlug="demo" productId={PRODUCT_ID} />);
    expect(await screen.findByRole('button', { name: 'form.submit' })).toBeTruthy();
    expect(calls.eligibility).toHaveBeenCalledWith('demo', PRODUCT_ID, 'session');
  });
});

describe('signed-in customer', () => {
  beforeEach(() => {
    auth.token = 'session';
    calls.eligibility.mockResolvedValue({ eligible: true, reason: null, display_name_suggestion: 'Erik J.', review: null });
  });

  it('not a buyer of the product: a friendly explanation, no form', async () => {
    calls.eligibility.mockResolvedValue({ eligible: false, reason: 'NOT_PURCHASED', display_name_suggestion: '', review: null });
    render(<ReviewWriteClient storeSlug="demo" productId={PRODUCT_ID} />);
    expect(await screen.findByText('form.notPurchased')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'form.submit' })).toBeNull();
  });

  it('an expired session asks to sign in again', async () => {
    calls.eligibility.mockRejectedValue(coded('UNAUTHORIZED', 401));
    render(<ReviewWriteClient storeSlug="demo" productId={PRODUCT_ID} />);
    expect(await screen.findByText('form.signInRequired')).toBeTruthy();
  });

  it('client validation: translated messages under the fields, nothing is sent', async () => {
    render(<ReviewWriteClient storeSlug="demo" productId={PRODUCT_ID} />);
    const submit = await screen.findByRole('button', { name: 'form.submit' });
    fireEvent.change(screen.getByLabelText('form.displayName'), { target: { value: 'erik@example.se' } });
    fireEvent.change(screen.getByLabelText('form.body'), { target: { value: 'kort' } });
    fireEvent.click(submit);
    expect(await screen.findByText('form.ratingRequired')).toBeTruthy();
    expect(screen.getByText('REVIEW_BODY_TOO_SHORT')).toBeTruthy();
    expect(screen.getByText('REVIEW_DISPLAY_NAME_INVALID')).toBeTruthy();
    expect(screen.getByLabelText('form.body').getAttribute('aria-invalid')).toBe('true');
    expect(calls.submitMine).not.toHaveBeenCalled();

    // Correcting a field removes its message.
    fireEvent.change(screen.getByLabelText('form.body'), { target: { value: 'Tillräckligt lång text.' } });
    expect(screen.queryByText('REVIEW_BODY_TOO_SHORT')).toBeNull();
    expect(screen.getByText('REVIEW_DISPLAY_NAME_INVALID')).toBeTruthy();
  });

  it('the counter follows the text', async () => {
    const { container } = render(<ReviewWriteClient storeSlug="demo" productId={PRODUCT_ID} />);
    await screen.findByRole('button', { name: 'form.submit' });
    fireEvent.change(screen.getByLabelText('form.body'), { target: { value: 'Tolv tecken!' } });
    expect(container.querySelector('[data-review-counter]')!.textContent).toBe('form.counter:{"count":12,"max":2000}');
  });

  it('submits through the account route with the product id and the session', async () => {
    calls.submitMine.mockResolvedValue({ id: 'r1', status: 'PENDING' });
    render(<ReviewWriteClient storeSlug="demo" productId={PRODUCT_ID} />);
    await fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'form.submit' }));
    await waitFor(() => expect(calls.submitMine).toHaveBeenCalledTimes(1));
    expect(calls.submitMine).toHaveBeenCalledWith(
      'demo',
      { rating: 4, body: 'Snabb leverans och fin gravyr.', display_name: 'Erik J.', locale: 'sv', product_id: PRODUCT_ID },
      'session',
    );
    expect(calls.submitLink).not.toHaveBeenCalled();
    expect(await screen.findByText('form.successPendingTitle')).toBeTruthy();
  });

  it.each([
    ['REVIEW_BODY_TOO_LONG', 'form.body'],
    ['REVIEW_TEXT_INVALID', 'form.body'],
    ['REVIEW_TITLE_TOO_LONG', 'form.reviewTitle'],
    ['REVIEW_DISPLAY_NAME_INVALID', 'form.displayName'],
  ])('server error %s is shown by code at its field', async (code, label) => {
    calls.submitMine.mockRejectedValue(coded(code));
    render(<ReviewWriteClient storeSlug="demo" productId={PRODUCT_ID} />);
    await fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'form.submit' }));
    expect(await screen.findByText(code)).toBeTruthy();
    expect(screen.getByLabelText(label).getAttribute('aria-invalid')).toBe('true');
    expect(document.body.textContent).not.toContain('raw server text');
    // The form stays, with what was typed.
    expect((screen.getByLabelText('form.body') as HTMLTextAreaElement).value).toBe('Snabb leverans och fin gravyr.');
  });

  it('other coded errors show their translation above the form; unknown ones the generic text', async () => {
    calls.submitMine.mockRejectedValueOnce(coded('CUSTOMER_STORE_MISMATCH', 403));
    render(<ReviewWriteClient storeSlug="demo" productId={PRODUCT_ID} />);
    await fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'form.submit' }));
    expect(await screen.findByText('CUSTOMER_STORE_MISMATCH')).toBeTruthy();

    calls.submitMine.mockRejectedValueOnce(coded('SOMETHING_NEW', 500));
    fireEvent.click(screen.getByRole('button', { name: 'form.submit' }));
    expect(await screen.findByText('generic')).toBeTruthy();
    expect(document.body.textContent).not.toContain('raw server text');
    expect(document.body.textContent).not.toContain('SOMETHING_NEW');
  });

  it('REVIEW_NOT_PURCHASED on submit ends on the explanation', async () => {
    calls.submitMine.mockRejectedValue(coded('REVIEW_NOT_PURCHASED', 403));
    render(<ReviewWriteClient storeSlug="demo" productId={PRODUCT_ID} />);
    await fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'form.submit' }));
    expect(await screen.findByText('form.notPurchased')).toBeTruthy();
  });

  it('the customer can delete their own review after confirming', async () => {
    calls.eligibility.mockResolvedValue({
      eligible: true,
      reason: null,
      display_name_suggestion: 'Erik J.',
      review: { id: 'r9', rating: 5, title: null, body: 'Mycket bra produkt.', display_name: 'Erik', status: 'APPROVED' },
    });
    calls.deleteMine.mockResolvedValue({ deleted: true });
    render(<ReviewWriteClient storeSlug="demo" productId={PRODUCT_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'form.delete' }));
    // Nothing is deleted before the confirmation.
    expect(calls.deleteMine).not.toHaveBeenCalled();
    expect(screen.getByText('form.deleteConfirm')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'form.delete' }));
    await waitFor(() => expect(calls.deleteMine).toHaveBeenCalledWith('demo', 'r9', 'session'));
    expect(await screen.findByText('form.deletedTitle')).toBeTruthy();
  });

  it('a token in the URL wins over the product parameter', async () => {
    setUrl(`/reviews/write?product=${PRODUCT_ID}#token=${TOKEN}`);
    calls.linkContext.mockResolvedValue(CONTEXT);
    render(<ReviewWriteClient storeSlug="demo" productId={PRODUCT_ID} />);
    await screen.findByRole('button', { name: 'form.submit' });
    expect(calls.linkContext).toHaveBeenCalledTimes(1);
    expect(calls.eligibility).not.toHaveBeenCalled();
    expect(window.location.search).toBe(`?product=${PRODUCT_ID}`);
    expect(window.location.hash).toBe('');
  });
});
