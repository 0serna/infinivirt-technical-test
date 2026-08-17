# Local-first runtime, AWS as the documented target

The system runs locally with Docker Compose for day-to-day development. The production target is AWS (containerized API, SPA on object storage/CDN, RDS PostgreSQL), documented with build artifacts, env/config boundaries, and the README. Live cloud deploy is not required for the initial delivery. Packaging and docs should make a later deploy possible without a redesign.
