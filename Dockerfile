# ============================================================
# LEGALIR — Frontend production image (Next.js standalone)
# ============================================================
# Builds apps/frontend inside the npm-workspaces monorepo and ships
# only the Next.js standalone output (server.js + minimal node_modules).
# Build context must be the repo root (needs packages/* + apps/frontend).

FROM node:20-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/i18n/package.json packages/i18n/package.json
COPY packages/testing/package.json packages/testing/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/frontend

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /repo/apps/frontend/.next/standalone ./
COPY --from=builder /repo/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /repo/apps/frontend/public ./apps/frontend/public

EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
