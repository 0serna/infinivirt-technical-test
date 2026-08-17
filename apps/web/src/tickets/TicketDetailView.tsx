import {
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type {
  Priority,
  TicketDetail as TicketDetailBody,
  TicketStatus,
  TicketStatusHistoryRow,
} from '@support-ticketing/shared';
import { Link } from 'react-router-dom';
import {
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

export function StatusTimeline({
  history,
}: {
  history: TicketStatusHistoryRow[];
}) {
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
            <Text size="xs" c="dimmed" title={row.changedBy.id}>
              {row.changedBy.displayName} ({row.changedBy.id}) ·{' '}
              {formatTicketInstant(row.changedAt)}
            </Text>
          </Stack>
        </Group>
      ))}
    </Stack>
  );
}

/** Compact queue header + metadata grid + B-style Status timeline. */
export function TicketDetailView({
  ticket,
  nextStatus,
  transitionLabel,
  isTransitioning,
  transitionError,
  onTransition,
}: {
  ticket: TicketDetailBody;
  nextStatus: TicketStatus | null;
  transitionLabel: string | null;
  isTransitioning: boolean;
  transitionError: boolean;
  onTransition: (to: TicketStatus) => void;
}) {
  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/" size="sm" c="dimmed">
        ← Tickets
      </Anchor>
      <Group justify="space-between" align="flex-start" wrap="wrap">
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
        {nextStatus && transitionLabel ? (
          <Button
            type="button"
            loading={isTransitioning}
            onClick={() => onTransition(nextStatus)}
          >
            {transitionLabel}
          </Button>
        ) : null}
      </Group>
      {transitionError ? (
        <Text c="red" size="sm">
          Couldn't update this ticket's status.
        </Text>
      ) : null}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        <MetaItem label="Client">{ticket.client.name}</MetaItem>
        <MetaItem label="Assignee">
          {ticket.assignee?.displayName ?? 'Unassigned'}
        </MetaItem>
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
      </SimpleGrid>
      <StatusTimeline history={ticket.statusHistory} />
    </Stack>
  );
}
