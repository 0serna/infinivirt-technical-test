import {
  type CommentVisibility,
  PRIORITIES,
  type Priority,
  type TicketStatus,
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

export const PRIORITY_SELECT_DATA = PRIORITIES.map((value) => ({
  value,
  label: PRIORITY_LABEL[value],
}));

export const COMMENT_VISIBILITY_LABEL: Record<CommentVisibility, string> = {
  public: 'Public',
  internal: 'Internal',
};

export const STATUS_COLOR: Record<TicketStatus, string> = {
  open: 'blue',
  in_progress: 'yellow',
  resolved: 'teal',
  closed: 'gray',
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
};

export const COMMENT_VISIBILITY_COLOR: Record<CommentVisibility, string> = {
  public: 'blue',
  internal: 'orange',
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
