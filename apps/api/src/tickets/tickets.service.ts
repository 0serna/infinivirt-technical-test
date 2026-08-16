import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PRIORITIES,
  TICKET_STATUSES,
  type Priority,
  type TicketStatus,
} from '@support-ticketing/shared';
import type { PublicUser } from '../auth/public-user';
import { PrismaService } from '../prisma/prisma.service';

export type TicketListRow = {
  id: string;
  title: string;
  status: TicketStatus;
  priority: Priority;
  client: { id: string; name: string };
  assignee: { id: string; displayName: string } | null;
  createdBy: { id: string; displayName: string };
  updatedAt: Date;
  createdAt: Date;
};

export type TicketListFilterOptions = {
  clients: Array<{ id: string; name: string }>;
  assignees: Array<{ id: string; displayName: string }>;
};

export type TicketListEnvelope = {
  tickets: TicketListRow[];
  filterOptions: TicketListFilterOptions;
};

export type TicketListQuery = {
  status?: string;
  priority?: string;
  clientId?: string;
  assigneeId?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

function requireUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return value;
}

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: PublicUser,
    query: TicketListQuery = {},
  ): Promise<TicketListEnvelope> {
    const status = parseOptionalStatus(query.status);
    const priority = parseOptionalPriority(query.priority);
    const clientId =
      query.clientId === undefined
        ? undefined
        : requireUuid(query.clientId, 'clientId');
    const assigneeFilter =
      user.role === 'agent' ? undefined : parseAssigneeFilter(query.assigneeId);

    const scoped = await this.prisma.ticket.findMany({
      where:
        user.role === 'agent'
          ? {
              OR: [{ assigneeId: user.id }, { createdById: user.id }],
            }
          : {},
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
        assignee: { select: { id: true, displayName: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
    });

    const tickets = scoped.filter((ticket) => {
      if (status !== undefined && ticket.status !== status) {
        return false;
      }
      if (priority !== undefined && ticket.priority !== priority) {
        return false;
      }
      if (clientId !== undefined && ticket.client.id !== clientId) {
        return false;
      }
      if (assigneeFilter === 'unassigned' && ticket.assignee !== null) {
        return false;
      }
      if (
        assigneeFilter !== undefined &&
        assigneeFilter !== 'unassigned' &&
        ticket.assignee?.id !== assigneeFilter
      ) {
        return false;
      }
      return true;
    });

    return { tickets, filterOptions: filterOptionsFromScope(scoped) };
  }
}

function parseOptionalStatus(value?: string): TicketStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isTicketStatus(value)) {
    throw new BadRequestException('Invalid status');
  }
  return value;
}

function parseOptionalPriority(value?: string): Priority | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isPriority(value)) {
    throw new BadRequestException('Invalid priority');
  }
  return value;
}

function parseAssigneeFilter(
  value?: string,
): 'unassigned' | string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'unassigned') {
    return 'unassigned';
  }
  return requireUuid(value, 'assigneeId');
}

function filterOptionsFromScope(
  tickets: TicketListRow[],
): TicketListFilterOptions {
  const clientsById = new Map<string, { id: string; name: string }>();
  const assigneesById = new Map<string, { id: string; displayName: string }>();
  let hasUnassigned = false;

  for (const ticket of tickets) {
    clientsById.set(ticket.client.id, ticket.client);
    if (ticket.assignee === null) {
      hasUnassigned = true;
    } else {
      assigneesById.set(ticket.assignee.id, ticket.assignee);
    }
  }

  const clients = [...clientsById.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const assignees = [...assigneesById.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
  if (hasUnassigned) {
    assignees.push({ id: 'unassigned', displayName: 'Unassigned' });
  }

  return { clients, assignees };
}
