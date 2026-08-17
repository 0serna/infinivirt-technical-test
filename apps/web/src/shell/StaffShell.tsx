import { AppShell, Button, Group, Text, Title } from '@mantine/core';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const ROLE_LABEL = {
  agent: 'Agent',
  supervisor: 'Supervisor',
  admin: 'Administrator',
} as const;

export function StaffShell() {
  const { user, signOut } = useAuth();
  if (!user) {
    return null;
  }

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Title order={1} size="h3">
              <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
                Support Ticketing
              </Link>
            </Title>
            <Group gap="md">
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/tickets">Tickets</Link>
              {user.role === 'admin' ? (
                <Link to="/admin/clients">Clients</Link>
              ) : null}
            </Group>
          </Group>
          <Group>
            <Text>{user.displayName}</Text>
            <Text>{ROLE_LABEL[user.role]}</Text>
            <Button type="button" variant="default" onClick={signOut}>
              Sign out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
