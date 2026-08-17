import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
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
import {
  IconAlertCircle,
  IconKey,
  IconPencil,
  IconPlus,
  IconRestore,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { LoadingState } from '../components/LoadingState';
import { LoadErrorAlert } from '../components/LoadErrorAlert';
import { PersonCell } from '../components/PersonCell';
import { ROLE_COLOR, ROLE_LABEL } from '../users/roleLabels';

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
  const [createOpened, setCreateOpened] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role | null>('agent');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [resetting, setResetting] = useState<AdminUserRow | null>(null);
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

  function openCreate() {
    setFormError(null);
    setEmail('');
    setDisplayName('');
    setRole('agent');
    setPassword('');
    setCreateOpened(true);
  }

  function openEdit(target: AdminUserRow) {
    setRowError(null);
    setResetting(null);
    setResetPassword('');
    setEditing(target);
    setEditDisplayName(target.displayName);
    setEditRole(target.role);
  }

  function closeEdit() {
    setEditing(null);
    setEditDisplayName('');
    setEditRole(null);
    setRowError(null);
  }

  function openReset(target: AdminUserRow) {
    setRowError(null);
    setEditing(null);
    setEditDisplayName('');
    setEditRole(null);
    setResetting(target);
    setResetPassword('');
  }

  function closeReset() {
    setResetting(null);
    setResetPassword('');
    setRowError(null);
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
      setCreateOpened(false);
      upsertUser(created);
    } catch {
      setFormError("Couldn't create this User.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit() {
    if (editing === null) {
      return;
    }
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
    setBusyId(editing.id);

    const body: UpdateUserBody = {
      displayName: trimmedDisplayName,
      role: editRole,
    };

    try {
      const response = await apiFetch(`/api/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        return;
      }
      if (response.status === 409) {
        setRowError(
          editing.role === 'admin' && editRole !== 'admin'
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
      closeEdit();
    } catch {
      setRowError("Couldn't update this User.");
    } finally {
      setBusyId(null);
    }
  }

  async function savePasswordReset() {
    if (resetting === null) {
      return;
    }
    const trimmedPassword = resetPassword.trim();
    if (trimmedPassword === '') {
      setRowError('Password is required.');
      return;
    }

    setRowError(null);
    setBusyId(resetting.id);

    const body: ResetPasswordBody = { password: trimmedPassword };

    try {
      const response = await apiFetch(`/api/users/${resetting.id}/password`, {
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
      closeReset();
    } catch {
      setRowError("Couldn't reset this password.");
    } finally {
      setBusyId(null);
    }
  }

  async function runRowAction(target: AdminUserRow, action: RowAction) {
    setRowError(null);
    setBusyId(target.id);
    setEditing(null);
    setResetting(null);
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
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2} size="h3">
          Users
        </Title>
        <Button
          leftSection={<IconPlus size={16} stroke={1.8} />}
          onClick={openCreate}
        >
          New User
        </Button>
      </Group>
      {rowError !== null && editing === null && resetting === null ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {rowError}
        </Alert>
      ) : null}
      {list.kind === 'error' ? (
        <LoadErrorAlert
          onRetry={() => {
            setList({ kind: 'loading' });
            setReloadToken((token) => token + 1);
          }}
        >
          Couldn't load Users.
        </LoadErrorAlert>
      ) : list.kind === 'loading' ? (
        <LoadingState label="Loading Users…" />
      ) : list.users.length === 0 ? (
        <Card withBorder radius="md">
          <Center py="xl">
            <Stack align="center" gap="sm">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                <IconUsers size={24} stroke={1.5} />
              </ThemeIcon>
              <Text c="dimmed">No Users to show.</Text>
            </Stack>
          </Center>
        </Card>
      ) : (
        <Card withBorder radius="md" p={0}>
          <Table.ScrollContainer minWidth={720}>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Display name</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {list.users.map((row) => {
                  const isDeleted = row.deletedAt !== null;
                  const isSelf = user?.id === row.id;
                  const busy = busyId === row.id;
                  return (
                    <Table.Tr key={row.id}>
                      <Table.Td>
                        <Text size="sm">{row.email}</Text>
                      </Table.Td>
                      <Table.Td>
                        <PersonCell name={row.displayName} />
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={ROLE_COLOR[row.role]}
                          variant="light"
                          radius="sm"
                        >
                          {ROLE_LABEL[row.role]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={isDeleted ? 'gray' : 'teal'}
                          variant="light"
                          radius="sm"
                        >
                          {isDeleted ? 'Soft-deleted' : 'Current'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap" justify="flex-end">
                          {isDeleted ? (
                            <Button
                              type="button"
                              variant="default"
                              size="xs"
                              loading={busy}
                              leftSection={
                                <IconRestore size={14} stroke={1.8} />
                              }
                              onClick={() => void runRowAction(row, 'restore')}
                            >
                              Restore
                            </Button>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="default"
                                size="xs"
                                disabled={busy}
                                leftSection={
                                  <IconPencil size={14} stroke={1.8} />
                                }
                                onClick={() => openEdit(row)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="default"
                                size="xs"
                                disabled={busy}
                                leftSection={<IconKey size={14} stroke={1.8} />}
                                onClick={() => openReset(row)}
                              >
                                Reset password
                              </Button>
                              {!isSelf ? (
                                <Button
                                  type="button"
                                  color="red"
                                  variant="light"
                                  size="xs"
                                  loading={busy}
                                  leftSection={
                                    <IconTrash size={14} stroke={1.8} />
                                  }
                                  onClick={() =>
                                    void runRowAction(row, 'soft-delete')
                                  }
                                >
                                  Soft-delete
                                </Button>
                              ) : null}
                            </>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title="New User"
        centered
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <TextInput
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              data-autofocus
            />
            <TextInput
              label="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.currentTarget.value)}
            />
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
            {formError !== null ? (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {formError}
              </Alert>
            ) : null}
            <Group justify="flex-end">
              <Button
                type="button"
                variant="default"
                onClick={() => setCreateOpened(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Create User
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Modal
        opened={editing !== null}
        onClose={closeEdit}
        title="Edit User"
        centered
      >
        {editing !== null ? (
          <Stack gap="sm">
            <TextInput
              label="Display name"
              aria-label={`Edit display name ${editing.displayName}`}
              value={editDisplayName}
              onChange={(event) =>
                setEditDisplayName(event.currentTarget.value)
              }
              data-autofocus
            />
            <Select
              label="Role"
              aria-label={`Edit role ${editing.displayName}`}
              data={ROLE_OPTIONS}
              value={editRole}
              onChange={(value) => setEditRole(value as Role | null)}
            />
            {rowError !== null ? (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {rowError}
              </Alert>
            ) : null}
            <Group justify="flex-end">
              <Button
                type="button"
                variant="default"
                disabled={busyId === editing.id}
                onClick={closeEdit}
              >
                Cancel
              </Button>
              <Button
                type="button"
                loading={busyId === editing.id}
                onClick={() => void saveEdit()}
              >
                Save
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
      <Modal
        opened={resetting !== null}
        onClose={closeReset}
        title="Reset Password"
        centered
      >
        {resetting !== null ? (
          <Stack gap="sm">
            <PasswordInput
              label="New password"
              aria-label={`New password ${resetting.displayName}`}
              value={resetPassword}
              onChange={(event) => setResetPassword(event.currentTarget.value)}
              data-autofocus
            />
            {rowError !== null ? (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {rowError}
              </Alert>
            ) : null}
            <Group justify="flex-end">
              <Button
                type="button"
                variant="default"
                disabled={busyId === resetting.id}
                onClick={closeReset}
              >
                Cancel
              </Button>
              <Button
                type="button"
                loading={busyId === resetting.id}
                onClick={() => void savePasswordReset()}
              >
                Save password
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}
