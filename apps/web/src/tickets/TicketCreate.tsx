import {
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import {
  type ClientCatalogRow,
  type CreateTicketBody,
  PRIORITIES,
  type Priority,
  type TicketDetail as TicketDetailBody,
} from '@support-ticketing/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../auth/api';
import { PRIORITY_LABEL } from './ticketLabels';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; clients: ClientCatalogRow[] };

export function TicketCreate() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<CatalogState>({ kind: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken retriggers fetch on Try again
  useEffect(() => {
    let cancelled = false;

    void apiFetch('/api/clients')
      .then(async (response) => {
        if (cancelled || response.status === 401) {
          return;
        }
        if (!response.ok) {
          setCatalog({ kind: 'error' });
          return;
        }
        const body = (await response.json()) as unknown;
        setCatalog({
          kind: 'ready',
          clients: Array.isArray(body) ? (body as ClientCatalogRow[]) : [],
        });
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog({ kind: 'error' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!clientId || trimmedTitle === '' || trimmedDescription === '') {
      setFormError('Client, Title, and description are required.');
      return;
    }

    setFormError(null);
    setSubmitting(true);

    const body: CreateTicketBody = {
      clientId,
      title: trimmedTitle,
      description: trimmedDescription,
      priority,
    };

    try {
      const response = await apiFetch('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        return;
      }
      if (!response.ok) {
        setFormError("Couldn't create this ticket.");
        return;
      }
      const created = (await response.json()) as TicketDetailBody;
      navigate(`/tickets/${created.id}`, { replace: true });
    } catch {
      setFormError("Couldn't create this ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack>
      <Breadcrumbs>
        <Anchor component={Link} to="/">
          Tickets
        </Anchor>
        <Text>New ticket</Text>
      </Breadcrumbs>
      <Title order={2}>New ticket</Title>
      {catalog.kind === 'loading' ? (
        <Text>Loading clients…</Text>
      ) : catalog.kind === 'error' ? (
        <Alert>
          <Stack gap="sm">
            <Text>Couldn't load clients.</Text>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setCatalog({ kind: 'loading' });
                setReloadToken((token) => token + 1);
              }}
            >
              Try again
            </Button>
          </Stack>
        </Alert>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{ maxWidth: '32rem', width: '100%' }}
        >
          <Stack>
            <Select
              label="Client"
              value={clientId}
              onChange={setClientId}
              data={catalog.clients.map((client) => ({
                value: client.id,
                label: client.name,
              }))}
              disabled={submitting}
            />
            <TextInput
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              disabled={submitting}
            />
            <Textarea
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              minRows={4}
              disabled={submitting}
            />
            <Select
              label="Priority"
              value={priority}
              onChange={(value) => {
                if (value != null) {
                  setPriority(value as Priority);
                }
              }}
              data={PRIORITIES.map((value) => ({
                value,
                label: PRIORITY_LABEL[value],
              }))}
              disabled={submitting}
            />
            {formError ? (
              <Text c="red" size="sm">
                {formError}
              </Text>
            ) : null}
            <Button type="submit" loading={submitting} disabled={submitting}>
              Create ticket
            </Button>
          </Stack>
        </form>
      )}
    </Stack>
  );
}
