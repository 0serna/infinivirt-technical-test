import {
  Alert,
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Group,
  Menu,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  type CommentVisibility,
  type CreateTicketCommentBody,
  hasMinimumRole,
  mayRecordReassignment,
  nextRecordableStatus,
  type PatchTicketAssigneeBody,
  type PatchTicketStatusBody,
  type Priority,
  type TicketAssignmentHistoryRow,
  type TicketComment,
  type TicketDetail as TicketDetailBody,
  type TicketStatus,
  type TicketStatusHistoryRow,
  type UserCatalogRow,
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

const COMMENT_VISIBILITY_COLOR: Record<CommentVisibility, string> = {
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

function PersonInstant({
  person,
  at,
}: {
  person: { id: string; displayName: string };
  at: string;
}) {
  return (
    <Text size="xs" c="dimmed" title={person.id}>
      {person.displayName} ({person.id}) · {formatTicketInstant(at)}
    </Text>
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
            <PersonInstant person={row.changedBy} at={row.changedAt} />
          </Stack>
        </Group>
      ))}
    </Stack>
  );
}

function assigneeLabel(person: { displayName: string } | null): string {
  return person?.displayName ?? 'Unassigned';
}

function AssignmentTimeline({
  history,
}: {
  history: TicketAssignmentHistoryRow[];
}) {
  return (
    <Stack gap="sm" aria-label="Assignment history">
      <Text fw={600} size="sm">
        Assignment history
      </Text>
      {history.length === 0 ? (
        <Text size="sm" c="dimmed">
          No assignments yet.
        </Text>
      ) : (
        history.map((row, index) => (
          <Group
            key={`${row.changedAt}-${row.from?.id ?? 'none'}-${row.to?.id ?? 'none'}-${row.changedBy.id}`}
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
                {assigneeLabel(row.from)} → {assigneeLabel(row.to)}
              </Text>
              <PersonInstant person={row.changedBy} at={row.changedAt} />
            </Stack>
          </Group>
        ))
      )}
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
              <PersonInstant person={comment.author} at={comment.createdAt} />
            </Group>
            <Text size="sm">{comment.body}</Text>
          </Stack>
        ))
      )}
    </Stack>
  );
}

function CommentComposer({
  disabled,
  error,
  allowInternal,
  onSubmit,
}: {
  disabled: boolean;
  error: boolean;
  allowInternal: boolean;
  onSubmit: (body: string, visibility: CommentVisibility) => Promise<boolean>;
}) {
  const defaultVisibility: CommentVisibility = allowInternal
    ? 'internal'
    : 'public';
  const [draft, setDraft] = useState('');
  const [visibility, setVisibility] =
    useState<CommentVisibility>(defaultVisibility);

  return (
    <Stack
      gap="sm"
      component="form"
      onSubmit={(event) => {
        event.preventDefault();
        const body = draft.trim();
        if (body.length === 0 || disabled) {
          return;
        }
        void onSubmit(body, visibility).then((ok) => {
          if (ok) {
            setDraft('');
            setVisibility(defaultVisibility);
          }
        });
      }}
    >
      <Textarea
        label="Comment"
        value={draft}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
        }}
        minRows={3}
        disabled={disabled}
      />
      {allowInternal ? (
        <Switch
          label={COMMENT_VISIBILITY_LABEL[visibility]}
          checked={visibility === 'internal'}
          onChange={(event) => {
            setVisibility(event.currentTarget.checked ? 'internal' : 'public');
          }}
          disabled={disabled}
          aria-label="Visibility"
        />
      ) : null}
      <Button type="submit" loading={disabled} disabled={draft.trim() === ''}>
        Add comment
      </Button>
      {error ? (
        <Text c="red" size="sm">
          Couldn't add this comment.
        </Text>
      ) : null}
    </Stack>
  );
}

function PropertiesColumn({
  ticket,
  canReassign,
  users,
  usersLoading,
  assigneeBusy,
  assigneeError,
  onAssign,
  onClear,
}: {
  ticket: TicketDetailBody;
  canReassign: boolean;
  users: UserCatalogRow[];
  usersLoading: boolean;
  assigneeBusy: boolean;
  assigneeError: boolean;
  onAssign: (assigneeId: string) => Promise<boolean>;
  onClear: () => Promise<boolean>;
}) {
  const [draftAssigneeId, setDraftAssigneeId] = useState<string | null>(
    ticket.assignee?.id ?? null,
  );

  useEffect(() => {
    setDraftAssigneeId(ticket.assignee?.id ?? null);
  }, [ticket.assignee?.id]);

  const currentId = ticket.assignee?.id ?? null;
  const canSave =
    draftAssigneeId !== null && draftAssigneeId !== currentId && !assigneeBusy;
  const canClear = currentId !== null && !assigneeBusy;

  return (
    <Stack gap="md" aria-label="Ticket properties">
      <Text fw={600} size="sm">
        Properties
      </Text>
      <MetaItem label="Client">{ticket.client.name}</MetaItem>
      {canReassign ? (
        <Stack gap="sm" aria-label="Assignee controls">
          <Select
            label="Assignee"
            placeholder={usersLoading ? 'Loading users…' : 'Unassigned'}
            data={users.map((row) => ({
              value: row.id,
              label: `${row.displayName} (${row.role})`,
            }))}
            value={draftAssigneeId}
            onChange={setDraftAssigneeId}
            disabled={assigneeBusy || usersLoading}
            clearable={false}
            searchable
          />
          <Group gap="sm">
            <Button
              type="button"
              variant="light"
              loading={assigneeBusy}
              disabled={!canSave}
              onClick={() => {
                if (draftAssigneeId) {
                  void onAssign(draftAssigneeId);
                }
              }}
            >
              {currentId === null ? 'Assign' : 'Change assignee'}
            </Button>
            {currentId !== null ? (
              <Button
                type="button"
                variant="default"
                loading={assigneeBusy}
                disabled={!canClear}
                onClick={() => {
                  void onClear();
                }}
              >
                Clear assignee
              </Button>
            ) : null}
          </Group>
          {assigneeError ? (
            <Text c="red" size="sm">
              Couldn't update this ticket's assignee.
            </Text>
          ) : null}
        </Stack>
      ) : (
        <MetaItem label="Assignee">
          {ticket.assignee?.displayName ?? 'Unassigned'}
        </MetaItem>
      )}
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
  const isWide = useMediaQuery('(min-width: 62em)');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [transitionError, setTransitionError] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [commentError, setCommentError] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [assigneeError, setAssigneeError] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [users, setUsers] = useState<UserCatalogRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const canReassign = user !== null && mayRecordReassignment(user.role);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken retriggers fetch on Try again
  useEffect(() => {
    if (!id) {
      setState({ kind: 'missing' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    setTransitionError(false);
    setCommentError(false);
    setAssigneeError(false);

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

  useEffect(() => {
    if (!canReassign) {
      setUsers([]);
      setUsersLoading(false);
      return;
    }
    let cancelled = false;
    setUsersLoading(true);
    void apiFetch('/api/users')
      .then(async (response) => {
        if (cancelled || response.status === 401) {
          return;
        }
        if (!response.ok) {
          setUsers([]);
          return;
        }
        const body = (await response.json()) as unknown;
        setUsers(Array.isArray(body) ? (body as UserCatalogRow[]) : []);
      })
      .catch(() => {
        if (!cancelled) {
          setUsers([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setUsersLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canReassign]);

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

  async function mutateTicket(
    path: string,
    init: RequestInit,
    setBusy: (busy: boolean) => void,
    setError: (error: boolean) => void,
  ): Promise<boolean> {
    if (!id) {
      return false;
    }
    setBusy(true);
    setError(false);
    try {
      const response = await apiFetch(path, init);
      if (response.status === 401) {
        return false;
      }
      if (!response.ok) {
        setError(true);
        return false;
      }
      const updated = (await response.json()) as TicketDetailBody;
      setState({ kind: 'ready', ticket: updated });
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function recordTransition(to: TicketStatus) {
    const body: PatchTicketStatusBody = { status: to };
    await mutateTicket(
      `/api/tickets/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
      setIsTransitioning,
      setTransitionError,
    );
  }

  async function createComment(
    bodyText: string,
    visibility: CommentVisibility,
  ): Promise<boolean> {
    const body: CreateTicketCommentBody = {
      body: bodyText,
      visibility,
    };
    return mutateTicket(
      `/api/tickets/${id}/comments`,
      { method: 'POST', body: JSON.stringify(body) },
      setIsCommenting,
      setCommentError,
    );
  }

  async function recordReassignment(
    assigneeId: string | null,
  ): Promise<boolean> {
    const body: PatchTicketAssigneeBody = { assigneeId };
    return mutateTicket(
      `/api/tickets/${id}/assignee`,
      { method: 'PATCH', body: JSON.stringify(body) },
      setIsReassigning,
      setAssigneeError,
    );
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
      <Box
        style={{
          display: 'grid',
          gap: 24,
          alignItems: 'start',
          gridTemplateColumns: isWide
            ? 'minmax(160px, 0.9fr) minmax(0, 2fr) minmax(180px, 1fr)'
            : '1fr',
        }}
      >
        <PropertiesColumn
          ticket={ticket}
          canReassign={canReassign}
          users={users}
          usersLoading={usersLoading}
          assigneeBusy={isReassigning}
          assigneeError={assigneeError}
          onAssign={(assigneeId) => recordReassignment(assigneeId)}
          onClear={() => recordReassignment(null)}
        />
        <Stack gap="md">
          <CommentThread comments={ticket.comments} />
          <CommentComposer
            disabled={isCommenting}
            error={commentError}
            allowInternal={
              user !== null && hasMinimumRole(user.role, 'supervisor')
            }
            onSubmit={createComment}
          />
        </Stack>
        <Stack gap="md">
          <StatusTimeline history={ticket.statusHistory} />
          <AssignmentTimeline history={ticket.assignments} />
        </Stack>
      </Box>
    </Stack>
  );
}
