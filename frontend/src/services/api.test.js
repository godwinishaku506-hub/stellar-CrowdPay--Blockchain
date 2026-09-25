import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from './api';

function mockFetch(data) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('getCampaignCategories calls the categories endpoint', async () => {
    const fetchFn = mockFetch([{ category: 'arts', count: 2 }]);
    await expect(api.getCampaignCategories()).resolves.toEqual([{ category: 'arts', count: 2 }]);
    expect(fetchFn.mock.calls[0][0]).toMatch(/\/api\/campaigns\/categories$/);
  });

  it('getCloneData maps a campaign to create-form prefill', async () => {
    mockFetch({
      id: 'c1',
      title: 'T',
      description: 'D',
      target_amount: '100',
      asset_type: 'XLM',
      min_contribution: null,
      show_backer_amounts: false,
      category: 'arts',
      status: 'active',
    });
    const data = await api.getCloneData('c1');
    expect(data).toMatchObject({
      title: 'T',
      description: 'D',
      target_amount: '100',
      asset_type: 'XLM',
      min_contribution: '',
      show_backer_amounts: false,
      category: 'arts',
    });
    expect(data).not.toHaveProperty('id');
    expect(data).not.toHaveProperty('status');
  });

  it('updateMe sends a cookie-authenticated PATCH without a bearer token', async () => {
    const fetchFn = mockFetch({ name: 'New' });
    await api.updateMe({ name: 'New' });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toMatch(/\/api\/users\/me$/);
    expect(init.method).toBe('PATCH');
    expect(init.credentials).toBe('include');
    expect(JSON.stringify(init.headers || {})).not.toMatch(/Bearer/);
  });
});
