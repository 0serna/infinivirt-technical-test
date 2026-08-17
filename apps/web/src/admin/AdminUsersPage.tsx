import {
  Alert,
  Button,
  Group,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  ROLES,
  type CreateUserBody,
  type Role,
  type UserCatalogRow,
} from '@support-ticketing/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';

type ListState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; users: UserCatalogRow[] };

const ROLE_OPTIONS = [
  { value: 'agent', label: 'Agent' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin', label: 'Administrator' },
] as const;

function roleLabel(role: Role): string {
  switch (role) {
    case 'agent':
      return 'Agent';
    case 'supervisor':
      return 'Supervisor';
    case 'admin':
      return 'Administrator';
  }
}

export function AdminUsersPage() {
  const { user } = useAuth();
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role | null>('agent');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken retriggers fetch on Try again
  useEffect(() => {
    if (user?.role !== 'admin') {
      return;
    }
    let cancelled = false;

    void apiFetch('/api/users')
      .then(async (response) => {
        if (cancelled || response.status === 401) {
          return;
        }
        if (!response.ok) {
          setList({ kind: 'error' });
          return;
        }
        const body = (await response.json()) as unknown;
        setList({
          kind: 'ready',
          users: Array.isArray(body) ? (body as UserCatalogRow[]) : [],
        });
      })
      .catch(() => {
        if (!cancelled) {
          setList({ kind: 'error' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken, user?.role]);

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedDisplayName = displayName.trim();
    const trimmedPassword = password.trim();

    if (trimmedEmail === '') {
      setFormError('Email is required.');
      return;
    }
    if (trimmedDisplayName === '') {
      setFormError('Display name is required.');
      return;
    }
    if (role === null || !(ROLES as readonly string[]).includes(role)) {
      setFormError('Role is required.');
      return;
    }
    if (trimmedPassword === '') {
      setFormError('Password is required.');
      return;
    }

    setFormError(null);
    setSubmitting(true);

    const body: CreateUserBody = {
      email: trimmedEmail,
      displayName: trimmedDisplayName,
      role,
      password: trimmedPassword,
    };

    try {
      const response = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        return;
      }
      if (response.status === 409) {
        setFormError('A User with this email already exists.');
        return;
      }
      if (!response.ok) {
        setFormError("Couldn't create this User.");
        return;
      }
      const created = (await response.json()) as UserCatalogRow;
      setEmail('');
      setDisplayName('');
      setRole('agent');
      setPassword('');
      setList((current) => {
        if (current.kind !== 'ready') {
          return current;
        }
        if (current.users.some((row) => row.id === created.id)) {
          return current;
        }
        const users = [...current.users, created].sort((a, b) =>
          a.displayName.localeCompare(b.displayName),
        );
        return { kind: 'ready', users };
      });
    } catch {
      setFormError("Couldn't create this User.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack>
      <Title order={2}>Users</Title>
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <Group align="flex-end" grow>
            <TextInput
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
            <TextInput
              label="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.currentTarget.value)}
            />
          </Group>
          <Group align="flex-end" grow>
            <Select
              label="Role"
              data={[...ROLE_OPTIONS]}
              value={role}
              onChange={(value) => setRole(value as Role | null)}
            />
            <PasswordInput
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            <Button type="submit" loading={submitting}>
              Create User
            </Button>
          </Group>
        </Stack>
      </form>
      {formError ? <Alert color="red">{formError}</Alert> : null}
      {list.kind === 'error' ? (
        <Alert>
          <Stack gap="sm">
            <Text>Couldn't load Users.</Text>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setList({ kind: 'loading' });
                setReloadToken((token) => token + 1);
              }}
            >
              Try again
            </Button>
          </Stack>
        </Alert>
      ) : list.kind === 'loading' ? (
        <Text>Loading Users…</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Email</Table.Th>
              <Table.Th>Display name</Table.Th>
              <Table.Th>Role</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {list.users.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.email}</Table.Td>
                <Table.Td>{row.displayName}</Table.Td>
                <Table.Td>{roleLabel(row.role)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
