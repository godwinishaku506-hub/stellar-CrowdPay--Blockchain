import { describe, it, expect, vi, afterEach } from 'vitest';
import { shareOnX } from '../utils/shareOnX';

describe('shareOnX', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens exactly one tab with noopener,noreferrer', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    shareOnX('Back this & more');
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      'https://twitter.com/intent/tweet?text=Back%20this%20%26%20more',
      '_blank',
      'noopener,noreferrer'
    );
  });
});
