import { Alert, Stack, Table, Text, Title } from '@mantine/core';
import type { Priority, TicketStatus } from '@support-ticketing/shared';
import { useEffect, useState } from 'react';
import { apiFetch } from '../auth/api';

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

export function TicketList() {
  const [tickets, setTickets] = useState<TicketListRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void apiFetch('/api/tickets')
      .then(async (response) => {
        if (cancelled || response.status === 401) {
          return;
        }
        if (!response.ok) {
          setFailed(true);
          return;
        }
        const body = (await response.json()) as { tickets?: TicketListRow[] };
        setTickets(Array.isArray(body.tickets) ? body.tickets : []);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Stack>
      <Title order={2}>Tickets</Title>
      {failed ? (
        <Alert>Couldn't load tickets. Try again.</Alert>
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
