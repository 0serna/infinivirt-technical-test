import {
  Alert,
  Button,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import type {
  AdminClientRow,
  CreateClientBody,
  UpdateClientBody,
} from '@support-ticketing/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';

type ListState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; clients: AdminClientRow[] };

type RowAction = 'rename' | 'soft-delete' | 'restore';

export function AdminClientsPage() {
  const { user } = useAuth();
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
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
        setRenamingId(null);
        setRenameValue('');
      }
    } catch {
      setRowError("Couldn't update this Client.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Stack>
      <Title order={2}>Clients</Title>
      <form onSubmit={handleSubmit}>
        <Group align="flex-end" wrap="nowrap">
          <TextInput
            label="Name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button type="submit" loading={submitting}>
            Create Client
          </Button>
        </Group>
      </form>
      {formError ? <Alert color="red">{formError}</Alert> : null}
      {rowError ? <Alert color="red">{rowError}</Alert> : null}
      {list.kind === 'error' ? (
        <Alert>
          <Stack gap="sm">
            <Text>Couldn't load Clients.</Text>
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
        <Text>Loading Clients…</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {list.clients.map((client) => {
              const isDeleted = client.deletedAt !== null;
              const isRenaming = renamingId === client.id;
              const busy = busyId === client.id;
              return (
                <Table.Tr key={client.id}>
                  <Table.Td>
                    {isRenaming ? (
                      <TextInput
                        aria-label={`Rename ${client.name}`}
                        value={renameValue}
                        onChange={(event) =>
                          setRenameValue(event.currentTarget.value)
                        }
                      />
                    ) : (
                      client.name
                    )}
                  </Table.Td>
                  <Table.Td>{isDeleted ? 'Soft-deleted' : 'Current'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {isDeleted ? (
                        <Button
                          type="button"
                          variant="default"
                          size="xs"
                          loading={busy}
                          onClick={() => void runRowAction(client, 'restore')}
                        >
                          Restore
                        </Button>
                      ) : isRenaming ? (
                        <>
                          <Button
                            type="button"
                            size="xs"
                            loading={busy}
                            onClick={() =>
                              void runRowAction(client, 'rename', renameValue)
                            }
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            size="xs"
                            disabled={busy}
                            onClick={() => {
                              setRenamingId(null);
                              setRenameValue('');
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="default"
                            size="xs"
                            disabled={busy}
                            onClick={() => {
                              setRowError(null);
                              setRenamingId(client.id);
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
      )}
    </Stack>
  );
}
