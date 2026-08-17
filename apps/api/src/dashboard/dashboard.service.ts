import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DASHBOARD_SHORT_LIST_CAP,
  type DashboardEnvelope,
  hasMinimumRole,
  OPEN_TICKET_STATUSES,
  staleTicketCutoff,
} from '@support-ticketing/shared';
import type { PublicUser } from '../auth/public-user';
import { PrismaService } from '../prisma/prisma.service';
import {
  ticketListRowSelect,
  toTicketListRow,
} from '../tickets/ticket-list-row';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOperational(user: PublicUser): Promise<DashboardEnvelope> {
    return hasMinimumRole(user.role, 'supervisor')
      ? this.teamDashboard()
      : this.agentDashboard(user.id);
  }

  private findShortList(where: Prisma.TicketWhereInput) {
    return this.prisma.ticket.findMany({
      where,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: DASHBOARD_SHORT_LIST_CAP,
      select: ticketListRowSelect,
    });
  }

  private async teamDashboard(): Promise<DashboardEnvelope> {
    const staleWhere: Prisma.TicketWhereInput = {
      status: { not: 'closed' },
      updatedAt: { lt: staleTicketCutoff() },
    };

    const [openCount, inProgressCount, staleCount, staleRows] =
      await Promise.all([
        this.prisma.ticket.count({ where: { status: 'open' } }),
        this.prisma.ticket.count({ where: { status: 'in_progress' } }),
        this.prisma.ticket.count({ where: staleWhere }),
        this.findShortList(staleWhere),
      ]);

    return {
      kind: 'team',
      openTotal: openCount + inProgressCount,
      openByStatus: {
        open: openCount,
        in_progress: inProgressCount,
      },
      staleCount,
      stale: staleRows.map(toTicketListRow),
    };
  }

  private async agentDashboard(assigneeId: string): Promise<DashboardEnvelope> {
    const where: Prisma.TicketWhereInput = {
      assigneeId,
      status: { in: [...OPEN_TICKET_STATUSES] },
    };

    const [openCount, rows] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.findShortList(where),
    ]);

    return {
      kind: 'agent',
      openCount,
      openTickets: rows.map(toTicketListRow),
    };
  }
}
