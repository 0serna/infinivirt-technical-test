import { MantineProvider } from '@mantine/core';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { LoginPage } from './pages/LoginPage';
import { GuestRoute, ProtectedRoute } from './routes/AuthRoutes';
import { StaffShell } from './shell/StaffShell';

export function App() {
  return (
    <MantineProvider defaultColorScheme="light">
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <StaffShell />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MantineProvider>
  );
}
