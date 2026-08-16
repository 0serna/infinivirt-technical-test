import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, setUnauthorizedListener } from './api';
import type { PublicUser } from './public-user';
import {
  ACCESS_TOKEN_KEY,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from './token';

export type SignInResult = 'ok' | 'unauthorized' | 'unreachable';

export type LoginRedirectState = { sessionExpired: true } | null;

type AuthValue = {
  user: PublicUser | null;
  isReady: boolean;
  loginRedirectState: LoginRedirectState;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loginRedirectState, setLoginRedirectState] =
    useState<LoginRedirectState>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsReady(true);
      return;
    }

    let cancelled = false;

    void apiFetch('/api/auth/me')
      .then(async (response) => {
        if (cancelled) {
          return;
        }
        if (response.status === 401) {
          clearAccessToken();
          setUser(null);
          setIsReady(true);
          return;
        }
        if (!response.ok) {
          setIsReady(true);
          return;
        }
        const me = (await response.json()) as PublicUser;
        setUser(me);
        setIsReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== ACCESS_TOKEN_KEY) {
        return;
      }
      if (event.newValue == null) {
        clearAccessToken();
        setLoginRedirectState(null);
        setUser(null);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUnauthorizedListener(null);
      return;
    }
    setUnauthorizedListener(() => {
      setLoginRedirectState({ sessionExpired: true });
      setUser(null);
    });
    return () => {
      setUnauthorizedListener(null);
    };
  }, [user]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      try {
        const response = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (response.status === 401) {
          return 'unauthorized';
        }
        if (!response.ok) {
          return 'unreachable';
        }
        const data = (await response.json()) as {
          accessToken: string;
          user: PublicUser;
        };
        setAccessToken(data.accessToken);
        setLoginRedirectState(null);
        setUser(data.user);
        return 'ok';
      } catch {
        return 'unreachable';
      }
    },
    [],
  );

  const signOut = useCallback(() => {
    clearAccessToken();
    setLoginRedirectState(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isReady, loginRedirectState, signIn, signOut }),
    [user, isReady, loginRedirectState, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
