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
  hasMinimumRole,
  PRIORITIES,
  TICKET_STATUSES,
  type Priority,
  type TicketStatus,
} from '@support-ticketing/shared';
import { useEffect, useState } from 'react';
import { apiFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';

type TicketListRow = {
  id: string;
  title: string;
  status: TicketStatus;
  priority: Priority;
  client: { id: string; name: string };
  assignee: { id: string; displayName: string } | null;
  createdBy: { id: string; displayName: string };
  updatedAt: string;
  createdAt: string;
};

type FilterOptions = {
  clients: Array<{ id: string; name: string }>;
  assignees: Array<{ id: string; displayName: string }>;
};

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

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function ticketsUrl(filters: {
  status: string | null;
  priority: string | null;
  clientId: string | null;
  assigneeId: string | null;
  includeAssignee: boolean;
}): string {
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
  if (filters.includeAssignee && filters.assigneeId) {
    params.set('assigneeId', filters.assigneeId);
  }
  const query = params.toString();
  return query === '' ? '/api/tickets' : `/api/tickets?${query}`;
}

export function TicketList() {
  const { user } = useAuth();
  const includeAssignee =
    user != null && hasMinimumRole(user.role, 'supervisor');
  const [status, setStatus] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketListRow[] | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken retriggers fetch on Try again
  useEffect(() => {
    let cancelled = false;

    void apiFetch(
      ticketsUrl({
        status,
        priority,
        clientId,
        assigneeId,
        includeAssignee,
      }),
    )
      .then(async (response) => {
        if (cancelled || response.status === 401) {
          return;
        }
        if (!response.ok) {
          setFailed(true);
          return;
        }
        const body = (await response.json()) as {
          tickets?: TicketListRow[];
          filterOptions?: FilterOptions;
        };
        setFailed(false);
        setTickets(Array.isArray(body.tickets) ? body.tickets : []);
        setFilterOptions(body.filterOptions ?? { clients: [], assignees: [] });
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, priority, clientId, assigneeId, includeAssignee, reloadToken]);

  return (
    <Stack>
      <Title order={2}>Tickets</Title>
      {filterOptions ? (
        <Group>
          <Select
            label="Status"
            clearable
            value={status}
            onChange={setStatus}
            data={TICKET_STATUSES.map((value) => ({
              value,
              label: STATUS_LABEL[value],
            }))}
          />
          <Select
            label="Priority"
            clearable
            value={priority}
            onChange={setPriority}
            data={PRIORITIES.map((value) => ({
              value,
              label: PRIORITY_LABEL[value],
            }))}
          />
          <Select
            label="Client"
            clearable
            value={clientId}
            onChange={setClientId}
            data={filterOptions.clients.map((client) => ({
              value: client.id,
              label: client.name,
            }))}
          />
          {includeAssignee ? (
            <Select
              label="Assignee"
              clearable
              value={assigneeId}
              onChange={setAssigneeId}
              data={filterOptions.assignees.map((assignee) => ({
                value: assignee.id,
                label: assignee.displayName,
              }))}
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
                <Table.Td>{ticket.title}</Table.Td>
                <Table.Td>{STATUS_LABEL[ticket.status]}</Table.Td>
                <Table.Td>{PRIORITY_LABEL[ticket.priority]}</Table.Td>
                <Table.Td>{ticket.client.name}</Table.Td>
                <Table.Td>
                  {ticket.assignee?.displayName ?? 'Unassigned'}
                </Table.Td>
                <Table.Td>{ticket.createdBy.displayName}</Table.Td>
                <Table.Td>{formatUpdatedAt(ticket.updatedAt)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
