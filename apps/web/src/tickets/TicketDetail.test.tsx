import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ada,
  isTicketDetailUrl,
  jsonResponse,
  renderApp,
  sampleReopenedTicketDetail,
  sampleTicketDetail,
  sampleTickets,
  unauthorized,
} from '../test/render-app';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function mockTicketSession(detail: unknown = sampleTicketDetail) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (url === '/api/tickets' || url.startsWith('/api/tickets?')) {
      return jsonResponse(200, sampleTickets);
    }
    if (isTicketDetailUrl(url)) {
      return jsonResponse(200, detail);
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

test('signed-in Ticket consult is inside the staff shell and loads GET /api/tickets/:id', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockTicketSession();

  renderApp(['/tickets/ticket-1']);

  expect(
    await screen.findByRole('heading', {
      name: 'High: patient portal MFA reset',
    }),
  ).toBeDefined();
  expect(
    screen.getByRole('heading', { name: 'Support Ticketing' }),
  ).toBeDefined();
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();

  const detailCall = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => url === '/api/tickets/ticket-1');
  expect(detailCall).toBeDefined();
  expect(new Headers(detailCall?.[1]?.headers).get('Authorization')).toBe(
    'Bearer token-abc',
  );
});

test('Ticket consult shows current fields and Status Transition history oldest first', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  mockTicketSession(sampleReopenedTicketDetail);

  renderApp(['/tickets/ticket-3']);

  expect(
    await screen.findByRole('heading', {
      name: 'Reopened: returns portal blank page',
    }),
  ).toBeDefined();
  expect(screen.queryByText('MFA reset emails not arriving.')).toBeNull();
  expect(
    screen.getByText(
      'Was closed after hotfix; Client reports regression. Projection timestamps cleared on reopen.',
    ),
  ).toBeDefined();
  expect(screen.getByText('Status: Open')).toBeDefined();
  expect(screen.getByText('Priority: High')).toBeDefined();
  expect(screen.getByText('Client: Northwind Retail')).toBeDefined();
  expect(screen.getByText('Assignee: Alex Agent')).toBeDefined();
  expect(screen.queryByText('Waiting on Client network details.')).toBeNull();
  expect(screen.queryByRole('button', { name: /in progress/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /assign/i })).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();

  const history = screen.getByRole('table', { name: 'Status history' });
  const rows = within(history).getAllByRole('row');
  expect(within(rows[0]).getByText('From')).toBeDefined();
  expect(within(rows[0]).getByText('To')).toBeDefined();
  expect(within(rows[1]).getByText('—')).toBeDefined();
  expect(within(rows[1]).getByText('Open')).toBeDefined();
  expect(within(rows[2]).getByText('In progress')).toBeDefined();
  expect(within(rows[5]).getByText('Closed')).toBeDefined();
  expect(within(rows[5]).getAllByText('Open').length).toBeGreaterThan(0);
  expect(within(history).getAllByText('Ada Lovelace').length).toBe(2);
});

test('in-flight Ticket consult shows loading before fields', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  let resolveDetail!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    resolveDetail = resolve;
  });
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketDetailUrl(url)) {
      return pending;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/ticket-1']);

  expect(await screen.findByText('Loading ticket…')).toBeDefined();
  expect(screen.queryByText('High: patient portal MFA reset')).toBeNull();

  await act(async () => {
    resolveDetail(jsonResponse(200, sampleTicketDetail));
  });

  expect(
    await screen.findByRole('heading', {
      name: 'High: patient portal MFA reset',
    }),
  ).toBeDefined();
  expect(screen.queryByText('Loading ticket…')).toBeNull();
});

test('missing Ticket consult shows not-found copy without the raw server body', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketDetailUrl(url)) {
      return jsonResponse(404, {
        message: 'Cannot GET warehouse scanner pairing',
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/ticket-missing']);

  expect(await screen.findByText('Ticket not found.')).toBeDefined();
  expect(screen.queryByText(/warehouse scanner/)).toBeNull();
});

test('failed Ticket consult fetch shows error copy and can retry', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  let detailCalls = 0;
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketDetailUrl(url)) {
      detailCalls += 1;
      if (detailCalls === 1) {
        return jsonResponse(500, { message: 'Internal boom stack' });
      }
      return jsonResponse(200, sampleTicketDetail);
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/ticket-1']);

  expect(await screen.findByText("Couldn't load this ticket.")).toBeDefined();
  expect(screen.queryByText('Internal boom stack')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Try again' }));

  expect(
    await screen.findByRole('heading', {
      name: 'High: patient portal MFA reset',
    }),
  ).toBeDefined();
  expect(screen.queryByText("Couldn't load this ticket.")).toBeNull();
  expect(detailCalls).toBe(2);
});

test('Ticket consult 401 signs the User out', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return jsonResponse(200, ada);
    }
    if (isTicketDetailUrl(url)) {
      return unauthorized;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/tickets/ticket-1']);

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(
    await screen.findByText('Your session expired. Sign in again.'),
  ).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();
});

test('staff shell title returns to the Ticket List', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  mockTicketSession();

  renderApp(['/tickets/ticket-1']);

  expect(
    await screen.findByRole('heading', {
      name: 'High: patient portal MFA reset',
    }),
  ).toBeDefined();
  await user.click(screen.getByRole('link', { name: 'Support Ticketing' }));
  expect(await screen.findByRole('heading', { name: 'Tickets' })).toBeDefined();
  expect(screen.getByText('High: patient portal MFA reset')).toBeDefined();
});
