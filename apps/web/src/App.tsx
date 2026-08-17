import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { LoginPage } from './pages/LoginPage';
import { StaffShell } from './shell/StaffShell';
import { TicketCreate } from './tickets/TicketCreate';
import { TicketDetail } from './tickets/TicketDetail';
import { TicketList } from './tickets/TicketList';

function AuthGate({
  allow,
  children,
}: {
  allow: 'guest' | 'user';
  children: ReactNode;
}) {
  const { user, isReady } = useAuth();
  if (!isReady) {
    return null;
  }
  if (allow === 'guest') {
    return user ? <Navigate to="/" replace /> : children;
  }
  return user ? children : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <MantineProvider defaultColorScheme="light">
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <AuthGate allow="guest">
                <LoginPage />
              </AuthGate>
            }
          />
          <Route
            path="/"
            element={
              <AuthGate allow="user">
                <StaffShell />
              </AuthGate>
            }
          >
            <Route index element={<TicketList />} />
            <Route path="tickets/new" element={<TicketCreate />} />
            <Route path="tickets/:id" element={<TicketDetail />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MantineProvider>
  );
}
