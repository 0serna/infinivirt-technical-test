# Support Ticketing

Internal platform for registering, assigning, and tracking customer support tickets.

## Language

### Actors

**User**:
Authenticated company staff (Administrator, Agent, or Supervisor). Login identity is a unique email; also has a display name (not required to be unique).
_Avoid_: Account, operator, employee

**Client**:
Person or organization receiving support. A business record identified by a unique name; does not authenticate in the first release.
_Avoid_: Customer, account, company (when referring to the subject of a ticket)

**Role**:
Access permission for a User. Cascading hierarchy: Administrator ⊃ Supervisor ⊃ Agent (each role includes the permissions of the one below and adds its own).
_Avoid_: Profile, permission set, flat unrelated roles

### Core

**Ticket**:
Unit of support work tied to a single Client for its lifetime (Client does not change after create). Aggregate root: status, priority, assignment, and comments live on it. Created by a User on behalf of the Client. Current-cycle fields: Title, Status, Priority, Assignee (nullable), description, created_by, created_at, updated_at, resolved_at (nullable), closed_at (nullable).
_Avoid_: Request, case, issue, incident (as a synonym for the aggregate)

**Title**:
Short label of a Ticket for queues and lists. Distinct from description, which is the body.
_Avoid_: Subject, summary (as synonyms that replace Title)

**Assignee**:
The single User responsible for the Ticket at a given time. May be null if the ticket is unassigned.
_Avoid_: Owner, handler

**Reassignment**:
Change of a Ticket's Assignee. Every change — first assignment (`null`→user), reassignment (user→user), and unassignment (user→`null`) — is stored in an append-only history; `assignee` on the Ticket is the current projection. “Reassigned more than twice” means more than two rows in that history.
_Avoid_: Transfer, handoff (as an entity)

**Comment**:
Message on a Ticket thread. Visibility is `public` (customer-facing) or `internal` (staff only). In the first release, with no Client portal, every authenticated User sees both types. Agents create `public` by default; Supervisor and Administrator may create `internal`.
_Avoid_: Note, message, reply (as a domain type)

**Status Transition**:
Change of Ticket Status recorded in an append-only history (from, to, at, by). Status on the Ticket is the current projection. On reopen (`closed` → `open`), `resolved_at` and `closed_at` on the Ticket are cleared; history keeps prior cycles.
_Avoid_: Overwriting columns with no history; status derived only from history with no projection

### Status and priority

**Ticket Status**:
Current lifecycle state of a Ticket: `open` → `in_progress` → `resolved` → `closed`. Reopen: from `closed` to `open`, Administrator only.
_Avoid_: State-machine labels outside this set

**Open Ticket**:
Ticket in operational load: Status `open` or `in_progress`. Does not include `resolved` or `closed`.
_Avoid_: Active, pending (as the metric definition)

**Priority**:
Urgency of a Ticket: `low`, `medium`, `high`, or `critical`. Default on create: `medium`. May change over the Ticket's life; only the current value is kept (no append-only Priority history, unlike Status and Assignee).
_Avoid_: Severity (unless split later), custom priorities; treating Priority as immutable

### Authorization (cascade)

**Agent**:
May list tickets (within list scope), create tickets, update and change Status only when Assignee, add `public` Comments, move to `resolved` when Assignee.

**Supervisor**:
Everything an Agent can do, plus: list all tickets, reassign, see team metrics, review stale/overdue tickets, `internal` Comments. Does not close or reopen. Does not edit fields/status on a ticket they are not Assignee of (except reassignment).

**Administrator**:
Everything a Supervisor can do, plus: update any ticket, assign to anyone, list Users and Clients, close and reopen.

### Metrics views

**Operational Dashboard**:
View at `/dashboard`. Administrator and Supervisor see team/account metrics; Agent sees only their own load (Open Tickets assigned to them). Same route, different data by Role.
_Avoid_: Separate agent home vs admin dashboard as different products
