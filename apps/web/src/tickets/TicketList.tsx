import {
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Select,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  EMPTY_TICKET_LIST_FILTER_OPTIONS,
  hasMinimumRole,
  OPEN_TICKET_LOAD_STATUS_QUERY,
  TICKET_STATUSES,
  type TicketListEnvelope,
  type TicketListFilterOptions,
  type TicketListFilters,
  type TicketListRow,
  UNASSIGNED_ASSIGNEE_QUERY,
} from '@support-ticketing/shared';
import {
  IconBuildings,
  IconFilterOff,
  IconFlag,
  IconPlus,
  IconProgress,
  IconTicket,
  IconUser,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../auth/api';
import { LoadErrorAlert } from '../components/LoadErrorAlert';
import { LoadingState } from '../components/LoadingState';
import { PersonCell } from '../components/PersonCell';
import { TicketCreateModal } from './TicketCreateModal';
import {
  assigneeLabel,
  formatTicketInstant,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  PRIORITY_SELECT_DATA,
  STATUS_COLOR,
  STATUS_LABEL,
} from './ticketLabels';

const STATUS_FILTER_DATA = [
  ...TICKET_STATUSES.map((value) => ({
    value,
    label: STATUS_LABEL[value],
  })),
  { value: OPEN_TICKET_LOAD_STATUS_QUERY, label: 'Active Tickets' },
];

const TICKET_LIST_QUERY_KEYS = [
  'status',
  'priority',
  'clientId',
  'assigneeId',
  'stale',
  'scope',
] as const satisfies readonly (keyof TicketListFilters)[];

function ticketsUrl(
  searchParams: URLSearchParams,
  includeAssignee: boolean,
): string {
  const params = new URLSearchParams();
  for (const key of TICKET_LIST_QUERY_KEYS) {
    if (key === 'assigneeId' && !includeAssignee) {
      continue;
    }
    const value = searchParams.get(key);
    if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `/api/tickets?${query}` : '/api/tickets';
}

function assigneeSelectData(options: TicketListFilterOptions) {
  const people = options.assignees.map((assignee) => ({
    value: assignee.id,
    label: assignee.displayName,
  }));
  if (options.includeUnassigned) {
    people.push({
      value: UNASSIGNED_ASSIGNEE_QUERY,
      label: assigneeLabel(null),
    });
  }
  return people;
}

export function TicketList() {
  const { user } = useAuth();
  const includeAssignee =
    user != null && hasMinimumRole(user.role, 'supervisor');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const filterQuery = searchParams.toString();
  const hasActiveFilters = filterQuery.length > 0;
  const [tickets, setTickets] = useState<TicketListRow[] | null>(null);
  const [filterOptions, setFilterOptions] =
    useState<TicketListFilterOptions | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [createOpened, setCreateOpened] = useState(false);

  function setFilter(key: keyof TicketListFilters, value: string | null) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken retriggers fetch on Try again; filterQuery tracks URL filters
  useEffect(() => {
    let cancelled = false;
    void apiFetch(ticketsUrl(searchParams, includeAssignee))
      .then(async (response) => {
        if (cancelled || response.status === 401) {
          return;
        }
        if (!response.ok) {
          setFailed(true);
          return;
        }
        const body = (await response.json()) as Partial<TicketListEnvelope>;
        setFailed(false);
        setTickets(Array.isArray(body.tickets) ? body.tickets : []);
        setFilterOptions(
          body.filterOptions ?? EMPTY_TICKET_LIST_FILTER_OPTIONS,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filterQuery, includeAssignee, reloadToken]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2} size="h3">
          Tickets
        </Title>
        <Button
          leftSection={<IconPlus size={16} stroke={1.8} />}
          onClick={() => setCreateOpened(true)}
        >
          New ticket
        </Button>
      </Group>
      {filterOptions ? (
        <Group gap="sm" align="flex-end">
          <Select
            label="Status"
            clearable
            leftSection={<IconProgress size={16} stroke={1.6} />}
            value={searchParams.get('status') || null}
            onChange={(status) => setFilter('status', status)}
            data={STATUS_FILTER_DATA}
          />
          <Select
            label="Priority"
            clearable
            leftSection={<IconFlag size={16} stroke={1.6} />}
            value={searchParams.get('priority') || null}
            onChange={(priority) => setFilter('priority', priority)}
            data={PRIORITY_SELECT_DATA}
          />
          <Select
            label="Client"
            clearable
            leftSection={<IconBuildings size={16} stroke={1.6} />}
            value={searchParams.get('clientId') || null}
            onChange={(clientId) => setFilter('clientId', clientId)}
            data={filterOptions.clients.map((client) => ({
              value: client.id,
              label: client.name,
            }))}
          />
          {includeAssignee ? (
            <Select
              label="Assignee"
              clearable
              leftSection={<IconUser size={16} stroke={1.6} />}
              value={searchParams.get('assigneeId') || null}
              onChange={(assigneeId) => setFilter('assigneeId', assigneeId)}
              data={assigneeSelectData(filterOptions)}
            />
          ) : null}
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="subtle"
              color="gray"
              leftSection={<IconFilterOff size={16} stroke={1.6} />}
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </Group>
      ) : null}
      {failed ? (
        <LoadErrorAlert
          onRetry={() => {
            setFailed(false);
            setTickets(null);
            setReloadToken((token) => token + 1);
          }}
        >
          Couldn't load tickets.
        </LoadErrorAlert>
      ) : tickets === null ? (
        <LoadingState label="Loading tickets…" />
      ) : tickets.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray">
              <IconTicket size={24} stroke={1.5} />
            </ThemeIcon>
            <Text c="dimmed">No tickets to show.</Text>
          </Stack>
        </Center>
      ) : (
        <Card withBorder p={0}>
          <Table.ScrollContainer minWidth={760}>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Priority</Table.Th>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Assignee</Table.Th>
                  <Table.Th>Created by</Table.Th>
                  <Table.Th>Updated</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tickets.map((ticket) => (
                  <Table.Tr
                    key={ticket.id}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('a')) {
                        return;
                      }
                      navigate(`/tickets/${ticket.id}`);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <Table.Td>
                      <Anchor
                        component={Link}
                        to={`/tickets/${ticket.id}`}
                        size="sm"
                        fw={500}
                      >
                        {ticket.title}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={STATUS_COLOR[ticket.status]}
                        variant="light"
                        radius="sm"
                      >
                        {STATUS_LABEL[ticket.status]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={PRIORITY_COLOR[ticket.priority]}
                        variant="outline"
                        radius="sm"
                      >
                        {PRIORITY_LABEL[ticket.priority]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{ticket.client.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      {ticket.assignee ? (
                        <PersonCell name={ticket.assignee.displayName} />
                      ) : (
                        <Text size="sm" c="dimmed">
                          {assigneeLabel(null)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <PersonCell name={ticket.createdBy.displayName} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {formatTicketInstant(ticket.updatedAt)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
      <TicketCreateModal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
      />
    </Stack>
  );
}
