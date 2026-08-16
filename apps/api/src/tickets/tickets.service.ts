import { Injectable } from '@nestjs/common';
import type { Priority, TicketStatus } from '@support-ticketing/shared';
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

export type TicketListEnvelope = {
  tickets: TicketListRow[];
};

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: PublicUser): Promise<TicketListEnvelope> {
    const tickets = await this.prisma.ticket.findMany({
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

    return { tickets };
  }
}
