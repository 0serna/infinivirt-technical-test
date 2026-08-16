import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { ReactNode } from 'react';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isReady, loginRedirectState } = useAuth();
  if (!isReady) {
    return null;
  }
  if (!user) {
    return (
      <Navigate to="/login" replace state={loginRedirectState ?? undefined} />
    );
  }
  return children;
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const { user, isReady } = useAuth();
  if (!isReady) {
    return null;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return children;
}
