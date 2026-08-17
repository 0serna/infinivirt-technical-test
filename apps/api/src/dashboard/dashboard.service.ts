import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DASHBOARD_OPEN_STATUSES,
  DASHBOARD_SHORT_LIST_CAP,
  type DashboardEnvelope,
  EMPTY_TEAM_DASHBOARD,
  hasMinimumRole,
  type TicketListRow,
} from '@support-ticketing/shared';
import type { PublicUser } from '../auth/public-user';
import { PrismaService } from '../prisma/prisma.service';

const listRowSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  updatedAt: true,
  createdAt: true,
  client: { select: { id: true, name: true } },
  assignee: { select: { id: true, displayName: true } },
  createdBy: { select: { id: true, displayName: true } },
} satisfies Prisma.TicketSelect;

type ListRowRecord = Prisma.TicketGetPayload<{ select: typeof listRowSelect }>;

function toListRow(ticket: ListRowRecord): TicketListRow {
  return {
    ...ticket,
    updatedAt: ticket.updatedAt.toISOString(),
    createdAt: ticket.createdAt.toISOString(),
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOperational(user: PublicUser): Promise<DashboardEnvelope> {
    if (hasMinimumRole(user.role, 'supervisor')) {
      // F7.4 (#50): real team Open/Stale aggregations. Stub so Roles above
      // Agent can open /dashboard without crashing.
      return EMPTY_TEAM_DASHBOARD;
    }
    return this.agentDashboard(user.id);
  }

  private async agentDashboard(assigneeId: string): Promise<DashboardEnvelope> {
    const where: Prisma.TicketWhereInput = {
      assigneeId,
      status: { in: [...DASHBOARD_OPEN_STATUSES] },
    };

    const [assignedOpenCount, rows] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: DASHBOARD_SHORT_LIST_CAP,
        select: listRowSelect,
      }),
    ]);

    return {
      kind: 'agent',
      assignedOpenCount,
      assignedOpen: rows.map(toListRow),
    };
  }
}
