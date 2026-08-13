# Application stack: NestJS, Prisma, PostgreSQL, React/Vite

The API uses NestJS for modular boundaries, dependency injection, and role-based guards. Persistence is PostgreSQL via Prisma. The UI is React with Vite and React Router. This stack maps cleanly to AWS (RDS Postgres, containerized API, static SPA hosting). Fastify or Drizzle were considered; NestJS and Prisma were preferred for structure and migration tooling at this stage of the product.
