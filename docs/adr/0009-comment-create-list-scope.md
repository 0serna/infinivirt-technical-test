# Comment create gated by List Scope, not Assignee

Status Transitions on a consultable Ticket can still be rejected by Role/Assignee rules. Adding a Comment does not: if the Ticket is in the actor’s List Scope, they may create a Comment, subject only to Role visibility (`public` for Agent; `public` or `internal` for Supervisor and Administrator). Being Assignee or `created_by` is not an extra gate. Out of List Scope stays “does not exist”; forbidden visibility on a consultable Ticket is Authorization, not absence.
