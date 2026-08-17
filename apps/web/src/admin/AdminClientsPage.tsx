import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import type {
  AdminClientRow,
  CreateClientBody,
  UpdateClientBody,
} from '@support-ticketing/shared';
import {
  IconAlertCircle,
  IconBuildings,
  IconPencil,
  IconPlus,
  IconRestore,
  IconTrash,
} from '@tabler/icons-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { LoadingState } from '../components/LoadingState';
import { LoadErrorAlert } from '../components/LoadErrorAlert';

type ListState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; clients: AdminClientRow[] };

type RowAction = 'rename' | 'soft-delete' | 'restore';

export function AdminClientsPage() {
  const { user } = useAuth();
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [createOpened, setCreateOpened] = useState(false);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [renaming, setRenaming] = useState<AdminClientRow | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken retriggers fetch on Try again
  useEffect(() => {
    if (user?.role !== 'admin') {
      return;
    }
    let cancelled = false;

    void apiFetch('/api/clients?includeDeleted=true')
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
          clients: Array.isArray(body) ? (body as AdminClientRow[]) : [],
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

  function upsertClient(client: AdminClientRow) {
    setList((current) => {
      if (current.kind !== 'ready') {
        return current;
      }
      const without = current.clients.filter((row) => row.id !== client.id);
      const clients = [...without, client].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      return { kind: 'ready', clients };
    });
  }

  function openCreate() {
    setFormError(null);
    setName('');
    setCreateOpened(true);
  }

  function closeRename() {
    setRenaming(null);
    setRenameValue('');
    setRowError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') {
      setFormError('Name is required.');
      return;
    }

    setFormError(null);
    setSubmitting(true);

    const body: CreateClientBody = { name: trimmed };

    try {
      const response = await apiFetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        return;
      }
      if (response.status === 409) {
        setFormError('A Client with this name already exists.');
        return;
      }
      if (!response.ok) {
        setFormError("Couldn't create this Client.");
        return;
      }
      const created = (await response.json()) as AdminClientRow;
      setName('');
      setCreateOpened(false);
      upsertClient(created);
    } catch {
      setFormError("Couldn't create this Client.");
    } finally {
      setSubmitting(false);
    }
  }

  async function runRowAction(
    client: AdminClientRow,
    action: RowAction,
    nextName?: string,
  ) {
    setRowError(null);
    setBusyId(client.id);

    try {
      let response: Response;
      if (action === 'rename') {
        const trimmed = (nextName ?? '').trim();
        if (trimmed === '') {
          setRowError('Name is required.');
          return;
        }
        const body: UpdateClientBody = { name: trimmed };
        response = await apiFetch(`/api/clients/${client.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else if (action === 'soft-delete') {
        response = await apiFetch(`/api/clients/${client.id}`, {
          method: 'DELETE',
        });
      } else {
        response = await apiFetch(`/api/clients/${client.id}/restore`, {
          method: 'POST',
        });
      }

      if (response.status === 401) {
        return;
      }
      if (response.status === 409) {
        setRowError(
          action === 'rename'
            ? 'A Client with this name already exists.'
            : "Couldn't update this Client.",
        );
        return;
      }
      if (!response.ok) {
        setRowError("Couldn't update this Client.");
        return;
      }

      const updated = (await response.json()) as AdminClientRow;
      upsertClient(updated);
      if (action === 'rename') {
        closeRename();
      }
    } catch {
      setRowError("Couldn't update this Client.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2} size="h3">
          Clients
        </Title>
        <Button
          leftSection={<IconPlus size={16} stroke={1.8} />}
          onClick={openCreate}
        >
          New Client
        </Button>
      </Group>
      {rowError !== null && renaming === null ? (
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
          Couldn't load Clients.
        </LoadErrorAlert>
      ) : list.kind === 'loading' ? (
        <LoadingState label="Loading Clients…" />
      ) : list.clients.length === 0 ? (
        <Card withBorder>
          <Center py="xl">
            <Stack align="center" gap="sm">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                <IconBuildings size={24} stroke={1.5} />
              </ThemeIcon>
              <Text c="dimmed">No Clients to show.</Text>
            </Stack>
          </Center>
        </Card>
      ) : (
        <Card withBorder p={0}>
          <Table.ScrollContainer minWidth={520}>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {list.clients.map((client) => {
                  const isDeleted = client.deletedAt !== null;
                  const busy = busyId === client.id;
                  return (
                    <Table.Tr key={client.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {client.name}
                        </Text>
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
                              onClick={() =>
                                void runRowAction(client, 'restore')
                              }
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
                                onClick={() => {
                                  setRowError(null);
                                  setRenaming(client);
                                  setRenameValue(client.name);
                                }}
                              >
                                Rename
                              </Button>
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
                                  void runRowAction(client, 'soft-delete')
                                }
                              >
                                Soft-delete
                              </Button>
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
        title="New Client"
        centered
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <TextInput
              label="Name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              data-autofocus
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
                Create Client
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Modal
        opened={renaming !== null}
        onClose={closeRename}
        title="Rename Client"
        centered
      >
        {renaming !== null ? (
          <Stack gap="sm">
            <TextInput
              aria-label={`Rename ${renaming.name}`}
              value={renameValue}
              onChange={(event) => setRenameValue(event.currentTarget.value)}
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
                disabled={busyId === renaming.id}
                onClick={closeRename}
              >
                Cancel
              </Button>
              <Button
                type="button"
                loading={busyId === renaming.id}
                onClick={() =>
                  void runRowAction(renaming, 'rename', renameValue)
                }
              >
                Save
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}
