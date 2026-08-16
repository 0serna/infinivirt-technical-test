import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

function renderApp(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test('empty login shows required-field copy without calling the API', async () => {
  const user = userEvent.setup();
  renderApp(['/login']);

  expect(screen.getByLabelText('Email')).toHaveProperty('type', 'email');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(screen.getByText('Email and password are required.')).toBeDefined();
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
});

test('opaque login 401 shows Sign in failed without echoing the server body', async () => {
  const user = userEvent.setup();
  vi.mocked(fetch).mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ statusCode: 401, message: 'Unauthorized' }),
  } as Response);

  renderApp(['/login']);

  await user.type(screen.getByLabelText('Email'), 'agent@example.com');
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('Sign in failed.')).toBeDefined();
  expect(screen.queryByText('Unauthorized')).toBeNull();
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe('/api/auth/login');
  expect(init?.method).toBe('POST');
  expect(JSON.parse(String(init?.body))).toEqual({
    email: 'agent@example.com',
    password: 'secret',
  });
});

test('login network failure shows server unreachable copy', async () => {
  const user = userEvent.setup();
  vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

  renderApp(['/login']);

  await user.type(screen.getByLabelText('Email'), 'agent@example.com');
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(
    await screen.findByText("Can't reach the server. Try again."),
  ).toBeDefined();
});

const ada = {
  id: 'user-1',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  role: 'admin' as const,
};

test('successful login shows the shell and later fetches send Bearer', async () => {
  const user = userEvent.setup();
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/login') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ accessToken: 'token-abc', user: ada }),
      } as Response;
    }
    if (url === '/api/auth/me') {
      return {
        ok: true,
        status: 200,
        json: async () => ada,
      } as Response;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  const { unmount } = renderApp(['/login']);

  await user.type(screen.getByLabelText('Email'), ada.email);
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(
    await screen.findByRole('heading', { name: 'Support Ticketing' }),
  ).toBeDefined();
  expect(screen.getByText('Ada Lovelace')).toBeDefined();
  expect(screen.getByText('Administrator')).toBeDefined();
  expect(screen.queryByText(/API health/)).toBeNull();
  expect(localStorage.getItem('accessToken')).toBe('token-abc');

  unmount();
  renderApp(['/']);

  expect(await screen.findByText('Ada Lovelace')).toBeDefined();
  const meCall = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => url === '/api/auth/me');
  expect(meCall).toBeDefined();
  expect(meCall?.[1]?.method ?? 'GET').toBe('GET');
  const headers = new Headers(meCall?.[1]?.headers);
  expect(headers.get('Authorization')).toBe('Bearer token-abc');
});

test('bootstrap with a valid token hydrates the shell from /api/auth/me', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ada,
  } as Response);

  renderApp(['/']);

  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  expect(await screen.findByText('Ada Lovelace')).toBeDefined();
  expect(screen.getByText('Administrator')).toBeDefined();
  expect(
    screen.getByRole('heading', { name: 'Support Ticketing' }),
  ).toBeDefined();

  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe('/api/auth/me');
  expect(init?.method ?? 'GET').toBe('GET');
  expect(new Headers(init?.headers).get('Authorization')).toBe(
    'Bearer token-abc',
  );
});

test('bootstrap 401 clears the token and shows login without an expiry message', async () => {
  localStorage.setItem('accessToken', 'dead-token');
  vi.mocked(fetch).mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ statusCode: 401, message: 'Unauthorized' }),
  } as Response);

  renderApp(['/']);

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(screen.queryByText('Your session expired. Sign in again.')).toBeNull();
  expect(screen.queryByText('Unauthorized')).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();

  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe('/api/auth/me');
  expect(new Headers(init?.headers).get('Authorization')).toBe(
    'Bearer dead-token',
  );
});

test('sign out returns to login and later requests do not send Bearer', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      return {
        ok: true,
        status: 200,
        json: async () => ada,
      } as Response;
    }
    if (url === '/api/auth/login') {
      return {
        ok: false,
        status: 401,
        json: async () => ({ statusCode: 401, message: 'Unauthorized' }),
      } as Response;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/']);

  await user.click(await screen.findByRole('button', { name: 'Sign out' }));

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();

  vi.mocked(fetch).mockClear();
  await user.type(screen.getByLabelText('Email'), ada.email);
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('Sign in failed.')).toBeDefined();
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe('/api/auth/login');
  expect(new Headers(init?.headers).get('Authorization')).toBeNull();
});

test('authenticated visit to /login is sent to the shell at /', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ada,
  } as Response);

  renderApp(['/login']);

  expect(await screen.findByRole('button', { name: 'Sign out' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  expect(screen.getByText('Ada Lovelace')).toBeDefined();
  expect(
    screen.getByRole('heading', { name: 'Support Ticketing' }),
  ).toBeDefined();
});

test('unauthenticated visit to / is sent to login without showing the shell', async () => {
  renderApp(['/']);

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(
    screen.queryByRole('heading', { name: 'Support Ticketing' }),
  ).toBeNull();
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
});

test('mid-session 401 shows the session expired alert on login', async () => {
  const user = userEvent.setup();
  localStorage.setItem('accessToken', 'token-abc');
  let meCalls = 0;
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/auth/me') {
      meCalls += 1;
      if (meCalls === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ada,
        } as Response;
      }
      return {
        ok: false,
        status: 401,
        json: async () => ({ statusCode: 401, message: 'Unauthorized' }),
      } as Response;
    }
    throw new Error(`unexpected fetch ${url}`);
  });

  renderApp(['/']);

  await user.click(await screen.findByRole('button', { name: 'Refresh' }));

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(
    await screen.findByText('Your session expired. Sign in again.'),
  ).toBeDefined();
  expect(screen.queryByText('Unauthorized')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();
});

test('clearing the token from another tab leaves the shell', async () => {
  localStorage.setItem('accessToken', 'token-abc');
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ada,
  } as Response);

  renderApp(['/']);

  expect(await screen.findByRole('button', { name: 'Sign out' })).toBeDefined();

  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'accessToken',
        oldValue: 'token-abc',
        newValue: null,
      }),
    );
  });

  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  expect(screen.queryByText('Your session expired. Sign in again.')).toBeNull();
  expect(localStorage.getItem('accessToken')).toBeNull();
});
