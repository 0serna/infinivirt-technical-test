import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  alex,
  emptyTickets,
  isDashboardUrl,
  jsonResponse,
  mockAuthedSession,
  renderApp,
  sampleAgentDashboard,
} from '../test/render-app';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('authenticated / redirects to /dashboard', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(emptyTickets, alex);

  renderApp(['/'], { probeLocation: true });

  expect(
    await screen.findByRole('heading', { name: 'Dashboard' }),
  ).toBeDefined();
  expect(screen.getByTestId('location-path').textContent).toBe('/dashboard');
  expect(screen.queryByRole('heading', { name: 'Tickets' })).toBeNull();
});

test('Agent dashboard shows Open-assigned KPI deep-link and short table rows to consult', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockAuthedSession(emptyTickets, alex);

  renderApp(['/dashboard']);

  expect(
    await screen.findByRole('heading', { name: 'Dashboard' }),
  ).toBeDefined();
  expect(screen.getByText('Open assigned')).toBeDefined();

  const countLink = screen.getByRole('link', { name: '2' });
  expect(countLink.getAttribute('href')).toBe('/tickets?scope=assignedOpen');

  const table = screen.getByRole('table');
  expect(
    within(table)
      .getByRole('link', {
        name: 'In progress: shipment tracking API',
      })
      .getAttribute('href'),
  ).toBe('/tickets/ticket-ship');
  expect(
    within(table)
      .getByRole('link', {
        name: 'Open: webhook signature mismatch',
      })
      .getAttribute('href'),
  ).toBe('/tickets/ticket-webhook');
  expect(within(table).getByText('In progress')).toBeDefined();
  expect(within(table).getByText('Open')).toBeDefined();
  expect(within(table).getByText('Acme Logistics')).toBeDefined();
  expect(screen.getByRole('link', { name: 'Dashboard' })).toBeDefined();
  expect(screen.getByRole('link', { name: 'Tickets' })).toBeDefined();
});

test('dashboard loading and error states use English copy', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  let resolveDashboard: ((value: Response) => void) | undefined;
  const dashboardPromise = new Promise<Response>((resolve) => {
    resolveDashboard = resolve;
  });

  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, alex);
    }
    if (isDashboardUrl(url)) {
      return dashboardPromise;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/dashboard']);

  expect(await screen.findByText('Loading dashboard…')).toBeDefined();

  resolveDashboard?.(jsonResponse(500, { message: 'error' }));
  expect(await screen.findByText("Couldn't load dashboard.")).toBeDefined();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
});

test('dashboard Try again refetches after a failure', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  let dashboardCalls = 0;

  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, alex);
    }
    if (isDashboardUrl(url)) {
      dashboardCalls += 1;
      if (dashboardCalls === 1) {
        return jsonResponse(500, { message: 'error' });
      }
      return jsonResponse(200, sampleAgentDashboard);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/dashboard']);

  expect(await screen.findByText("Couldn't load dashboard.")).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Try again' }));

  expect(await screen.findByText('Open assigned')).toBeDefined();
  expect(screen.getByRole('link', { name: '2' })).toBeDefined();
});
