import { AppShell, Button, Group, Text, Title } from '@mantine/core';
import { apiFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { ROLE_LABEL } from '../auth/role-label';

export function StaffShell() {
  const { user, signOut } = useAuth();
  if (!user) {
    return null;
  }

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={1} size="h3">
            Support Ticketing
          </Title>
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
        <Text>You are signed in as {user.displayName}.</Text>
        <Button
          type="button"
          variant="default"
          mt="md"
          onClick={() => {
            void apiFetch('/api/auth/me');
          }}
        >
          Refresh
        </Button>
      </AppShell.Main>
    </AppShell>
  );
}
