# One Status graph for every Role

The assignment says an Administrator can close or reopen tickets, which is easy to read as jumping to `closed` from any Status. We use a single legal graph: forward only to the next Status (`open` → `in_progress` → `resolved` → `closed`), and reopen only `closed` → `open`. Administrator is who may take close and reopen (and transition unassigned Tickets), not a second machine. Skipping would make `resolved_at` / `closed_at` ambiguous and turn Agent/Supervisor rules into a special case of a different graph.
