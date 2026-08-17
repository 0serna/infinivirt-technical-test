import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EMPTY_TICKET_LIST_FILTER_OPTIONS,
  hasMinimumRole,
  PRIORITIES,
  type Priority,
  TICKET_STATUSES,
  type TicketListClient,
  type TicketListEnvelope,
  type TicketListFilterOptions,
  type TicketListFilters,
  type TicketListPerson,
  type TicketListRow,
  type TicketStatus,
  UNASSIGNED_ASSIGNEE_QUERY,
} from '@support-ticketing/shared';
import type { PublicUser } from '../auth/public-user';
import { PrismaService } from '../prisma/prisma.service';

type AssigneeFilter = { kind: 'unassigned' } | { kind: 'user'; id: string };

type ScopedTicket = Omit<TicketListRow, 'updatedAt' | 'createdAt'> & {
  updatedAt: Date;
  createdAt: Date;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseOptionalEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!(allowed as readonly string[]).includes(value)) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return value as T;
}

function requireUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return value;
}

function parseAssigneeFilter(value?: string): AssigneeFilter | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === UNASSIGNED_ASSIGNEE_QUERY) {
    return { kind: 'unassigned' };
  }
  return { kind: 'user', id: requireUuid(value, 'assigneeId') };
}

function matchesFilters(
  ticket: ScopedTicket,
  filters: {
    status?: TicketStatus;
    priority?: Priority;
    clientId?: string;
    assignee?: AssigneeFilter;
  },
): boolean {
  if (filters.status !== undefined && ticket.status !== filters.status) {
    return false;
  }
  if (filters.priority !== undefined && ticket.priority !== filters.priority) {
    return false;
  }
  if (filters.clientId !== undefined && ticket.client.id !== filters.clientId) {
    return false;
  }
  if (filters.assignee?.kind === 'unassigned') {
    return ticket.assignee === null;
  }
  if (filters.assignee?.kind === 'user') {
    return ticket.assignee?.id === filters.assignee.id;
  }
  return true;
}

function filterOptionsFromScope(
  tickets: ScopedTicket[],
): TicketListFilterOptions {
  const clientsById = new Map<string, TicketListClient>();
  const assigneesById = new Map<string, TicketListPerson>();
  let includeUnassigned = false;

  for (const ticket of tickets) {
    clientsById.set(ticket.client.id, ticket.client);
    if (ticket.assignee === null) {
      includeUnassigned = true;
    } else {
      assigneesById.set(ticket.assignee.id, ticket.assignee);
    }
  }

  return {
    clients: [...clientsById.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
    assignees: [...assigneesById.values()].sort((left, right) =>
      left.displayName.localeCompare(right.displayName),
    ),
    includeUnassigned,
  };
}

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: PublicUser,
    query: TicketListFilters = {},
  ): Promise<TicketListEnvelope> {
    const status = parseOptionalEnum(query.status, TICKET_STATUSES, 'status');
    const priority = parseOptionalEnum(query.priority, PRIORITIES, 'priority');
    const clientId =
      query.clientId === undefined
        ? undefined
        : requireUuid(query.clientId, 'clientId');
    const seesAllTickets = hasMinimumRole(user.role, 'supervisor');
    const assignee = seesAllTickets
      ? parseAssigneeFilter(query.assigneeId)
      : undefined;

    const scoped = await this.prisma.ticket.findMany({
      where: seesAllTickets
        ? {}
        : {
            OR: [{ assigneeId: user.id }, { createdById: user.id }],
          },
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

    const tickets = scoped.filter((ticket) =>
      matchesFilters(ticket, { status, priority, clientId, assignee }),
    );

    return {
      tickets: tickets.map((ticket) => ({
        ...ticket,
        updatedAt: ticket.updatedAt.toISOString(),
        createdAt: ticket.createdAt.toISOString(),
      })),
      filterOptions: scoped.length
        ? filterOptionsFromScope(scoped)
        : EMPTY_TICKET_LIST_FILTER_OPTIONS,
    };
  }
}
