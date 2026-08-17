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
  ClientCatalogRow,
  CreateClientBody,
} from '@support-ticketing/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';

type ListState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; clients: ClientCatalogRow[] };

export function AdminClientsPage() {
  const { user } = useAuth();
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken retriggers fetch on Try again
  useEffect(() => {
    if (user?.role !== 'admin') {
      return;
    }
    let cancelled = false;

    void apiFetch('/api/clients')
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
          clients: Array.isArray(body) ? (body as ClientCatalogRow[]) : [],
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
      const created = (await response.json()) as ClientCatalogRow;
      setName('');
      setList((current) => {
        if (current.kind !== 'ready') {
          return current;
        }
        if (current.clients.some((row) => row.id === created.id)) {
          return current;
        }
        const clients = [...current.clients, created].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        return { kind: 'ready', clients };
      });
    } catch {
      setFormError("Couldn't create this Client.");
    } finally {
      setSubmitting(false);
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
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {list.clients.map((client) => (
              <Table.Tr key={client.id}>
                <Table.Td>{client.name}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
