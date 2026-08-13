# Local-first runtime, AWS as the documented target

The system runs locally with Docker Compose for day-to-day development. The production target is AWS (containerized API, SPA on object storage/CDN, RDS PostgreSQL), documented with build artifacts, env/config boundaries, and an evolution path in the README. Live cloud deploy is not required for the initial delivery; the packaging and docs are meant so that deploy is a follow-up, not a redesign.
