## Repository Structure

```text
.
├── apps/
│   ├── api/              # NestJS HTTP API
│   └── web/              # React UI served by nginx in Compose
├── packages/
│   └── shared/
├── docs/
│   ├── adr/
│   └── agents/
└── scripts/              # host checks against the Compose stack
```

## Repository Commands

- `npm run compose:up`: start Postgres, the API, and the web UI with Compose.
- `npm run compose:down`: stop the Compose stack.
- `npm run smoke`: curl API health, proxied health, and the web UI from the host.
- `npm run build`: build workspace packages.
- `npm test`: run workspace tests.
- `npm run test:e2e`: run API end-to-end tests.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.
