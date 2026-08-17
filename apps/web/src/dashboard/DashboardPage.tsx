import {
  Alert,
  Anchor,
  Button,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  type AgentDashboard,
  DASHBOARD_ASSIGNED_OPEN_LIST_PATH,
  DASHBOARD_IN_PROGRESS_STATUS_LIST_PATH,
  DASHBOARD_OPEN_LOAD_LIST_PATH,
  DASHBOARD_OPEN_STATUS_LIST_PATH,
  DASHBOARD_STALE_LIST_PATH,
  type DashboardEnvelope,
  type TeamDashboard,
  type TicketListRow,
} from '@support-ticketing/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../auth/api';
import {
  formatTicketInstant,
  PRIORITY_LABEL,
  STATUS_LABEL,
} from '../tickets/ticketLabels';

function ShortTicketTable({
  tickets,
  emptyLabel,
}: {
  tickets: TicketListRow[];
  emptyLabel: string;
}) {
  if (tickets.length === 0) {
    return <Text>{emptyLabel}</Text>;
  }

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Title</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Priority</Table.Th>
          <Table.Th>Client</Table.Th>
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
            <Table.Td>{formatTicketInstant(ticket.updatedAt)}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function KpiLink({
  label,
  count,
  to,
}: {
  label: string;
  count: number;
  to: string;
}) {
  return (
    <Stack gap={4}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Anchor component={Link} to={to} size="xl" fw={700}>
        {count}
      </Anchor>
    </Stack>
  );
}

function AgentDashboardView({ dashboard }: { dashboard: AgentDashboard }) {
  return (
    <Stack>
      <KpiLink
        label="Open Tickets (Assignee)"
        count={dashboard.openCount}
        to={DASHBOARD_ASSIGNED_OPEN_LIST_PATH}
      />
      <Title order={3}>Open Tickets assigned to you</Title>
      <ShortTicketTable
        tickets={dashboard.openTickets}
        emptyLabel="No Open Tickets assigned to you."
      />
    </Stack>
  );
}

function TeamDashboardView({ dashboard }: { dashboard: TeamDashboard }) {
  return (
    <Stack>
      <Group gap="xl">
        <KpiLink
          label="Open Tickets"
          count={dashboard.openTotal}
          to={DASHBOARD_OPEN_LOAD_LIST_PATH}
        />
        <KpiLink
          label="Open"
          count={dashboard.openByStatus.open}
          to={DASHBOARD_OPEN_STATUS_LIST_PATH}
        />
        <KpiLink
          label="In progress"
          count={dashboard.openByStatus.in_progress}
          to={DASHBOARD_IN_PROGRESS_STATUS_LIST_PATH}
        />
        <KpiLink
          label="Stale Tickets"
          count={dashboard.staleCount}
          to={DASHBOARD_STALE_LIST_PATH}
        />
      </Group>
      <Title order={3}>Stale Tickets</Title>
      <ShortTicketTable
        tickets={dashboard.stale}
        emptyLabel="No Stale Tickets to show."
      />
    </Stack>
  );
}

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardEnvelope | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken retriggers fetch on Try again
  useEffect(() => {
    let cancelled = false;

    void apiFetch('/api/dashboard')
      .then(async (response) => {
        if (cancelled || response.status === 401) {
          return;
        }
        if (!response.ok) {
          setFailed(true);
          return;
        }
        const body = (await response.json()) as DashboardEnvelope;
        if (body.kind !== 'agent' && body.kind !== 'team') {
          setFailed(true);
          return;
        }
        setFailed(false);
        setDashboard(body);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return (
    <Stack>
      <Title order={2}>Operational Dashboard</Title>
      {failed ? (
        <Alert>
          <Stack gap="sm">
            <Text>Couldn't load the Operational Dashboard.</Text>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setFailed(false);
                setDashboard(null);
                setReloadToken((token) => token + 1);
              }}
            >
              Try again
            </Button>
          </Stack>
        </Alert>
      ) : dashboard === null ? (
        <Text>Loading Operational Dashboard…</Text>
      ) : dashboard.kind === 'agent' ? (
        <AgentDashboardView dashboard={dashboard} />
      ) : (
        <TeamDashboardView dashboard={dashboard} />
      )}
    </Stack>
  );
}
