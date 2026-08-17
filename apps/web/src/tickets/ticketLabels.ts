import type {
  CommentVisibility,
  Priority,
  TicketStatus,
} from '@support-ticketing/shared';

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const COMMENT_VISIBILITY_LABEL: Record<CommentVisibility, string> = {
  public: 'Public',
  internal: 'Internal',
};

export function assigneeLabel(
  person: { displayName: string } | null | undefined,
): string {
  return person?.displayName ?? 'Unassigned';
}

export function formatTicketInstant(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}
