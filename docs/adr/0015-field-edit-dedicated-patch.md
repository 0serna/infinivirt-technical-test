# Field Edit is not Status Transition

`PATCH /tickets/:id` already means Status Transition (`{ status }`). Field Edit is a different operation (Title, description, Priority; no history; Supervisor and Administrator; any Ticket Status). Overloading that path would break existing status clients and collapse two Authorization rules into one body. Field Edit uses `PATCH /tickets/:id/fields` with optional `title`, `description`, and `priority` (at least one required). Extra keys are stripped like other ticket bodies.
