ARG NODE_VERSION=24-slim
ARG PNPM_VERSION=11.25.0

FROM node:${NODE_VERSION} AS base
ARG PNPM_VERSION
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing/package.json apps/landing/package.json
COPY apps/institution/package.json apps/institution/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
ARG NEXT_PUBLIC_DEMO_MODE=true
ARG NEXT_PUBLIC_LANDING_URL=http://localhost:3001
ARG NEXT_PUBLIC_INSTITUTION_APP_URL=http://localhost:3002
ARG NEXT_PUBLIC_ADMIN_APP_URL=http://localhost:3003
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SENTRY_DISABLED=true \
    BUILD_STANDALONE=true \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_DEMO_MODE=${NEXT_PUBLIC_DEMO_MODE} \
    NEXT_PUBLIC_LANDING_URL=${NEXT_PUBLIC_LANDING_URL} \
    NEXT_PUBLIC_INSTITUTION_APP_URL=${NEXT_PUBLIC_INSTITUTION_APP_URL} \
    NEXT_PUBLIC_ADMIN_APP_URL=${NEXT_PUBLIC_ADMIN_APP_URL}
RUN pnpm run build

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir .next && chown node:node .next
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
