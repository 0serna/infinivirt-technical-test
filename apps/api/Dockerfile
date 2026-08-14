FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src
COPY apps/api ./apps/api

RUN npm ci
RUN npm run build -w @support-ticketing/api

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src

RUN npm ci --omit=dev

COPY --from=build /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
