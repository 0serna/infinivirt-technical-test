-- Operational queries for the Support Ticketing domain.
-- Run against a migrated + seeded database (see README).
--
-- Rolling window for queries 4 and 8 (shared definition):
--   NOW() - INTERVAL '30 days'
-- Projection fields: tickets.resolved_at, tickets.closed_at, tickets.created_at.
-- Reopen (closed → open) clears resolved_at/closed_at on the Ticket projection;
-- that can under-count queries 4 and 5 relative to status history.

-- =============================================================================
-- 1. Ticket counts by Status per Client
-- =============================================================================
SELECT
  c.name AS client_name,
  t.status,
  COUNT(*)::bigint AS ticket_count
FROM tickets t
JOIN clients c ON c.id = t.client_id
GROUP BY c.name, t.status
ORDER BY c.name, t.status;

-- =============================================================================
-- 2. Top 5 Clients by high/critical Tickets
-- =============================================================================
SELECT
  c.name AS client_name,
  COUNT(*)::bigint AS high_or_critical_count
FROM tickets t
JOIN clients c ON c.id = t.client_id
WHERE t.priority IN ('high', 'critical')
GROUP BY c.id, c.name
ORDER BY high_or_critical_count DESC, c.name
LIMIT 5;

-- =============================================================================
-- 3. Tickets with updated_at older than 48h and not closed
-- =============================================================================
SELECT
  t.id,
  t.title,
  t.status,
  t.priority,
  c.name AS client_name,
  t.updated_at
FROM tickets t
JOIN clients c ON c.id = t.client_id
WHERE t.status <> 'closed'
  AND t.updated_at < NOW() - INTERVAL '48 hours'
ORDER BY t.updated_at ASC;

-- =============================================================================
-- 4. User with most Tickets having resolved_at in the last 30 days
--     (Ticket projection; credit = current assignee)
-- =============================================================================
SELECT
  u.id AS user_id,
  u.email,
  u.display_name,
  u.role,
  COUNT(*)::bigint AS resolved_in_window_count
FROM tickets t
JOIN users u ON u.id = t.assignee_id
WHERE t.resolved_at IS NOT NULL
  AND t.resolved_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email, u.display_name, u.role
ORDER BY resolved_in_window_count DESC, u.email
LIMIT 1;

-- =============================================================================
-- 5. Average resolution time by Priority (created_at → resolved_at on projection)
-- =============================================================================
SELECT
  t.priority,
  COUNT(*)::bigint AS resolved_ticket_count,
  AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))) AS avg_resolution_seconds,
  AVG(t.resolved_at - t.created_at) AS avg_resolution_interval
FROM tickets t
WHERE t.resolved_at IS NOT NULL
GROUP BY t.priority
ORDER BY t.priority;

-- =============================================================================
-- 6. Open Tickets per Agent (open | in_progress only)
-- =============================================================================
SELECT
  u.id AS user_id,
  u.email,
  u.display_name,
  COUNT(*)::bigint AS open_ticket_count
FROM tickets t
JOIN users u ON u.id = t.assignee_id
WHERE u.role = 'agent'
  AND t.status IN ('open', 'in_progress')
GROUP BY u.id, u.email, u.display_name
ORDER BY open_ticket_count DESC, u.email;

-- =============================================================================
-- 7. Tickets with more than two assignment-history rows
-- =============================================================================
SELECT
  t.id,
  t.title,
  t.status,
  c.name AS client_name,
  COUNT(ta.id)::bigint AS assignment_history_count
FROM tickets t
JOIN clients c ON c.id = t.client_id
JOIN ticket_assignments ta ON ta.ticket_id = t.id
GROUP BY t.id, t.title, t.status, c.name
HAVING COUNT(ta.id) > 2
ORDER BY assignment_history_count DESC, t.title;

-- =============================================================================
-- 8. Percent closed vs created in the last 30 days (same window as query 4)
--     100 * count(closed_at in window) / count(created_at in window)
--     May exceed 100% when more Tickets close in the window than were created
--     (e.g. backlog closed later than create).
-- =============================================================================
SELECT
  closed_in_window,
  created_in_window,
  CASE
    WHEN created_in_window = 0 THEN NULL
    ELSE ROUND(100.0 * closed_in_window / created_in_window, 2)
  END AS percent_closed_vs_created
FROM (
  SELECT
    (
      SELECT COUNT(*)::bigint
      FROM tickets
      WHERE closed_at IS NOT NULL
        AND closed_at >= NOW() - INTERVAL '30 days'
    ) AS closed_in_window,
    (
      SELECT COUNT(*)::bigint
      FROM tickets
      WHERE created_at >= NOW() - INTERVAL '30 days'
    ) AS created_in_window
) AS counts;
