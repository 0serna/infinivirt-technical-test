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
Message on a Ticket thread. Visibility is `public` (customer-facing) or `internal` (staff only). In the first release, with no Client portal, every authenticated User who can consult the Ticket sees both types. Consult includes the full Comment thread, oldest first (both visibilities). Adding a Comment requires List Scope (same as consult); being Assignee or `created_by` is not an extra gate. Allowed in any Ticket Status. Append-only: body and visibility do not change after create. Creating a Comment refreshes the Ticket's `updated_at`. Agent may create only `public`; Supervisor and Administrator may create `public` or `internal` (cascade). Composer defaults: Agent `public`; Supervisor and Administrator `internal`. When visibility is omitted on create (API), it is `public`. A consultable Ticket can still reject a create when the Role may not use the requested visibility — that is Authorization, not “Ticket does not exist”.
_Avoid_: Note, message, reply (as a domain type); treating Superv/Admin composer default as if the API omitted-visibility default changed

**Status Transition**:
Change of Ticket Status recorded in an append-only history (from, to, at, by). Status on the Ticket is the current projection. The actor names `to`; `from` is always the current Status. Creating a Ticket records a birth row (`from` absent → `open`, by `created_by`). Consult of a Ticket includes the full history, every cycle, oldest first — same visibility as the Ticket. On reopen (`closed` → `open`), `resolved_at` and `closed_at` are cleared; Assignee is unchanged; history keeps prior cycles. Entering `resolved` sets `resolved_at`; entering `closed` sets `closed_at`. Same `to` as current is not a legal transition. Rejected attempts do not append a row or change timestamps. Who may consult is List Scope; who may record a Status Transition is Authorization — a consultable Ticket can still reject a Transition (illegal edge vs Role/Assignee) without pretending the Ticket does not exist.
_Avoid_: Overwriting columns with no history; status derived only from history with no projection; hiding history from Agents; treating reopen as Reassignment; skipping birth; showing only the current cycle; no-op “transitions” to the current Status; collapsing out-of-scope, illegal edge, and unauthorized into one outcome

**List Scope**:
The set of Tickets a User may consult — the Ticket List and any later single-Ticket consult. Agent: Tickets where they are Assignee or `created_by` (unassigned Tickets they did not create are out). Supervisor and Administrator: all Tickets. A Ticket outside this set is not consultable; consult does not announce that it exists. Distinct from the Operational Dashboard, which counts Open Tickets assigned to the Agent.
_Avoid_: “within list scope” without this set; treating consult as assignee-only; a shared unassigned queue for Agents; equating List Scope with who may update; a table-only recorte that a direct consult can bypass

**Ticket List**:
Consult view of Tickets in the User’s List Scope, all Status values unless filtered. Each row includes Title, Status, Priority, Client, Assignee (nullable), `created_by`, and `updatedAt`. Narrows by Status, Priority, and Client; Supervisor and Administrator may also narrow by Assignee, including unassigned (`Assignee` null). Filter choices come from Tickets already in List Scope; they do not require listing the Client or User catalogs.
_Avoid_: Search-by-Title as a required list dimension; Assignee as a filter that widens an Agent’s List Scope; treating list filters as Administrator catalog access

### Status and priority

**Ticket Status**:
Current lifecycle state of a Ticket. The only legal forward edges are the next step in `open` → `in_progress` → `resolved` → `closed`. The only reverse edge is reopen: `closed` → `open`. No Role may skip or jump (Administrator included). Close and reopen are Administrator-only; Agent and Supervisor stop at `resolved` even when Assignee.
_Avoid_: State-machine labels outside this set; a second graph for Administrator; `resolved` → `in_progress` or other back-steps

**Open Ticket**:
Ticket in operational load: Status `open` or `in_progress`. Does not include `resolved` or `closed`.
_Avoid_: Active, pending (as the metric definition)

**Priority**:
Urgency of a Ticket: `low`, `medium`, `high`, or `critical`. Default on create: `medium`. May change over the Ticket's life; only the current value is kept (no append-only Priority history, unlike Status and Assignee).
_Avoid_: Severity (unless split later), custom priorities; treating Priority as immutable

### Authorization (cascade)

**Agent**:
May consult Tickets in their List Scope, create tickets, add `public` Comments. May record forward Status Transitions through `resolved` only when Assignee. Creating the Ticket, or consulting it, is not enough. Cannot close or reopen. Unassigned Tickets are frozen for this Role.

**Supervisor**:
Everything an Agent can do, plus: list all tickets, reassign, see team metrics, review stale/overdue tickets, and `internal` Comments (in addition to `public`). Does not close or reopen. Does not edit fields or Status on a Ticket they are not Assignee of (except Reassignment).

**Administrator**:
Everything a Supervisor can do, plus: update any ticket, assign to anyone, list Users and Clients, close and reopen. May record any legal Status Transition on any Ticket (including unassigned) without being Assignee.

### Metrics views

**Operational Dashboard**:
View at `/dashboard`. Administrator and Supervisor see team/account metrics; Agent sees only their own load (Open Tickets assigned to them). Same route, different data by Role.
_Avoid_: Separate agent home vs admin dashboard as different products
