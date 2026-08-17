import {
  Alert,
  Anchor,
  Avatar,
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
  PRIORITIES,
  TICKET_STATUSES,
  type TicketListEnvelope,
  type TicketListFilterOptions,
  type TicketListFilters,
  type TicketListRow,
  UNASSIGNED_ASSIGNEE_QUERY,
} from '@support-ticketing/shared';
import {
  IconAlertCircle,
  IconBuildings,
  IconFilterOff,
  IconFlag,
  IconPlus,
  IconProgress,
  IconRefresh,
  IconTicket,
  IconUser,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../auth/api';
import { LoadingState } from '../components/LoadingState';
import {
  formatTicketInstant,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  assigneeLabel,
} from './ticketLabels';

const STATUS_FILTER_DATA = [
  ...TICKET_STATUSES.map((value) => ({
    value,
    label: STATUS_LABEL[value],
  })),
  { value: OPEN_TICKET_LOAD_STATUS_QUERY, label: 'Active Tickets' },
];

function ticketsUrl(
  filters: TicketListFilters,
  includeAssignee: boolean,
): string {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.priority) {
    params.set('priority', filters.priority);
  }
  if (filters.clientId) {
    params.set('clientId', filters.clientId);
  }
  if (includeAssignee && filters.assigneeId) {
    params.set('assigneeId', filters.assigneeId);
  }
  if (filters.stale) {
    params.set('stale', filters.stale);
  }
  if (filters.scope) {
    params.set('scope', filters.scope);
  }
  const query = params.toString();
  return query ? `/api/tickets?${query}` : '/api/tickets';
}

function filtersFromSearchParams(
  searchParams: URLSearchParams,
  includeAssignee: boolean,
): TicketListFilters {
  const filters: TicketListFilters = {};
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const clientId = searchParams.get('clientId');
  const assigneeId = searchParams.get('assigneeId');
  const stale = searchParams.get('stale');
  const scope = searchParams.get('scope');
  if (status) {
    filters.status = status;
  }
  if (priority) {
    filters.priority = priority;
  }
  if (clientId) {
    filters.clientId = clientId;
  }
  if (includeAssignee && assigneeId) {
    filters.assigneeId = assigneeId;
  }
  if (stale) {
    filters.stale = stale;
  }
  if (scope) {
    filters.scope = scope;
  }
  return filters;
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

function PersonCell({ name }: { name: string }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Avatar name={name} color="indigo" radius="xl" size={26} />
      <Text size="sm">{name}</Text>
    </Group>
  );
}

export function TicketList() {
  const { user } = useAuth();
  const includeAssignee =
    user != null && hasMinimumRole(user.role, 'supervisor');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = filtersFromSearchParams(searchParams, includeAssignee);
  const filterQuery = searchParams.toString();
  const hasActiveFilters = filterQuery.length > 0;
  const [tickets, setTickets] = useState<TicketListRow[] | null>(null);
  const [filterOptions, setFilterOptions] =
    useState<TicketListFilterOptions | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

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
    const listFilters = filtersFromSearchParams(
      new URLSearchParams(filterQuery),
      includeAssignee,
    );

    void apiFetch(ticketsUrl(listFilters, includeAssignee))
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
          component={Link}
          to="/tickets/new"
          leftSection={<IconPlus size={16} stroke={1.8} />}
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
            value={filters.status ?? null}
            onChange={(status) => setFilter('status', status)}
            data={STATUS_FILTER_DATA}
          />
          <Select
            label="Priority"
            clearable
            leftSection={<IconFlag size={16} stroke={1.6} />}
            value={filters.priority ?? null}
            onChange={(priority) => setFilter('priority', priority)}
            data={PRIORITIES.map((value) => ({
              value,
              label: PRIORITY_LABEL[value],
            }))}
          />
          <Select
            label="Client"
            clearable
            leftSection={<IconBuildings size={16} stroke={1.6} />}
            value={filters.clientId ?? null}
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
              value={filters.assigneeId ?? null}
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
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          <Stack gap="sm">
            <Text>Couldn't load tickets.</Text>
            <Group>
              <Button
                type="button"
                variant="default"
                leftSection={<IconRefresh size={14} stroke={1.8} />}
                onClick={() => {
                  setFailed(false);
                  setTickets(null);
                  setReloadToken((token) => token + 1);
                }}
              >
                Try again
              </Button>
            </Group>
          </Stack>
        </Alert>
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
        <Card withBorder radius="md" p={0}>
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
                          Unassigned
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
    </Stack>
  );
}
