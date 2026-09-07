# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/config ./packages/config
COPY apps/reinsurance-service ./apps/reinsurance-service
RUN npm ci
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/config
RUN npm run build --workspace=apps/reinsurance-service

FROM node:20-alpine AS runner
RUN apk add --no-cache \
    ca-certificates \
    chromium \
    freetype \
    harfbuzz \
    nss \
    openssl \
    ttf-freefont
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/config/package.json ./packages/config/
COPY --from=builder /app/apps/reinsurance-service/package.json ./apps/reinsurance-service/
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/reinsurance-service/node_modules ./apps/reinsurance-service/node_modules
COPY --from=builder /app/apps/reinsurance-service/prisma ./apps/reinsurance-service/prisma
COPY --from=builder /app/apps/reinsurance-service/dist ./apps/reinsurance-service/dist
WORKDIR /app/apps/reinsurance-service
EXPOSE 4007
CMD ["node", "dist/main"]
