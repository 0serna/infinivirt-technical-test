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
  type AdminUserRow,
  type CreateUserBody,
  type ResetPasswordBody,
  type Role,
  type UpdateUserBody,
} from '@support-ticketing/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { ROLE_LABEL } from '../users/roleLabels';

type ListState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; users: AdminUserRow[] };

type RowAction = 'soft-delete' | 'restore';

const ROLE_OPTIONS = ROLES.map((value) => ({
  value,
  label: ROLE_LABEL[value],
}));

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken retriggers fetch on Try again
  useEffect(() => {
    if (user?.role !== 'admin') {
      return;
    }
    let cancelled = false;

    void apiFetch('/api/users?includeDeleted=true')
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
          users: Array.isArray(body) ? (body as AdminUserRow[]) : [],
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

  function upsertUser(updated: AdminUserRow) {
    setList((current) => {
      if (current.kind !== 'ready') {
        return current;
      }
      const without = current.users.filter((row) => row.id !== updated.id);
      const users = [...without, updated].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      );
      return { kind: 'ready', users };
    });
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
      const created = (await response.json()) as AdminUserRow;
      setEmail('');
      setDisplayName('');
      setRole('agent');
      setPassword('');
      upsertUser(created);
    } catch {
      setFormError("Couldn't create this User.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit(target: AdminUserRow) {
    const trimmedDisplayName = editDisplayName.trim();
    if (trimmedDisplayName === '') {
      setRowError('Display name is required.');
      return;
    }
    if (editRole === null || !(ROLES as readonly string[]).includes(editRole)) {
      setRowError('Role is required.');
      return;
    }

    setRowError(null);
    setBusyId(target.id);

    const body: UpdateUserBody = {
      displayName: trimmedDisplayName,
      role: editRole,
    };

    try {
      const response = await apiFetch(`/api/users/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        return;
      }
      if (response.status === 409) {
        setRowError(
          target.role === 'admin' && editRole !== 'admin'
            ? 'Cannot demote the last Administrator.'
            : "Couldn't update this User.",
        );
        return;
      }
      if (!response.ok) {
        setRowError("Couldn't update this User.");
        return;
      }
      const updated = (await response.json()) as AdminUserRow;
      upsertUser(updated);
      setEditingId(null);
      setEditDisplayName('');
      setEditRole(null);
    } catch {
      setRowError("Couldn't update this User.");
    } finally {
      setBusyId(null);
    }
  }

  async function savePasswordReset(target: AdminUserRow) {
    const trimmedPassword = resetPassword.trim();
    if (trimmedPassword === '') {
      setRowError('Password is required.');
      return;
    }

    setRowError(null);
    setBusyId(target.id);

    const body: ResetPasswordBody = { password: trimmedPassword };

    try {
      const response = await apiFetch(`/api/users/${target.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        return;
      }
      if (!response.ok) {
        setRowError("Couldn't reset this password.");
        return;
      }
      setResettingId(null);
      setResetPassword('');
    } catch {
      setRowError("Couldn't reset this password.");
    } finally {
      setBusyId(null);
    }
  }

  async function runRowAction(target: AdminUserRow, action: RowAction) {
    setRowError(null);
    setBusyId(target.id);
    setEditingId(null);
    setResettingId(null);
    setResetPassword('');

    try {
      const response =
        action === 'soft-delete'
          ? await apiFetch(`/api/users/${target.id}`, { method: 'DELETE' })
          : await apiFetch(`/api/users/${target.id}/restore`, {
              method: 'POST',
            });

      if (response.status === 401) {
        return;
      }
      if (response.status === 409) {
        setRowError(
          action === 'soft-delete'
            ? 'Cannot soft-delete the last Administrator.'
            : "Couldn't update this User.",
        );
        return;
      }
      if (!response.ok) {
        setRowError("Couldn't update this User.");
        return;
      }

      const updated = (await response.json()) as AdminUserRow;
      upsertUser(updated);
    } catch {
      setRowError("Couldn't update this User.");
    } finally {
      setBusyId(null);
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
              data={ROLE_OPTIONS}
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
      {rowError ? <Alert color="red">{rowError}</Alert> : null}
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
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {list.users.map((row) => {
              const isDeleted = row.deletedAt !== null;
              const isSelf = user?.id === row.id;
              const isEditing = editingId === row.id;
              const isResetting = resettingId === row.id;
              const busy = busyId === row.id;
              return (
                <Table.Tr key={row.id}>
                  <Table.Td>{row.email}</Table.Td>
                  <Table.Td>
                    {isEditing ? (
                      <TextInput
                        aria-label={`Edit display name ${row.displayName}`}
                        value={editDisplayName}
                        onChange={(event) =>
                          setEditDisplayName(event.currentTarget.value)
                        }
                      />
                    ) : (
                      row.displayName
                    )}
                  </Table.Td>
                  <Table.Td>
                    {isEditing ? (
                      <Select
                        aria-label={`Edit role ${row.displayName}`}
                        data={ROLE_OPTIONS}
                        value={editRole}
                        onChange={(value) => setEditRole(value as Role | null)}
                      />
                    ) : (
                      ROLE_LABEL[row.role]
                    )}
                  </Table.Td>
                  <Table.Td>{isDeleted ? 'Soft-deleted' : 'Current'}</Table.Td>
                  <Table.Td>
                    <Stack gap="xs">
                      {isDeleted ? (
                        <Button
                          type="button"
                          variant="default"
                          size="xs"
                          loading={busy}
                          onClick={() => void runRowAction(row, 'restore')}
                        >
                          Restore
                        </Button>
                      ) : (
                        <>
                          <Group gap="xs" wrap="nowrap">
                            {isEditing ? (
                              <>
                                <Button
                                  type="button"
                                  size="xs"
                                  loading={busy}
                                  onClick={() => void saveEdit(row)}
                                >
                                  Save
                                </Button>
                                <Button
                                  type="button"
                                  variant="default"
                                  size="xs"
                                  disabled={busy}
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditDisplayName('');
                                    setEditRole(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="default"
                                size="xs"
                                disabled={busy || isResetting}
                                onClick={() => {
                                  setRowError(null);
                                  setResettingId(null);
                                  setResetPassword('');
                                  setEditingId(row.id);
                                  setEditDisplayName(row.displayName);
                                  setEditRole(row.role);
                                }}
                              >
                                Edit
                              </Button>
                            )}
                            {!isEditing && !isResetting ? (
                              <Button
                                type="button"
                                variant="light"
                                size="xs"
                                disabled={busy}
                                onClick={() => {
                                  setRowError(null);
                                  setEditingId(null);
                                  setEditDisplayName('');
                                  setEditRole(null);
                                  setResettingId(row.id);
                                  setResetPassword('');
                                }}
                              >
                                Reset password
                              </Button>
                            ) : null}
                            {!isEditing && !isResetting && !isSelf ? (
                              <Button
                                type="button"
                                color="red"
                                variant="light"
                                size="xs"
                                loading={busy}
                                onClick={() =>
                                  void runRowAction(row, 'soft-delete')
                                }
                              >
                                Soft-delete
                              </Button>
                            ) : null}
                          </Group>
                          {isResetting ? (
                            <Group gap="xs" wrap="nowrap" align="flex-end">
                              <PasswordInput
                                aria-label={`New password ${row.displayName}`}
                                value={resetPassword}
                                onChange={(event) =>
                                  setResetPassword(event.currentTarget.value)
                                }
                                style={{ flex: 1 }}
                              />
                              <Button
                                type="button"
                                size="xs"
                                loading={busy}
                                onClick={() => void savePasswordReset(row)}
                              >
                                Save password
                              </Button>
                              <Button
                                type="button"
                                variant="default"
                                size="xs"
                                disabled={busy}
                                onClick={() => {
                                  setResettingId(null);
                                  setResetPassword('');
                                }}
                              >
                                Cancel
                              </Button>
                            </Group>
                          ) : null}
                        </>
                      )}
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
