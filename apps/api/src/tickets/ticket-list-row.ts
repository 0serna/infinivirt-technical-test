import type { Prisma } from '@prisma/client';
import type { TicketListRow } from '@support-ticketing/shared';

export const ticketPersonSelect = { id: true, displayName: true } as const;

export const ticketListRowSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  updatedAt: true,
  createdAt: true,
  client: { select: { id: true, name: true } },
  assignee: { select: ticketPersonSelect },
  createdBy: { select: ticketPersonSelect },
} satisfies Prisma.TicketSelect;

export type TicketListRowRecord = Prisma.TicketGetPayload<{
  select: typeof ticketListRowSelect;
}>;

export function toTicketListRow(ticket: TicketListRowRecord): TicketListRow {
  return {
    ...ticket,
    updatedAt: ticket.updatedAt.toISOString(),
    createdAt: ticket.createdAt.toISOString(),
  };
}
