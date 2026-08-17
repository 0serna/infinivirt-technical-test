# One Status graph for every Role

The assignment says an Administrator can close or reopen tickets, which is easy to read as jumping to `closed` from any Status. We keep one Ticket Status graph for every Role. Administrator is who may take close and reopen (and transition unassigned Tickets), not a second machine. Skipping would make `resolved_at` / `closed_at` ambiguous and turn Agent/Supervisor rules into a special case of a different graph.
