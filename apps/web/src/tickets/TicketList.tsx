import {
  Alert,
  Button,
  Group,
  Select,
  Stack,
  Table,
  Text,
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
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../auth/api';
import {
  formatTicketInstant,
  PRIORITY_LABEL,
  STATUS_LABEL,
  assigneeLabel,
} from './ticketLabels';

const STATUS_FILTER_DATA = [
  ...TICKET_STATUSES.map((value) => ({
    value,
    label: STATUS_LABEL[value],
  })),
  { value: OPEN_TICKET_LOAD_STATUS_QUERY, label: 'Open Ticket load' },
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

export function TicketList() {
  const { user } = useAuth();
  const includeAssignee =
    user != null && hasMinimumRole(user.role, 'supervisor');
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = filtersFromSearchParams(searchParams, includeAssignee);
  const filterQuery = searchParams.toString();
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
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={2}>Tickets</Title>
        <Button component={Link} to="/tickets/new" variant="filled">
          New ticket
        </Button>
      </Group>
      {filterOptions ? (
        <Group>
          <Select
            label="Status"
            clearable
            value={filters.status ?? null}
            onChange={(status) => setFilter('status', status)}
            data={STATUS_FILTER_DATA}
          />
          <Select
            label="Priority"
            clearable
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
              value={filters.assigneeId ?? null}
              onChange={(assigneeId) => setFilter('assigneeId', assigneeId)}
              data={assigneeSelectData(filterOptions)}
            />
          ) : null}
        </Group>
      ) : null}
      {failed ? (
        <Alert>
          <Stack gap="sm">
            <Text>Couldn't load tickets.</Text>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setFailed(false);
                setTickets(null);
                setReloadToken((token) => token + 1);
              }}
            >
              Try again
            </Button>
          </Stack>
        </Alert>
      ) : tickets === null ? (
        <Text>Loading tickets…</Text>
      ) : tickets.length === 0 ? (
        <Text>No tickets to show.</Text>
      ) : (
        <Table>
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
              <Table.Tr key={ticket.id}>
                <Table.Td>
                  <Link to={`/tickets/${ticket.id}`}>{ticket.title}</Link>
                </Table.Td>
                <Table.Td>{STATUS_LABEL[ticket.status]}</Table.Td>
                <Table.Td>{PRIORITY_LABEL[ticket.priority]}</Table.Td>
                <Table.Td>{ticket.client.name}</Table.Td>
                <Table.Td>{assigneeLabel(ticket.assignee)}</Table.Td>
                <Table.Td>{ticket.createdBy.displayName}</Table.Td>
                <Table.Td>{formatTicketInstant(ticket.updatedAt)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
