import { Alert, Button, Stack, Table, Text, Title } from '@mantine/core';
import type {
  Priority,
  TicketDetail as TicketDetailBody,
  TicketStatus,
} from '@support-ticketing/shared';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../auth/api';

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

function formatInstant(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'ready'; ticket: TicketDetailBody };

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken retriggers fetch on Try again
  useEffect(() => {
    if (!id) {
      setState({ kind: 'missing' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });

    void apiFetch(`/api/tickets/${id}`)
      .then(async (response) => {
        if (cancelled || response.status === 401) {
          return;
        }
        if (response.status === 404) {
          setState({ kind: 'missing' });
          return;
        }
        if (!response.ok) {
          setState({ kind: 'error' });
          return;
        }
        const body = (await response.json()) as TicketDetailBody;
        setState({ kind: 'ready', ticket: body });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ kind: 'error' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, reloadToken]);

  if (state.kind === 'loading') {
    return <Text>Loading ticket…</Text>;
  }
  if (state.kind === 'missing') {
    return <Alert>Ticket not found.</Alert>;
  }
  if (state.kind === 'error') {
    return (
      <Alert>
        <Stack gap="sm">
          <Text>Couldn't load this ticket.</Text>
          <Button
            type="button"
            variant="default"
            onClick={() => {
              setReloadToken((token) => token + 1);
            }}
          >
            Try again
          </Button>
        </Stack>
      </Alert>
    );
  }

  const { ticket } = state;

  return (
    <Stack>
      <Title order={2}>{ticket.title}</Title>
      <Text>{ticket.description}</Text>
      <Text>Status: {STATUS_LABEL[ticket.status]}</Text>
      <Text>Priority: {PRIORITY_LABEL[ticket.priority]}</Text>
      <Text>Client: {ticket.client.name}</Text>
      <Text>Assignee: {ticket.assignee?.displayName ?? 'Unassigned'}</Text>
      <Text>Created by: {ticket.createdBy.displayName}</Text>
      <Text>Updated: {formatInstant(ticket.updatedAt)}</Text>
      {ticket.resolvedAt ? (
        <Text>Resolved: {formatInstant(ticket.resolvedAt)}</Text>
      ) : null}
      {ticket.closedAt ? (
        <Text>Closed: {formatInstant(ticket.closedAt)}</Text>
      ) : null}
      <Table aria-label="Status history">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>From</Table.Th>
            <Table.Th>To</Table.Th>
            <Table.Th>Changed</Table.Th>
            <Table.Th>Changed by</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {ticket.statusHistory.map((row) => (
            <Table.Tr key={`${row.changedAt}-${row.to}`}>
              <Table.Td>{row.from ? STATUS_LABEL[row.from] : '—'}</Table.Td>
              <Table.Td>{STATUS_LABEL[row.to]}</Table.Td>
              <Table.Td>{formatInstant(row.changedAt)}</Table.Td>
              <Table.Td>{row.changedBy.displayName}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
