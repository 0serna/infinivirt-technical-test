import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Role } from '@support-ticketing/shared';
import {
  ACCESS_TOKEN_KEY,
  apiFetch,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  setUnauthorizedListener,
} from './api';

export type SignInResult = 'ok' | 'unauthorized' | 'unreachable';

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
};

type AuthValue = {
  user: PublicUser | null;
  isReady: boolean;
  sessionExpired: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

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
      if (event.key !== ACCESS_TOKEN_KEY || event.newValue != null) {
        return;
      }
      clearAccessToken();
      setSessionExpired(false);
      setUser(null);
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
      setSessionExpired(true);
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
        setSessionExpired(false);
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
    setSessionExpired(false);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isReady, sessionExpired, signIn, signOut }),
    [user, isReady, sessionExpired, signIn, signOut],
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
