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

function isAgentDashboard(body: DashboardEnvelope): body is AgentDashboard {
  return body.kind === 'agent';
}

function isTeamDashboard(body: DashboardEnvelope): body is TeamDashboard {
  return body.kind === 'team';
}

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

function AgentDashboardView({ dashboard }: { dashboard: AgentDashboard }) {
  return (
    <Stack>
      <Group gap="xl">
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Open assigned
          </Text>
          <Anchor
            component={Link}
            to={DASHBOARD_ASSIGNED_OPEN_LIST_PATH}
            size="xl"
            fw={700}
          >
            {dashboard.assignedOpenCount}
          </Anchor>
        </Stack>
      </Group>
      <Title order={3}>Assigned open tickets</Title>
      <ShortTicketTable
        tickets={dashboard.assignedOpen}
        emptyLabel="No assigned open tickets."
      />
    </Stack>
  );
}

function TeamDashboardView({ dashboard }: { dashboard: TeamDashboard }) {
  return (
    <Stack>
      <Text c="dimmed">
        Team metrics are not available yet. Open and Stale totals will land in a
        follow-up.
      </Text>
      <Group gap="xl">
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Open tickets
          </Text>
          <Text size="xl" fw={700}>
            {dashboard.openCount}
          </Text>
        </Stack>
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Stale tickets
          </Text>
          <Text size="xl" fw={700}>
            {dashboard.staleCount}
          </Text>
        </Stack>
      </Group>
      <Title order={3}>Stale tickets</Title>
      <ShortTicketTable
        tickets={dashboard.stale}
        emptyLabel="No stale tickets to show."
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
      <Title order={2}>Dashboard</Title>
      {failed ? (
        <Alert>
          <Stack gap="sm">
            <Text>Couldn't load dashboard.</Text>
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
        <Text>Loading dashboard…</Text>
      ) : isAgentDashboard(dashboard) ? (
        <AgentDashboardView dashboard={dashboard} />
      ) : isTeamDashboard(dashboard) ? (
        <TeamDashboardView dashboard={dashboard} />
      ) : (
        <Alert>
          <Text>Couldn't load dashboard.</Text>
        </Alert>
      )}
    </Stack>
  );
}
