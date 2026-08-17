# Support Ticketing

Internal platform for registering, assigning, and tracking customer support tickets.

## Language

### Actors

**User**:
Authenticated company staff (Administrator, Agent, or Supervisor). Login identity is a unique email (uniqueness includes soft-deleted Users); also has a display name (not required to be unique). Soft-deleted Users cannot authenticate and are excluded from operational User catalogs (Assignee picker); their identity stays visible on Tickets they already touch. Login email does not change after create. A soft-deleted email stays reserved until that User is restored (same person, same login). Soft-deleted Users are not edited until restored.
_Avoid_: Account, operator, employee; hard-deleting Users

**Client**:
Person or organization receiving support. A business record identified by a unique name (uniqueness includes soft-deleted Clients); does not authenticate in the first release. Creating a Ticket attaches an existing non-soft-deleted Client. Soft-deleted Clients are excluded from the create catalog; Tickets already attached keep showing them. Soft-delete is allowed even when Tickets exist. Soft-deleted Clients are not renamed until restored.
_Avoid_: Customer, account, company (when referring to the subject of a ticket); hard-deleting Clients

**Role**:
Access permission for a User. Cascading hierarchy: Administrator ⊃ Supervisor ⊃ Agent (each role includes the permissions of the one below and adds its own).
_Avoid_: Profile, permission set, flat unrelated roles

### Core

**Ticket**:
Unit of support work tied to a single Client for its lifetime (Client does not change after create). Aggregate root: status, priority, assignment, and comments live on it. Created by a User on behalf of the Client (`created_by` is always that authenticated User; no create-as-another-User). At birth: Status `open`, Assignee null, Priority default `medium` (may be set on create), Title and description required (non-empty after trim), plus the Status Transition birth row; no Reassignment row yet. Current-cycle fields: Title, Status, Priority, Assignee (nullable), description, created_by, created_at, updated_at, resolved_at (nullable), closed_at (nullable).
_Avoid_: Request, case, issue, incident (as a synonym for the aggregate); assigning on create; inventing a Client at create; blank Title or description; forging `created_by`

**Title**:
Short label of a Ticket for queues and lists. Distinct from description, which is the body. Required on create (non-empty after trim); not a unique key (duplicates are allowed across and within a Client). May change via Field Edit.
_Avoid_: Subject, summary (as synonyms that replace Title); treating Title as a natural key; treating Title as immutable after create

**Assignee**:
The single User responsible for the Ticket at a given time. May be null if the ticket is unassigned. Any non-soft-deleted User may be chosen as Assignee (Agent, Supervisor, or Administrator); the Role of the target is not filtered. A User who is soft-deleted while still Assignee stays on the Ticket until someone records a Reassignment.
_Avoid_: Owner, handler; Assignee limited to Agent; choosing a soft-deleted User as a new Assignee

**Reassignment**:
Change of a Ticket's Assignee. Every change — first assignment (`null`→user), reassignment (user→user), and unassignment (user→`null`) — is stored in an append-only history; `assignee` on the Ticket is the current projection. “Reassigned more than twice” means more than two rows in that history. Creating a Ticket leaves Assignee null and does not write a history row; the first `null`→user is a Reassignment. Same Assignee as current (including null→null) is not a Reassignment. Supervisor and Administrator share the same Reassignment power on every Ticket in List Scope; Agent has none. Allowed in any Ticket Status. The actor may choose themselves as Assignee. A non-null `to` that is not an existing non-soft-deleted User rejects the change; that is not “Ticket does not exist”. Soft-deleting a User does not itself write a Reassignment. A successful Reassignment refreshes the Ticket's `updated_at`. Consult of a Ticket includes the full assignment history, oldest first (same visibility as the Ticket).
_Avoid_: Transfer, handoff (as an entity); treating create as the first Reassignment; a birth row for Assignee; a birth `null→null` assignment row; distinct “assign” vs “reassign” operations by Role; forbidding self-assignment; collapsing unknown Assignee target into out-of-scope; blocking Reassignment by Ticket Status; auto-unassign on soft-delete

**Comment**:
Message on a Ticket thread. Visibility is `public` (customer-facing) or `internal` (staff only). In the first release, with no Client portal, every authenticated User who can consult the Ticket sees both types. Consult includes the full Comment thread, oldest first (both visibilities). Adding a Comment requires List Scope (same as consult); being Assignee or `created_by` is not an extra gate. Allowed in any Ticket Status. Append-only: body and visibility do not change after create. Creating a Comment refreshes the Ticket's `updated_at`. Agent may create only `public`; Supervisor and Administrator may create `public` or `internal` (cascade). Composer defaults: Agent `public`; Supervisor and Administrator `internal`. When visibility is omitted on create (API), it is `public`. A consultable Ticket can still reject a create when the Role may not use the requested visibility. That is Authorization, not “Ticket does not exist”.
_Avoid_: Note, message, reply (as a domain type); treating Superv/Admin composer default as if the API omitted-visibility default changed

**Status Transition**:
Change of Ticket Status recorded in an append-only history (from, to, at, by). Status on the Ticket is the current projection. The actor names `to`; `from` is always the current Status. Creating a Ticket records a birth row (`from` absent → `open`, by `created_by`). Consult of a Ticket includes the full history, every cycle, oldest first (same visibility as the Ticket). On reopen (`closed` → `open`), `resolved_at` and `closed_at` are cleared; Assignee is unchanged; history keeps prior cycles. Entering `resolved` sets `resolved_at`; entering `closed` sets `closed_at`. Same `to` as current is not a legal transition. Rejected attempts do not append a row or change timestamps. Who may consult is List Scope; who may record a Status Transition is Authorization. A consultable Ticket can still reject a Transition (illegal edge vs Role/Assignee) without pretending the Ticket does not exist.
_Avoid_: Overwriting columns with no history; status derived only from history with no projection; hiding history from Agents; treating reopen as Reassignment; skipping birth; showing only the current cycle; no-op “transitions” to the current Status; collapsing out-of-scope, illegal edge, and unauthorized into one outcome

**Field Edit**:
Change of a Ticket's Title, description, and/or Priority after create. Client, Status, Assignee, and `created_by` are not this operation. Only current values are kept; no append-only Field Edit history (unlike Status and Assignee). Supervisor and Administrator share this power on every Ticket in List Scope; Agent has none (even when Assignee or `created_by`). Allowed in any Ticket Status; does not reopen, skip, or record a Status Transition. Being Assignee is not required. A successful change refreshes the Ticket's `updated_at`; the same Title, description, and Priority as current is not a Field Edit. Title and description that are sent must be non-empty after trim; omitted fields stay unchanged. A rejected attempt does not change values or timestamps. Who may consult is List Scope; who may Field Edit is Authorization. A consultable Ticket can still reject Field Edit without pretending the Ticket does not exist.
_Avoid_: Update, patch, “actualizar ticket” (as a synonym that collapses Status Transition, Reassignment, and Field Edit); Assignee-gating Field Edit; a Priority or Title history; editing Client; mixing Field Edit into Status Transition

**List Scope**:
The set of Tickets a User may consult: the Ticket List and any later single-Ticket consult. Agent: Tickets where they are Assignee or `created_by` (unassigned Tickets they did not create are out). Supervisor and Administrator: all Tickets. A Ticket outside this set is not consultable; consult does not announce that it exists. Distinct from the Operational Dashboard, which counts Open Tickets assigned to the Agent.
_Avoid_: “within list scope” without this set; treating consult as assignee-only; a shared unassigned queue for Agents; equating List Scope with who may update; a table-only recorte that a direct consult can bypass

**Ticket List**:
Consult view of Tickets in the User’s List Scope, all Status values unless filtered. Route `/tickets` (not the post-login home). Each row includes Title, Status, Priority, Client, Assignee (nullable), `created_by`, and `updatedAt`. Narrows by Status (including multi-Status for Open Ticket load), Priority, Client, and Stale Ticket; Supervisor and Administrator may also narrow by Assignee, including unassigned (`Assignee` null). An Agent may narrow to Open Tickets where they are Assignee (dashboard “my load” deep-link) without widening List Scope. Filter choices come from Tickets already in List Scope; they do not require listing the Client or User catalogs. Distinct from the read-only Client catalog used when creating a Ticket. Accepts the same filters from the URL so Operational Dashboard counters can deep-link here.
_Avoid_: Search-by-Title as a required list dimension; Assignee as a filter that widens an Agent’s List Scope; treating list filters as Administrator catalog access; overloading list `filterOptions.clients` as the create-time Client picker; ignoring URL filters from the dashboard

### Status and priority

**Ticket Status**:
Current lifecycle state of a Ticket. The only legal forward edges are the next step in `open` → `in_progress` → `resolved` → `closed`. The only reverse edge is reopen: `closed` → `open`. No Role may skip or jump (Administrator included). Close and reopen are Administrator-only; Agent and Supervisor stop at `resolved` even when Assignee.
_Avoid_: State-machine labels outside this set; a second graph for Administrator; `resolved` → `in_progress` or other back-steps

**Open Ticket**:
Ticket in operational load: Status `open` or `in_progress`. Does not include `resolved` or `closed`.
_Avoid_: Active, pending (as the metric definition)

**Stale Ticket**:
Ticket with `updated_at` older than 48 hours and Status ≠ `closed`. Includes `resolved`. Distinct from Open Ticket: a Stale Ticket may be `resolved`; an Open Ticket may be fresh. There is no separate due-date or SLA “overdue” concept in the first release.
_Avoid_: Overdue, vencido (as a second metric); equating Stale with Open; excluding `resolved` from Stale to match Open Ticket

**Priority**:
Urgency of a Ticket: `low`, `medium`, `high`, or `critical`. Default on create: `medium`. May change via Field Edit; only the current value is kept (no append-only Priority history, unlike Status and Assignee).
_Avoid_: Severity (unless split later), custom priorities; treating Priority as immutable

### Authorization (cascade)

**Agent**:
May consult Tickets in their List Scope, create tickets, add `public` Comments. To create, may consult the active Client catalog read-only (`id`, name), non-soft-deleted only; not Client administration and not List Scope filter options. May record forward Status Transitions through `resolved` only when Assignee. Creating the Ticket, or consulting it, is not enough. Cannot close or reopen. Cannot record a Reassignment or Field Edit (even on Tickets they created or are Assignee of). Unassigned Tickets are frozen for this Role.

**Supervisor**:
Everything an Agent can do, plus: list all tickets, Reassignment (first assign, reassign, and unassign), Field Edit, consult a read-only list of active Users to choose an Assignee, see team metrics, review Stale Tickets, and `internal` Comments (in addition to `public`). Does not close or reopen. Does not record a Status Transition on a Ticket they are not Assignee of. Does not administer Users or Clients.

**Administrator**:
Everything a Supervisor can do, plus: administer Users and Clients, close and reopen. Catalog administration is create, update, soft-delete, and restore of Users and Clients, plus resetting a User's password. User update covers display name and Role (not email) and applies only to non-soft-deleted Users. Client update is rename and applies only to non-soft-deleted Clients. Administrator may list soft-deleted rows to restore. An Administrator cannot soft-delete themselves. There is always at least one non-soft-deleted Administrator. Soft-delete or demotion of the last one is rejected. May record any legal Status Transition on any Ticket (including unassigned) without being Assignee. Reassignment and Field Edit power match Supervisor; those are not Admin-only operations.

### Metrics views

**Operational Dashboard**:
Default authenticated home for every Role (`/` redirects to `/dashboard`; same page component). Layout: KPI strip of counters plus short tables (chosen prototype variant A). Payload differs by Role. Agent: personal load only. Count and short list (cap 10, oldest `updated_at` first) of Open Tickets where they are Assignee (not merely `created_by`); no team totals; no Stale section. Supervisor and Administrator: the same team payload. Total Open Tickets (unassigned included), Open breakdown by Status (`open` / `in_progress`), Stale Ticket count and short linkable list (cap 10, oldest `updated_at` first). Open-by-Priority and Open-by-Assignee are out of the required set for this view. Each counter deep-links to the Ticket List with the matching filter(s) applied via URL; row links go to Ticket consult.
_Avoid_: Separate agent home vs admin dashboard as different products; Agent team-wide metrics; treating List Scope as the Agent dashboard filter; a richer Admin-only dashboard in this view; Ticket List as the post-login landing; counters that only display with no path into the filtered list
