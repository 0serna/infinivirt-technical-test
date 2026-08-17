import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import {
  type ClientCatalogRow,
  type CreateTicketBody,
  PRIORITIES,
  type Priority,
  type TicketDetail as TicketDetailBody,
} from '@support-ticketing/shared';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../auth/api';
import { LoadingState } from '../components/LoadingState';
import { PRIORITY_LABEL } from './ticketLabels';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; clients: ClientCatalogRow[] };

export function TicketCreateModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
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
    if (!opened) {
      return;
    }
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
  }, [opened, reloadToken]);

  function resetForm() {
    setClientId(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setFormError(null);
    setCatalog({ kind: 'loading' });
  }

  function handleClose() {
    resetForm();
    onClose();
  }

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
      resetForm();
      onClose();
      navigate(`/tickets/${created.id}`, { replace: true });
    } catch {
      setFormError("Couldn't create this ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="New ticket"
      centered
      size="lg"
    >
      {catalog.kind === 'loading' ? (
        <LoadingState label="Loading clients…" mih={160} />
      ) : catalog.kind === 'error' ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          <Stack gap="sm">
            <Text>Couldn't load clients.</Text>
            <Group>
              <Button
                type="button"
                variant="default"
                leftSection={<IconRefresh size={14} stroke={1.8} />}
                onClick={() => {
                  setCatalog({ kind: 'loading' });
                  setReloadToken((token) => token + 1);
                }}
              >
                Try again
              </Button>
            </Group>
          </Stack>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Select
              label="Client"
              value={clientId}
              onChange={setClientId}
              data={catalog.clients.map((client) => ({
                value: client.id,
                label: client.name,
              }))}
              disabled={submitting}
              data-autofocus
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
            {formError !== null ? (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {formError}
              </Alert>
            ) : null}
            <Group justify="flex-end">
              <Button
                type="button"
                variant="default"
                disabled={submitting}
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting} disabled={submitting}>
                Create ticket
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
