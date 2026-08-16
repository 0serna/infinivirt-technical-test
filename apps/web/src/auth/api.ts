import { clearAccessToken, getAccessToken } from './token';

type UnauthorizedListener = () => void;

let unauthorizedListener: UnauthorizedListener | null = null;

export function setUnauthorizedListener(
  listener: UnauthorizedListener | null,
): void {
  unauthorizedListener = listener;
}

export async function apiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 && input !== '/api/auth/login') {
    clearAccessToken();
    unauthorizedListener?.();
  }
  return response;
}
