# syntax=docker/dockerfile:1.7
#
# Production image for the Rosetta Railway backend. Replaces Nixpacks
# (parking-lot 7): Nixpacks injected every project env var as a build-time
# ARG/ENV, baking secrets like ANTHROPIC_API_KEY and GITHUB_OAUTH_CLIENT_SECRET
# into image layers extractable by anyone with image-pull access. This
# Dockerfile takes the opposite stance — it accepts NO secrets at build time.
# Runtime secrets land via Railway's runtime env injection to the running
# container, not into image bytes.
#
# Build context is the repo root because the runtime needs site/ and
# registry/ as siblings of backend/dist/ (Fastify @fastify/static loads
# them off disk).

FROM node:20-alpine AS deps

WORKDIR /app

# Copy lockfiles first so Docker layer caching works on dependency installs.
COPY package*.json ./
COPY backend/package*.json ./backend/
# backend's postinstall runs `prisma generate`, which needs schema.prisma.
COPY backend/prisma ./backend/prisma

# Root deps (validator only; mcp/ is a separate package not deployed).
RUN npm ci --no-audit --no-fund

# Backend deps (Fastify, Prisma, @prisma/client). postinstall regenerates
# the Prisma client from schema.prisma.
RUN cd backend && npm ci --no-audit --no-fund


FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Copy the rest of the repo. .dockerignore keeps node_modules / dist /
# build artifacts out of the build context.
COPY . .

# prisma generate + tsc. Neither needs DATABASE_URL or any other secret.
RUN cd backend && npm run build


FROM node:20-alpine AS runtime

WORKDIR /app

# Production runtime: keep the same layout the existing Nixpacks deploy
# expected so backend/src/static.ts continues to find site/ and registry/
# at the same relative paths.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/site ./site
COPY --from=build /app/registry ./registry
COPY --from=build /app/package.json ./package.json

# Run prisma:deploy (idempotent schema sync) then start Fastify. Equivalent
# to the previous root `npm run start` script — kept inline so the image
# is self-contained.
CMD cd backend && npm run prisma:deploy && npm run start
