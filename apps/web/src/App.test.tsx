import { render, screen } from '@testing-library/react';
import { App } from './App';

test('placeholder shows Support Ticketing health from /api/health', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    }),
  );

  render(<App />);

  expect(await screen.findByText('ok')).toBeDefined();
  expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/health');
});
