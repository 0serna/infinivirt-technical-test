import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  COMMENT_VISIBILITIES,
  type CreateTicketBody,
  type CreateTicketCommentBody,
  hasMinimumRole,
  isLegalStatusEdge,
  mayRecordReassignment,
  mayRecordStatusTransition,
  OPEN_TICKET_STATUSES,
  type PatchTicketAssigneeBody,
  type PatchTicketStatusBody,
  PRIORITIES,
  type Priority,
  staleTicketCutoff,
  TICKET_LIST_ASSIGNED_OPEN_SCOPE,
  TICKET_LIST_STALE_QUERY,
  TICKET_STATUSES,
  type TicketDetail,
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
import { requireTrimmed } from '../http/require-trimmed';
import { requireUuid } from '../http/require-uuid';
import { PrismaService } from '../prisma/prisma.service';
import {
  ticketListRowSelect,
  ticketPersonSelect,
  toTicketListRow,
} from './ticket-list-row';

type AssigneeFilter = { kind: 'unassigned' } | { kind: 'user'; id: string };

type ScopedTicket = Omit<TicketListRow, 'updatedAt' | 'createdAt'> & {
  updatedAt: Date;
  createdAt: Date;
};

const historyAsc = [{ changedAt: 'asc' as const }, { id: 'asc' as const }];

const ticketDetailSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  updatedAt: true,
  createdAt: true,
  description: true,
  resolvedAt: true,
  closedAt: true,
  client: { select: { id: true, name: true } },
  assignee: { select: ticketPersonSelect },
  createdBy: { select: ticketPersonSelect },
  statusHistory: {
    orderBy: historyAsc,
    select: {
      fromStatus: true,
      toStatus: true,
      changedAt: true,
      changedBy: { select: ticketPersonSelect },
    },
  },
  assignments: {
    orderBy: historyAsc,
    select: {
      changedAt: true,
      fromAssignee: { select: ticketPersonSelect },
      toAssignee: { select: ticketPersonSelect },
      changedBy: { select: ticketPersonSelect },
    },
  },
  comments: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      id: true,
      body: true,
      visibility: true,
      createdAt: true,
      author: { select: ticketPersonSelect },
    },
  },
} satisfies Prisma.TicketSelect;

type TicketDetailRecord = Prisma.TicketGetPayload<{
  select: typeof ticketDetailSelect;
}>;

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

function parseRequiredEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string') {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return parseOptionalEnum(value, allowed, field) as T;
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

function parseAssigneeId(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new BadRequestException('Invalid assigneeId');
  }
  return requireUuid(value, 'assigneeId');
}

function parseStatusFilters(
  value: string | string[] | undefined,
): TicketStatus[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  const rawParts = Array.isArray(value) ? value : value.split(',');
  const parts = rawParts
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return undefined;
  }
  const statuses: TicketStatus[] = [];
  for (const part of parts) {
    statuses.push(parseRequiredEnum(part, TICKET_STATUSES, 'status'));
  }
  return [...new Set(statuses)];
}

function parseExactQueryFlag(
  value: string | undefined,
  allowed: string,
  field: string,
): boolean {
  if (value === undefined) {
    return false;
  }
  if (value !== allowed) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return true;
}

function matchesFilters(
  ticket: ScopedTicket,
  filters: {
    statuses?: TicketStatus[];
    priority?: Priority;
    clientId?: string;
    assignee?: AssigneeFilter;
    staleBefore?: Date;
  },
): boolean {
  if (
    filters.statuses !== undefined &&
    !filters.statuses.includes(ticket.status)
  ) {
    return false;
  }
  if (filters.priority !== undefined && ticket.priority !== filters.priority) {
    return false;
  }
  if (filters.clientId !== undefined && ticket.client.id !== filters.clientId) {
    return false;
  }
  if (filters.staleBefore !== undefined) {
    if (ticket.status === 'closed') {
      return false;
    }
    if (ticket.updatedAt >= filters.staleBefore) {
      return false;
    }
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

function listScopeWhere(user: PublicUser): Prisma.TicketWhereInput {
  if (hasMinimumRole(user.role, 'supervisor')) {
    return {};
  }
  return {
    OR: [{ assigneeId: user.id }, { createdById: user.id }],
  };
}

function toTicketDetail(ticket: TicketDetailRecord): TicketDetail {
  const {
    updatedAt,
    createdAt,
    resolvedAt,
    closedAt,
    statusHistory,
    assignments,
    comments,
    ...rest
  } = ticket;
  return {
    ...rest,
    updatedAt: updatedAt.toISOString(),
    createdAt: createdAt.toISOString(),
    resolvedAt: resolvedAt?.toISOString() ?? null,
    closedAt: closedAt?.toISOString() ?? null,
    statusHistory: statusHistory.map((row) => ({
      from: row.fromStatus,
      to: row.toStatus,
      changedAt: row.changedAt.toISOString(),
      changedBy: row.changedBy,
    })),
    assignments: assignments.map((row) => ({
      from: row.fromAssignee,
      to: row.toAssignee,
      changedAt: row.changedAt.toISOString(),
      changedBy: row.changedBy,
    })),
    comments: comments.map(({ createdAt, ...row }) => ({
      ...row,
      createdAt: createdAt.toISOString(),
    })),
  };
}

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: PublicUser,
    query: TicketListFilters & { status?: string | string[] } = {},
  ): Promise<TicketListEnvelope> {
    const statuses = parseStatusFilters(query.status);
    const priority = parseOptionalEnum(query.priority, PRIORITIES, 'priority');
    const clientId =
      query.clientId === undefined
        ? undefined
        : requireUuid(query.clientId, 'clientId');
    const stale = parseExactQueryFlag(
      query.stale,
      TICKET_LIST_STALE_QUERY,
      'stale',
    );
    const assignedOpen = parseExactQueryFlag(
      query.scope,
      TICKET_LIST_ASSIGNED_OPEN_SCOPE,
      'scope',
    );
    const seesAllTickets = hasMinimumRole(user.role, 'supervisor');
    let assignee = seesAllTickets
      ? parseAssigneeFilter(query.assigneeId)
      : undefined;

    let effectiveStatuses = statuses;
    if (assignedOpen) {
      // Assigned-open is always Open Ticket load for the current Assignee —
      // ignore any client `status` that would widen or narrow away from Open.
      assignee = { kind: 'user', id: user.id };
      effectiveStatuses = [...OPEN_TICKET_STATUSES];
    }

    const staleBefore = stale ? staleTicketCutoff() : undefined;

    const scoped = await this.prisma.ticket.findMany({
      where: listScopeWhere(user),
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: ticketListRowSelect,
    });

    const tickets = scoped.filter((ticket) =>
      matchesFilters(ticket, {
        statuses: effectiveStatuses,
        priority,
        clientId,
        assignee,
        staleBefore,
      }),
    );

    return {
      tickets: tickets.map(toTicketListRow),
      filterOptions: filterOptionsFromScope(scoped),
    };
  }

  async getById(user: PublicUser, id: string): Promise<TicketDetail> {
    return toTicketDetail(
      await this.requireScopedTicket(user, id, ticketDetailSelect),
    );
  }

  async create(
    user: PublicUser,
    body: CreateTicketBody,
  ): Promise<TicketDetail> {
    const title = requireTrimmed(body?.title, 'title');
    const description = requireTrimmed(body?.description, 'description');
    if (typeof body?.clientId !== 'string') {
      throw new BadRequestException('Invalid clientId');
    }
    const clientId = requireUuid(body.clientId, 'clientId');
    const priority =
      parseOptionalEnum(body.priority, PRIORITIES, 'priority') ?? 'medium';

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException();
    }

    const created = await this.prisma.ticket.create({
      data: {
        clientId,
        title,
        description,
        status: 'open',
        priority,
        createdById: user.id,
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: 'open',
            changedById: user.id,
          },
        },
      },
      select: ticketDetailSelect,
    });

    return toTicketDetail(created);
  }

  async createComment(
    user: PublicUser,
    id: string,
    body: CreateTicketCommentBody,
  ): Promise<TicketDetail> {
    const commentBody = requireTrimmed(body?.body, 'body');
    const visibility =
      parseOptionalEnum(body.visibility, COMMENT_VISIBILITIES, 'visibility') ??
      'public';

    const ticket = await this.requireScopedTicket(user, id, { id: true });

    // List Scope (non-existence) is checked first — never leak via 403.
    if (visibility === 'internal' && !hasMinimumRole(user.role, 'supervisor')) {
      throw new ForbiddenException();
    }

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        updatedAt: new Date(),
        comments: {
          create: {
            authorId: user.id,
            body: commentBody,
            visibility,
          },
        },
      },
    });

    return this.getById(user, ticket.id);
  }

  async recordReassignment(
    user: PublicUser,
    id: string,
    body: PatchTicketAssigneeBody,
  ): Promise<TicketDetail> {
    const toAssigneeId = parseAssigneeId(body?.assigneeId);
    const ticket = await this.requireScopedTicket(user, id, {
      id: true,
      assigneeId: true,
    });

    // List Scope (non-existence) is checked first — never leak via 403.
    if (!mayRecordReassignment(user.role)) {
      throw new ForbiddenException();
    }

    if (toAssigneeId === ticket.assigneeId) {
      return this.getById(user, ticket.id);
    }

    if (toAssigneeId !== null) {
      const target = await this.prisma.user.findFirst({
        where: { id: toAssigneeId, deletedAt: null },
        select: { id: true },
      });
      if (!target) {
        throw new BadRequestException('Unknown assigneeId');
      }
    }

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assigneeId: toAssigneeId,
        updatedAt: new Date(),
        assignments: {
          create: {
            fromAssigneeId: ticket.assigneeId,
            toAssigneeId,
            changedById: user.id,
          },
        },
      },
    });

    return this.getById(user, ticket.id);
  }

  async recordStatusTransition(
    user: PublicUser,
    id: string,
    body: PatchTicketStatusBody,
  ): Promise<TicketDetail> {
    const to = parseRequiredEnum(body?.status, TICKET_STATUSES, 'status');
    const ticket = await this.requireScopedTicket(user, id, {
      id: true,
      status: true,
      assigneeId: true,
    });

    if (!isLegalStatusEdge(ticket.status, to)) {
      throw new ConflictException();
    }

    if (
      !mayRecordStatusTransition({
        from: ticket.status,
        to,
        role: user.role,
        actorId: user.id,
        assigneeId: ticket.assigneeId,
      })
    ) {
      throw new ForbiddenException();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: to,
          ...(to === 'resolved' && { resolvedAt: new Date() }),
          ...(to === 'closed' && { closedAt: new Date() }),
          ...(ticket.status === 'closed' &&
            to === 'open' && { resolvedAt: null, closedAt: null }),
        },
      });
      await tx.ticketStatusHistory.create({
        data: {
          ticketId: ticket.id,
          fromStatus: ticket.status,
          toStatus: to,
          changedById: user.id,
        },
      });
    });

    return this.getById(user, ticket.id);
  }

  private async requireScopedTicket<TSelect extends Prisma.TicketSelect>(
    user: PublicUser,
    id: string,
    select: TSelect,
  ): Promise<Prisma.TicketGetPayload<{ select: TSelect }>> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: requireUuid(id, 'id'), ...listScopeWhere(user) },
      select,
    });
    if (!ticket) {
      throw new NotFoundException();
    }
    return ticket;
  }
}
