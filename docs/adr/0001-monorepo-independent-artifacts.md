# Monorepo with independently deployable artifacts

Local development uses a monorepo (`apps/api`, `apps/web`) and Docker Compose for Postgres and the apps. Production on AWS deploys **separate artifacts** (API service vs web SPA) so each can scale and release independently. A single repository keeps shared types and workflow simple; deploy boundaries stay explicit in build outputs and documentation, not as one coupled runtime.
