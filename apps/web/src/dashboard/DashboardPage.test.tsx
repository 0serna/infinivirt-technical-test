import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  alex,
  emptyTickets,
  isDashboardUrl,
  jsonResponse,
  mockAuthedSession,
  renderApp,
  sam,
  sampleAgentDashboard,
  sampleTeamDashboard,
} from '../test/render-app';

beforeEach(() => {
  localStorage.setItem('accessToken', 'token-abc');
});

test('authenticated / redirects to /dashboard', async () => {
  mockAuthedSession(emptyTickets, alex);

  renderApp(['/'], { probeLocation: true });

  expect(
    await screen.findByRole('heading', { name: 'Operational Dashboard' }),
  ).toBeDefined();
  expect(screen.getByTestId('location-path').textContent).toBe('/dashboard');
  expect(screen.queryByRole('heading', { name: 'Tickets' })).toBeNull();
});

test('Agent dashboard shows Open Ticket Assignee KPI deep-link and short table rows to consult', async () => {
  mockAuthedSession(emptyTickets, alex);

  renderApp(['/dashboard']);

  expect(
    await screen.findByRole('heading', { name: 'Operational Dashboard' }),
  ).toBeDefined();
  expect(await screen.findByText('Active Tickets (Assignee)')).toBeDefined();

  const countLink = screen.getByRole('link', {
    name: 'Active Tickets (Assignee) 2',
  });
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

  expect(
    await screen.findByText('Loading Operational Dashboard…'),
  ).toBeDefined();

  resolveDashboard?.(jsonResponse(500, { message: 'error' }));
  expect(
    await screen.findByText("Couldn't load the Operational Dashboard."),
  ).toBeDefined();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
});

test('dashboard Try again refetches after a failure', async () => {
  const user = userEvent.setup();
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

  expect(
    await screen.findByText("Couldn't load the Operational Dashboard."),
  ).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Try again' }));

  expect(await screen.findByText('Active Tickets (Assignee)')).toBeDefined();
  expect(
    screen.getByRole('link', { name: 'Active Tickets (Assignee) 2' }),
  ).toBeDefined();
});

test('team dashboard shows KPI strip deep-links and Stale short table', async () => {
  mockAuthedSession(emptyTickets, sam, undefined, sampleTeamDashboard);

  renderApp(['/dashboard']);

  expect(
    await screen.findByRole('heading', { name: 'Operational Dashboard' }),
  ).toBeDefined();
  expect(screen.queryByText(/Team metrics are not available/i)).toBeNull();
  expect(screen.queryByText('Active Tickets (Assignee)')).toBeNull();

  expect(await screen.findByText('Active Tickets')).toBeDefined();
  expect(
    screen.getByRole('link', { name: 'Active Tickets 5' }).getAttribute('href'),
  ).toBe('/tickets?status=open,in_progress');
  expect(
    screen.getByRole('link', { name: 'Open 3' }).getAttribute('href'),
  ).toBe('/tickets?status=open');
  expect(
    screen.getByRole('link', { name: 'In progress 2' }).getAttribute('href'),
  ).toBe('/tickets?status=in_progress');
  expect(
    screen.getByRole('link', { name: 'Stale 4' }).getAttribute('href'),
  ).toBe('/tickets?stale=1');

  expect(screen.getByRole('heading', { name: 'Stale Tickets' })).toBeDefined();

  const table = screen.getByRole('table');
  expect(
    within(table)
      .getByRole('link', { name: 'Stale open: billing portal timeout' })
      .getAttribute('href'),
  ).toBe('/tickets/ticket-stale-billing');
  expect(
    within(table)
      .getByRole('link', { name: 'Resolved: gift-card balance mismatch' })
      .getAttribute('href'),
  ).toBe('/tickets/ticket-gift-card');
  expect(within(table).getByText('Resolved')).toBeDefined();
});
