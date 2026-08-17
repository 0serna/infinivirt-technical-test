# Read-only Client catalog for Ticket create

Agents (and thus Supervisor and Administrator) must pick an existing Client when creating a Ticket, but List Scope filter options only expose Clients already on tickets they can see — useless for a first Ticket on a Client. Full Client administration stays Administrator-only (later). Decision: expose a read-only Client catalog (`id`, name) to any Role that may create Tickets; do not overload Ticket List `filterOptions.clients`, and do not invent Clients from the create form.
