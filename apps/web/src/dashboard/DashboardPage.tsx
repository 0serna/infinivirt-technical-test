import {
  Anchor,
  Badge,
  Card,
  Center,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
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
import {
  type Icon,
  IconCircleDot,
  IconClockExclamation,
  IconInbox,
  IconProgress,
  IconTicket,
  IconUserCheck,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../auth/api';
import { LoadErrorAlert } from '../components/LoadErrorAlert';
import { LoadingState } from '../components/LoadingState';
import {
  formatTicketInstant,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
} from '../tickets/ticketLabels';
import classes from './DashboardPage.module.css';

function ShortTicketTable({
  tickets,
  emptyLabel,
}: {
  tickets: TicketListRow[];
  emptyLabel: string;
}) {
  const navigate = useNavigate();

  if (tickets.length === 0) {
    return (
      <Card withBorder radius="md">
        <Center py="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray">
              <IconTicket size={24} stroke={1.5} />
            </ThemeIcon>
            <Text c="dimmed">{emptyLabel}</Text>
          </Stack>
        </Center>
      </Card>
    );
  }

  return (
    <Card withBorder radius="md" p={0}>
      <Table.ScrollContainer minWidth={640}>
        <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
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
  );
}

function KpiCard({
  label,
  count,
  to,
  icon: KpiIcon,
  color,
}: {
  label: string;
  count: number;
  to: string;
  icon: Icon;
  color: string;
}) {
  return (
    <Card
      withBorder
      radius="md"
      p="md"
      component={Link}
      to={to}
      className={classes.kpiCard}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            {label}
          </Text>
          <Text fz={28} fw={700} lh={1.1} c="indigo">
            {count}
          </Text>
        </Stack>
        <ThemeIcon size={38} radius="md" variant="light" color={color}>
          <KpiIcon size={20} stroke={1.6} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

function AgentDashboardView({ dashboard }: { dashboard: AgentDashboard }) {
  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        <KpiCard
          label="Active Tickets (Assignee)"
          count={dashboard.openCount}
          to={DASHBOARD_ASSIGNED_OPEN_LIST_PATH}
          icon={IconUserCheck}
          color="indigo"
        />
      </SimpleGrid>
      <Stack gap="sm">
        <Title order={3} size="h4">
          Active Tickets assigned to you
        </Title>
        <ShortTicketTable
          tickets={dashboard.openTickets}
          emptyLabel="No Active Tickets assigned to you."
        />
      </Stack>
    </Stack>
  );
}

function TeamDashboardView({ dashboard }: { dashboard: TeamDashboard }) {
  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        <KpiCard
          label="Active Tickets"
          count={dashboard.openTotal}
          to={DASHBOARD_OPEN_LOAD_LIST_PATH}
          icon={IconInbox}
          color="indigo"
        />
        <KpiCard
          label="Open"
          count={dashboard.openByStatus.open}
          to={DASHBOARD_OPEN_STATUS_LIST_PATH}
          icon={IconCircleDot}
          color="blue"
        />
        <KpiCard
          label="In progress"
          count={dashboard.openByStatus.in_progress}
          to={DASHBOARD_IN_PROGRESS_STATUS_LIST_PATH}
          icon={IconProgress}
          color="yellow"
        />
        <KpiCard
          label="Stale"
          count={dashboard.staleCount}
          to={DASHBOARD_STALE_LIST_PATH}
          icon={IconClockExclamation}
          color="orange"
        />
      </SimpleGrid>
      <Stack gap="sm">
        <Title order={3} size="h4">
          Stale Tickets
        </Title>
        <ShortTicketTable
          tickets={dashboard.stale}
          emptyLabel="No Stale Tickets to show."
        />
      </Stack>
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
    <Stack gap="lg">
      <Title order={2} size="h3">
        Operational Dashboard
      </Title>
      {failed ? (
        <LoadErrorAlert
          onRetry={() => {
            setFailed(false);
            setDashboard(null);
            setReloadToken((token) => token + 1);
          }}
        >
          Couldn't load the Operational Dashboard.
        </LoadErrorAlert>
      ) : dashboard === null ? (
        <LoadingState label="Loading Operational Dashboard…" />
      ) : dashboard.kind === 'agent' ? (
        <AgentDashboardView dashboard={dashboard} />
      ) : (
        <TeamDashboardView dashboard={dashboard} />
      )}
    </Stack>
  );
}
