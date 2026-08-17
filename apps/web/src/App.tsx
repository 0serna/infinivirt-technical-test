import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminClientsPage } from './admin/AdminClientsPage';
import { AdminUsersPage } from './admin/AdminUsersPage';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { LoadingState } from './components/LoadingState';
import { DashboardPage } from './dashboard/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { StaffShell } from './shell/StaffShell';
import { theme } from './theme';
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
    return <LoadingState label="Loading…" mih="100vh" />;
  }
  if (allow === 'guest') {
    return user ? <Navigate to="/dashboard" replace /> : children;
  }
  return user ? children : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme="light"
      env={import.meta.env.MODE === 'test' ? 'test' : undefined}
    >
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
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="tickets" element={<TicketList />} />
            <Route path="tickets/:id" element={<TicketDetail />} />
            <Route path="admin/clients" element={<AdminClientsPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MantineProvider>
  );
}
