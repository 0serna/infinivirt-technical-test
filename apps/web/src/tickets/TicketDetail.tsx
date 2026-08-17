import { Alert, Button, Stack, Table, Text, Title } from '@mantine/core';
import {
  nextRecordableStatus,
  type PatchTicketStatusBody,
  type TicketDetail as TicketDetailBody,
  type TicketStatus,
} from '@support-ticketing/shared';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../auth/api';
import {
  formatTicketInstant,
  PRIORITY_LABEL,
  STATUS_LABEL,
} from './ticketLabels';

function transitionButtonLabel(from: TicketStatus, to: TicketStatus): string {
  if (to === 'closed') {
    return 'Close';
  }
  if (from === 'closed' && to === 'open') {
    return 'Reopen';
  }
  return `Mark as ${STATUS_LABEL[to].toLowerCase()}`;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'ready'; ticket: TicketDetailBody };

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [transitionError, setTransitionError] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken retriggers fetch on Try again
  useEffect(() => {
    if (!id) {
      setState({ kind: 'missing' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    setTransitionError(false);

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
  const nextStatus = user
    ? nextRecordableStatus({
        status: ticket.status,
        role: user.role,
        actorId: user.id,
        assigneeId: ticket.assignee?.id ?? null,
      })
    : null;

  async function recordTransition(to: TicketStatus) {
    if (!id) {
      return;
    }
    setIsTransitioning(true);
    setTransitionError(false);
    try {
      const body: PatchTicketStatusBody = { status: to };
      const response = await apiFetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        return;
      }
      if (!response.ok) {
        setTransitionError(true);
        return;
      }
      const updated = (await response.json()) as TicketDetailBody;
      setState({ kind: 'ready', ticket: updated });
    } catch {
      setTransitionError(true);
    } finally {
      setIsTransitioning(false);
    }
  }

  return (
    <Stack>
      <Title order={2}>{ticket.title}</Title>
      <Text>{ticket.description}</Text>
      <Text>Status: {STATUS_LABEL[ticket.status]}</Text>
      <Text>Priority: {PRIORITY_LABEL[ticket.priority]}</Text>
      <Text>Client: {ticket.client.name}</Text>
      <Text>Assignee: {ticket.assignee?.displayName ?? 'Unassigned'}</Text>
      <Text>Created by: {ticket.createdBy.displayName}</Text>
      <Text>Created: {formatTicketInstant(ticket.createdAt)}</Text>
      <Text>Updated: {formatTicketInstant(ticket.updatedAt)}</Text>
      {ticket.resolvedAt ? (
        <Text>Resolved: {formatTicketInstant(ticket.resolvedAt)}</Text>
      ) : null}
      {ticket.closedAt ? (
        <Text>Closed: {formatTicketInstant(ticket.closedAt)}</Text>
      ) : null}
      {nextStatus ? (
        <Button
          type="button"
          loading={isTransitioning}
          onClick={() => {
            void recordTransition(nextStatus);
          }}
        >
          {transitionButtonLabel(ticket.status, nextStatus)}
        </Button>
      ) : null}
      {transitionError ? (
        <Alert>Couldn't update this ticket's status.</Alert>
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
              <Table.Td>{formatTicketInstant(row.changedAt)}</Table.Td>
              <Table.Td>
                {row.changedBy.displayName} ({row.changedBy.id})
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
