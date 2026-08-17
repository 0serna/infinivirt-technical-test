import {
  Alert,
  Anchor,
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Menu,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  ThemeIcon,
  Timeline,
  Title,
} from '@mantine/core';
import {
  type CommentVisibility,
  type CreateTicketCommentBody,
  hasMinimumRole,
  mayRecordFieldEdit,
  mayRecordReassignment,
  nextRecordableStatus,
  type PatchTicketAssigneeBody,
  type PatchTicketFieldsBody,
  type PatchTicketStatusBody,
  type TicketAssignmentHistoryRow,
  type TicketComment,
  type TicketDetail as TicketDetailBody,
  type TicketStatus,
  type TicketStatusHistoryRow,
  type UserCatalogRow,
} from '@support-ticketing/shared';
import {
  type Icon,
  IconAlertCircle,
  IconArchive,
  IconArrowLeft,
  IconChevronDown,
  IconCircleCheck,
  IconCircleDot,
  IconMessage,
  IconPencil,
  IconProgress,
  IconRefresh,
  IconRotate,
  IconSend,
  IconUserCheck,
  IconUserMinus,
} from '@tabler/icons-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../auth/api';
import { LoadingState } from '../components/LoadingState';
import { TicketEditModal } from './TicketEditModal';
import {
  COMMENT_VISIBILITY_COLOR,
  COMMENT_VISIBILITY_LABEL,
  assigneeLabel,
  formatTicketInstant,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
} from './ticketLabels';

function transitionMenuLabel(from: TicketStatus, to: TicketStatus): string {
  if (to === 'closed') {
    return 'Close';
  }
  if (from === 'closed' && to === 'open') {
    return 'Reopen';
  }
  return `Mark as ${STATUS_LABEL[to].toLowerCase()}`;
}

function transitionMenuIcon(from: TicketStatus, to: TicketStatus): Icon {
  if (from === 'closed' && to === 'open') {
    return IconRotate;
  }
  const icons: Record<TicketStatus, Icon> = {
    open: IconCircleDot,
    in_progress: IconProgress,
    resolved: IconCircleCheck,
    closed: IconArchive,
  };
  return icons[to];
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
    <Text size="xs" c="dimmed">
      {person.displayName} · {formatTicketInstant(at)}
    </Text>
  );
}

function SidebarCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Card withBorder radius="md">
      <Stack gap="sm" aria-label={label}>
        <Text fw={600} size="sm">
          {label}
        </Text>
        {children}
      </Stack>
    </Card>
  );
}

type HistoryRow = {
  changedAt: string;
  changedBy: { id: string; displayName: string };
};

function HistoryTimeline<Row extends HistoryRow>({
  rows,
  formatLabel,
  rowKey,
}: {
  rows: Row[];
  formatLabel: (row: Row) => string;
  rowKey: (row: Row) => string;
}) {
  return (
    <Timeline active={rows.length - 1} bulletSize={14} lineWidth={2}>
      {rows.map((row) => (
        <Timeline.Item
          key={rowKey(row)}
          title={
            <Text size="sm" fw={600} lh={1}>
              {formatLabel(row)}
            </Text>
          }
        >
          <PersonInstant person={row.changedBy} at={row.changedAt} />
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

function StatusTimeline({ history }: { history: TicketStatusHistoryRow[] }) {
  return (
    <SidebarCard label="Status history">
      <HistoryTimeline
        rows={history}
        formatLabel={(row) =>
          `${row.from ? STATUS_LABEL[row.from] : 'Created'} → ${STATUS_LABEL[row.to]}`
        }
        rowKey={(row) => `${row.changedAt}-${row.to}-${row.changedBy.id}`}
      />
    </SidebarCard>
  );
}

function AssignmentTimeline({
  history,
}: {
  history: TicketAssignmentHistoryRow[];
}) {
  return (
    <SidebarCard label="Assignment history">
      {history.length === 0 ? (
        <Text size="sm" c="dimmed">
          No assignments yet.
        </Text>
      ) : (
        <HistoryTimeline
          rows={history}
          formatLabel={(row) =>
            `${assigneeLabel(row.from)} → ${assigneeLabel(row.to)}`
          }
          rowKey={(row) =>
            `${row.changedAt}-${row.from?.id ?? 'none'}-${row.to?.id ?? 'none'}-${row.changedBy.id}`
          }
        />
      )}
    </SidebarCard>
  );
}

type AssigneeControls = {
  users: UserCatalogRow[];
  usersLoading: boolean;
  busy: boolean;
  error: boolean;
  onRecordReassignment: (assigneeId: string | null) => Promise<boolean>;
};

function CommentThread({ comments }: { comments: TicketComment[] }) {
  return (
    <Stack gap="md" aria-label="Comments">
      <Text fw={600} size="sm">
        Comments
      </Text>
      {comments.length === 0 ? (
        <Center py="md">
          <Stack align="center" gap="sm">
            <ThemeIcon size={40} radius="xl" variant="light" color="gray">
              <IconMessage size={20} stroke={1.5} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              No comments yet.
            </Text>
          </Stack>
        </Center>
      ) : (
        comments.map((comment, index) => (
          <Stack key={comment.id} gap="md">
            {index > 0 ? <Divider /> : null}
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <Avatar
                name={comment.author.displayName}
                color="indigo"
                radius="xl"
                size={30}
              />
              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                <Group gap="xs" wrap="wrap">
                  <Badge
                    color={COMMENT_VISIBILITY_COLOR[comment.visibility]}
                    variant="light"
                    radius="sm"
                    aria-label={`Visibility: ${COMMENT_VISIBILITY_LABEL[comment.visibility]}`}
                  >
                    {COMMENT_VISIBILITY_LABEL[comment.visibility]}
                  </Badge>
                  <PersonInstant
                    person={comment.author}
                    at={comment.createdAt}
                  />
                </Group>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {comment.body}
                </Text>
              </Stack>
            </Group>
          </Stack>
        ))
      )}
    </Stack>
  );
}

function CommentComposer({
  busy,
  error,
  allowInternal,
  onSubmit,
}: {
  busy: boolean;
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
        if (body.length === 0 || busy) {
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
        placeholder="Write an update…"
        value={draft}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
        }}
        minRows={3}
        disabled={busy}
      />
      {error ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          Couldn't add this comment.
        </Alert>
      ) : null}
      <Group justify="space-between" wrap="wrap">
        {allowInternal ? (
          <Switch
            label={COMMENT_VISIBILITY_LABEL[visibility]}
            checked={visibility === 'internal'}
            onChange={(event) => {
              setVisibility(
                event.currentTarget.checked ? 'internal' : 'public',
              );
            }}
            disabled={busy}
            aria-label="Visibility"
          />
        ) : (
          <span />
        )}
        <Button
          type="submit"
          loading={busy}
          disabled={draft.trim() === ''}
          leftSection={<IconSend size={14} stroke={1.8} />}
        >
          Add comment
        </Button>
      </Group>
    </Stack>
  );
}

function PropertiesCard({
  ticket,
  assigneeControls,
}: {
  ticket: TicketDetailBody;
  assigneeControls: AssigneeControls | null;
}) {
  const [draftAssigneeId, setDraftAssigneeId] = useState<string | null>(
    ticket.assignee?.id ?? null,
  );

  useEffect(() => {
    setDraftAssigneeId(ticket.assignee?.id ?? null);
  }, [ticket.assignee?.id]);

  const currentId = ticket.assignee?.id ?? null;
  const busy = assigneeControls?.busy ?? false;
  const canSave =
    draftAssigneeId !== null && draftAssigneeId !== currentId && !busy;

  return (
    <Card withBorder radius="md">
      <Stack gap="md" aria-label="Ticket properties">
        <Text fw={600} size="sm">
          Properties
        </Text>
        <MetaItem label="Client">{ticket.client.name}</MetaItem>
        {assigneeControls ? (
          <Stack gap="sm" aria-label="Assignee controls">
            <Select
              label="Assignee"
              placeholder={
                assigneeControls.usersLoading
                  ? 'Loading users…'
                  : assigneeLabel(null)
              }
              data={assigneeControls.users.map((row) => ({
                value: row.id,
                label: `${row.displayName} (${row.role})`,
              }))}
              value={draftAssigneeId}
              onChange={setDraftAssigneeId}
              disabled={busy || assigneeControls.usersLoading}
              clearable={false}
              searchable
            />
            <Group gap="sm">
              <Button
                type="button"
                variant="light"
                size="xs"
                loading={busy}
                disabled={!canSave}
                leftSection={<IconUserCheck size={14} stroke={1.8} />}
                onClick={() => {
                  if (draftAssigneeId) {
                    void assigneeControls.onRecordReassignment(draftAssigneeId);
                  }
                }}
              >
                {currentId === null ? 'Assign' : 'Change assignee'}
              </Button>
              {currentId !== null ? (
                <Button
                  type="button"
                  variant="default"
                  size="xs"
                  loading={busy}
                  leftSection={<IconUserMinus size={14} stroke={1.8} />}
                  onClick={() => {
                    void assigneeControls.onRecordReassignment(null);
                  }}
                >
                  Clear assignee
                </Button>
              ) : null}
            </Group>
            {assigneeControls.error ? (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                Couldn't update this ticket's assignee.
              </Alert>
            ) : null}
          </Stack>
        ) : (
          <MetaItem label="Assignee">{assigneeLabel(ticket.assignee)}</MetaItem>
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
    </Card>
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
  const [commentError, setCommentError] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [assigneeError, setAssigneeError] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [users, setUsers] = useState<UserCatalogRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const canReassign = user !== null && mayRecordReassignment(user.role);
  const canEditFields = user !== null && mayRecordFieldEdit(user.role);
  const [editOpened, setEditOpened] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSavingFields, setIsSavingFields] = useState(false);

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
    setEditOpened(false);
    setFieldError(null);

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
    return <LoadingState label="Loading ticket…" />;
  }
  if (state.kind === 'missing') {
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />}>
        <Stack gap="sm">
          <Text>Ticket not found.</Text>
          <Group>
            <Button
              component={Link}
              to="/tickets"
              variant="default"
              leftSection={<IconArrowLeft size={14} stroke={1.8} />}
            >
              Back to tickets
            </Button>
          </Group>
        </Stack>
      </Alert>
    );
  }
  if (state.kind === 'error') {
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />}>
        <Stack gap="sm">
          <Text>Couldn't load this ticket.</Text>
          <Group>
            <Button
              type="button"
              variant="default"
              leftSection={<IconRefresh size={14} stroke={1.8} />}
              onClick={() => {
                setReloadToken((token) => token + 1);
              }}
            >
              Try again
            </Button>
          </Group>
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

  async function saveFieldEdit(body: PatchTicketFieldsBody) {
    const saved = await mutateTicket(
      `/api/tickets/${id}/fields`,
      { method: 'PATCH', body: JSON.stringify(body) },
      setIsSavingFields,
      (failed) => {
        setFieldError(failed ? "Couldn't update this ticket's fields." : null);
      },
    );
    if (saved) {
      setEditOpened(false);
      setFieldError(null);
    }
  }

  const TransitionIcon = nextStatus
    ? transitionMenuIcon(ticket.status, nextStatus)
    : null;

  return (
    <Stack gap="lg">
      <Breadcrumbs separator="›" separatorMargin="xs">
        <Anchor component={Link} to="/tickets" size="sm" c="dimmed">
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
              radius="sm"
              aria-label={`Status: ${STATUS_LABEL[ticket.status]}`}
            >
              {STATUS_LABEL[ticket.status]}
            </Badge>
            <Badge
              color={PRIORITY_COLOR[ticket.priority]}
              variant="outline"
              radius="sm"
              aria-label={`Priority: ${PRIORITY_LABEL[ticket.priority]}`}
            >
              {PRIORITY_LABEL[ticket.priority]}
            </Badge>
          </Group>
          <Title order={2}>{ticket.title}</Title>
          <Text c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
            {ticket.description}
          </Text>
        </Stack>
        <Group gap="sm" style={{ flexShrink: 0 }}>
          {canEditFields ? (
            <Button
              type="button"
              variant="default"
              leftSection={<IconPencil size={14} stroke={1.8} />}
              onClick={() => {
                setFieldError(null);
                setEditOpened(true);
              }}
              aria-label="Edit ticket fields"
            >
              Edit
            </Button>
          ) : null}
          {nextStatus && TransitionIcon ? (
            <Menu shadow="md" width={280} withinPortal={false}>
              <Menu.Target>
                <Button
                  type="button"
                  variant="light"
                  loading={isTransitioning}
                  rightSection={<IconChevronDown size={14} stroke={1.8} />}
                  aria-label="Change status"
                >
                  Change status
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>From {STATUS_LABEL[ticket.status]}</Menu.Label>
                <Menu.Item
                  leftSection={<TransitionIcon size={14} stroke={1.8} />}
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
      </Group>
      {transitionError ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          Couldn't update this ticket's status.
        </Alert>
      ) : null}
      <Grid gap="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card withBorder radius="md">
            <Stack gap="lg">
              <CommentThread comments={ticket.comments} />
              <Divider />
              <CommentComposer
                busy={isCommenting}
                error={commentError}
                allowInternal={
                  user !== null && hasMinimumRole(user.role, 'supervisor')
                }
                onSubmit={createComment}
              />
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <PropertiesCard
              ticket={ticket}
              assigneeControls={
                canReassign
                  ? {
                      users,
                      usersLoading,
                      busy: isReassigning,
                      error: assigneeError,
                      onRecordReassignment: recordReassignment,
                    }
                  : null
              }
            />
            <StatusTimeline history={ticket.statusHistory} />
            <AssignmentTimeline history={ticket.assignments} />
          </Stack>
        </Grid.Col>
      </Grid>
      <TicketEditModal
        opened={editOpened}
        ticket={ticket}
        saving={isSavingFields}
        serverError={fieldError}
        onClose={() => {
          setEditOpened(false);
          setFieldError(null);
        }}
        onSave={(body) => {
          void saveFieldEdit(body);
        }}
      />
    </Stack>
  );
}
