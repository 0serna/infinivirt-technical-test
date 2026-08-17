import {
  Alert,
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  nextRecordableStatus,
  type PatchTicketStatusBody,
  type Priority,
  type TicketComment,
  type TicketDetail as TicketDetailBody,
  type TicketStatus,
  type TicketStatusHistoryRow,
} from '@support-ticketing/shared';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../auth/api';
import {
  COMMENT_VISIBILITY_LABEL,
  formatTicketInstant,
  PRIORITY_LABEL,
  STATUS_LABEL,
} from './ticketLabels';

const STATUS_COLOR: Record<TicketStatus, string> = {
  open: 'blue',
  in_progress: 'yellow',
  resolved: 'teal',
  closed: 'gray',
};

const PRIORITY_COLOR: Record<Priority, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
};

const COMMENT_VISIBILITY_COLOR: Record<TicketComment['visibility'], string> = {
  public: 'blue',
  internal: 'orange',
};

function transitionMenuLabel(from: TicketStatus, to: TicketStatus): string {
  if (to === 'closed') {
    return 'Close';
  }
  if (from === 'closed' && to === 'open') {
    return 'Reopen';
  }
  return `Mark as ${STATUS_LABEL[to].toLowerCase()}`;
}

function MetaItem({ label, children }: { label: string; children: string }) {
  return (
    <Stack gap={2} aria-label={`${label}: ${children}`}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="sm">{children}</Text>
    </Stack>
  );
}

function StatusTimeline({ history }: { history: TicketStatusHistoryRow[] }) {
  return (
    <Stack gap="sm" aria-label="Status history">
      <Text fw={600} size="sm">
        Status history
      </Text>
      {history.map((row, index) => (
        <Group
          key={`${row.changedAt}-${row.to}-${row.changedBy.id}`}
          align="flex-start"
          gap="sm"
          wrap="nowrap"
        >
          <Box
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              marginTop: 6,
              background:
                index === history.length - 1
                  ? 'var(--mantine-color-blue-6)'
                  : 'var(--mantine-color-gray-4)',
              flexShrink: 0,
            }}
          />
          <Stack gap={2}>
            <Text size="sm" fw={600}>
              {row.from ? STATUS_LABEL[row.from] : 'Created'} →{' '}
              {STATUS_LABEL[row.to]}
            </Text>
            <Text size="xs" c="dimmed" title={row.changedBy.id}>
              {row.changedBy.displayName} ({row.changedBy.id}) ·{' '}
              {formatTicketInstant(row.changedAt)}
            </Text>
          </Stack>
        </Group>
      ))}
    </Stack>
  );
}

function CommentThread({ comments }: { comments: TicketComment[] }) {
  return (
    <Stack gap="sm" aria-label="Comments">
      <Text fw={600} size="sm">
        Comments
      </Text>
      {comments.length === 0 ? (
        <Text size="sm" c="dimmed">
          No comments yet.
        </Text>
      ) : (
        comments.map((comment) => (
          <Stack key={comment.id} gap={6}>
            <Group gap="sm" wrap="wrap">
              <Badge
                color={COMMENT_VISIBILITY_COLOR[comment.visibility]}
                variant="light"
                aria-label={`Visibility: ${COMMENT_VISIBILITY_LABEL[comment.visibility]}`}
              >
                {COMMENT_VISIBILITY_LABEL[comment.visibility]}
              </Badge>
              <Text size="xs" c="dimmed" title={comment.author.id}>
                {comment.author.displayName} ({comment.author.id}) ·{' '}
                {formatTicketInstant(comment.createdAt)}
              </Text>
            </Group>
            <Text size="sm">{comment.body}</Text>
          </Stack>
        ))
      )}
    </Stack>
  );
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
    <Stack gap="lg">
      <Breadcrumbs separator="›" separatorMargin="xs">
        <Anchor component={Link} to="/" size="sm" c="dimmed">
          Tickets
        </Anchor>
        <Text size="sm" lineClamp={1} maw={420}>
          {ticket.title}
        </Text>
      </Breadcrumbs>
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <Group gap="sm">
            <Badge
              color={STATUS_COLOR[ticket.status]}
              variant="light"
              aria-label={`Status: ${STATUS_LABEL[ticket.status]}`}
            >
              {STATUS_LABEL[ticket.status]}
            </Badge>
            <Badge
              color={PRIORITY_COLOR[ticket.priority]}
              variant="outline"
              aria-label={`Priority: ${PRIORITY_LABEL[ticket.priority]}`}
            >
              {PRIORITY_LABEL[ticket.priority]}
            </Badge>
          </Group>
          <Title order={2}>{ticket.title}</Title>
          <Text c="dimmed">{ticket.description}</Text>
        </Stack>
        {nextStatus ? (
          <Menu shadow="md" width={280} withinPortal={false}>
            <Menu.Target>
              <Button
                type="button"
                variant="light"
                loading={isTransitioning}
                rightSection="▾"
                aria-label="Change status"
                style={{ flexShrink: 0 }}
              >
                Change status
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>From {STATUS_LABEL[ticket.status]}</Menu.Label>
              <Menu.Item
                onClick={() => {
                  void recordTransition(nextStatus);
                }}
              >
                <Stack gap={0}>
                  <Text size="sm" fw={600}>
                    {transitionMenuLabel(ticket.status, nextStatus)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {STATUS_LABEL[ticket.status]} → {STATUS_LABEL[nextStatus]}
                  </Text>
                </Stack>
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : null}
      </Group>
      {transitionError ? (
        <Text c="red" size="sm">
          Couldn't update this ticket's status.
        </Text>
      ) : null}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        <MetaItem label="Client">{ticket.client.name}</MetaItem>
        <MetaItem label="Assignee">
          {ticket.assignee?.displayName ?? 'Unassigned'}
        </MetaItem>
        <MetaItem label="Created by">{ticket.createdBy.displayName}</MetaItem>
        <MetaItem label="Created">
          {formatTicketInstant(ticket.createdAt)}
        </MetaItem>
        <MetaItem label="Updated">
          {formatTicketInstant(ticket.updatedAt)}
        </MetaItem>
        {ticket.resolvedAt ? (
          <MetaItem label="Resolved">
            {formatTicketInstant(ticket.resolvedAt)}
          </MetaItem>
        ) : null}
        {ticket.closedAt ? (
          <MetaItem label="Closed">
            {formatTicketInstant(ticket.closedAt)}
          </MetaItem>
        ) : null}
      </SimpleGrid>
      <StatusTimeline history={ticket.statusHistory} />
      <CommentThread comments={ticket.comments} />
    </Stack>
  );
}
