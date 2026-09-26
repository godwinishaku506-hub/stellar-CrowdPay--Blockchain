import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TransactionHistory from './TransactionHistory';

vi.mock('../services/api', () => ({
  api: {
    getStellarTransactions: vi.fn(),
  },
}));

import { api } from '../services/api';

afterEach(() => {
  vi.clearAllMocks();
});

describe('TransactionHistory', () => {
  it('renders on-chain rows returned by getStellarTransactions', async () => {
    api.getStellarTransactions.mockResolvedValue([
      {
        id: 'st-1',
        kind: 'contribution',
        status: 'indexed',
        tx_hash: 'abcdef12hash99',
        created_at: new Date().toISOString(),
      },
      {
        id: 'st-2',
        kind: 'withdrawal',
        status: 'failed',
        tx_hash: null,
        failure_reason: 'Horizon timeout',
        created_at: new Date().toISOString(),
      },
    ]);

    render(<TransactionHistory campaignId="camp-1" isCreator />);

    await waitFor(() => {
      expect(screen.getByText('Contribution')).toBeInTheDocument();
    });
    expect(screen.getByText('Indexed')).toBeInTheDocument();
    expect(screen.getByText('Withdrawal')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/Horizon timeout/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View on Stellar Expert/ })).toHaveAttribute(
      'href',
      expect.stringContaining('abcdef12hash99'),
    );
    expect(api.getStellarTransactions).toHaveBeenCalledWith({
      campaignId: 'camp-1',
      limit: 11,
    });
  });
});
