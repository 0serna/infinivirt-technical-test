# Stale Tickets include `resolved`

Operational SQL (query 3) and the Supervisor “sin actualización” review treat a Ticket as stale when `updated_at` is older than 48 hours and Status is not `closed`. That set includes `resolved`. We keep the same rule on the Operational Dashboard instead of narrowing Stale to Open Tickets (`open` | `in_progress`), so metrics stay aligned with the SQL deliverable and Supervisors still see Tickets stuck after resolve. Open Ticket totals remain a separate metric.
