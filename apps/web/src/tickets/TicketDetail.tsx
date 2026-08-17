import { Alert, Button, Stack, Text } from '@mantine/core';
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
import { TicketDetailView } from './TicketDetailView';
import { STATUS_LABEL } from './ticketLabels';

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
  const transitionLabel =
    nextStatus != null
      ? transitionButtonLabel(ticket.status, nextStatus)
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
    <TicketDetailView
      ticket={ticket}
      nextStatus={nextStatus}
      transitionLabel={transitionLabel}
      isTransitioning={isTransitioning}
      transitionError={transitionError}
      onTransition={(to) => {
        void recordTransition(to);
      }}
    />
  );
}
