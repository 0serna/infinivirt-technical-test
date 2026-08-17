export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'closed',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export type Priority = (typeof PRIORITIES)[number];

/** Query value for Assignee null. Not a User id. */
export const UNASSIGNED_ASSIGNEE_QUERY = 'unassigned';

export type TicketListPerson = {
  id: string;
  displayName: string;
};

export type TicketListClient = {
  id: string;
  name: string;
};

export type TicketListRow = {
  id: string;
  title: string;
  status: TicketStatus;
  priority: Priority;
  client: TicketListClient;
  assignee: TicketListPerson | null;
  createdBy: TicketListPerson;
  updatedAt: string;
  createdAt: string;
};

export type TicketListFilters = {
  status?: string;
  priority?: string;
  clientId?: string;
  assigneeId?: string;
};

export type TicketListFilterOptions = {
  clients: TicketListClient[];
  assignees: TicketListPerson[];
  includeUnassigned: boolean;
};

export type TicketListEnvelope = {
  tickets: TicketListRow[];
  filterOptions: TicketListFilterOptions;
};

export const EMPTY_TICKET_LIST_FILTER_OPTIONS: TicketListFilterOptions = {
  clients: [],
  assignees: [],
  includeUnassigned: false,
};
