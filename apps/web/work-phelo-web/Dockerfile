FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY apps/web/work-phelo-web/package.json apps/web/work-phelo-web/package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/work-phelo-web/ .
ARG NEXT_PUBLIC_API_URL=https://api.workphelo.com/api/v1
ARG NEXT_PUBLIC_APP_BASE_URL=https://app.workphelo.com
ARG NEXT_PUBLIC_ENABLE_ANNOUNCEMENT_SMS=false
ARG NEXT_PUBLIC_MAPTILER_KEY=
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_BASE_URL=$NEXT_PUBLIC_APP_BASE_URL
ENV NEXT_PUBLIC_ENABLE_ANNOUNCEMENT_SMS=$NEXT_PUBLIC_ENABLE_ANNOUNCEMENT_SMS
ENV NEXT_PUBLIC_MAPTILER_KEY=$NEXT_PUBLIC_MAPTILER_KEY
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=https://api.workphelo.com/api/v1
ARG NEXT_PUBLIC_APP_BASE_URL=https://app.workphelo.com
ARG NEXT_PUBLIC_ENABLE_ANNOUNCEMENT_SMS=false
ARG NEXT_PUBLIC_MAPTILER_KEY=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_BASE_URL=$NEXT_PUBLIC_APP_BASE_URL
ENV NEXT_PUBLIC_ENABLE_ANNOUNCEMENT_SMS=$NEXT_PUBLIC_ENABLE_ANNOUNCEMENT_SMS
ENV NEXT_PUBLIC_MAPTILER_KEY=$NEXT_PUBLIC_MAPTILER_KEY
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
