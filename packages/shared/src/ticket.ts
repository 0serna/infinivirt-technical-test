export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'closed',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export type Priority = (typeof PRIORITIES)[number];
