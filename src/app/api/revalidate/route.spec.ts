import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }));
vi.mock('@/lib/api', () => ({ storeTag: (slug: string) => `store:${slug}` }));

// The API calls this route after a mutation. The tagged entries must expire
// at once: a stale-while-revalidate profile keeps a deleted product's old 200
// body forever, because its refetch answers 404 and is never cached.

function request(body: unknown, secret: string | null = 's3cret') {
  return {
    headers: { get: (name: string) => (name === 'x-revalidate-secret' ? secret : null) },
    json: async () => {
      if (body === undefined) throw new Error('bad json');
      return body;
    },
  } as never;
}

describe('POST /api/revalidate', () => {
  const env = process.env.REVALIDATE_SECRET;
  beforeEach(() => {
    process.env.REVALIDATE_SECRET = 's3cret';
    revalidateTag.mockClear();
  });
  afterEach(() => {
    process.env.REVALIDATE_SECRET = env;
  });

  it('expires a store tag immediately, never with a stale-while-revalidate profile', async () => {
    const { POST } = await import('./route');
    const res = await POST(request({ slug: 'my-store' }));
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith('store:my-store', { expire: 0 });
  });

  it('expires a platform legal tag immediately', async () => {
    const { POST } = await import('./route');
    for (const tag of ['legal', 'legal:terms']) {
      revalidateTag.mockClear();
      const res = await POST(request({ tag }));
      expect(res.status).toBe(200);
      expect(revalidateTag).toHaveBeenCalledWith(tag, { expire: 0 });
    }
  });

  it('refuses an unknown tag, a missing slug, a wrong secret and invalid JSON without purging', async () => {
    const { POST } = await import('./route');
    expect((await POST(request({ tag: 'store:other' }))).status).toBe(400);
    expect((await POST(request({}))).status).toBe(400);
    expect((await POST(request({ slug: 'my-store' }, 'wrong'))).status).toBe(401);
    expect((await POST(request(undefined))).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('answers 500 when the secret is not configured', async () => {
    delete process.env.REVALIDATE_SECRET;
    const { POST } = await import('./route');
    expect((await POST(request({ slug: 'my-store' }))).status).toBe(500);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
