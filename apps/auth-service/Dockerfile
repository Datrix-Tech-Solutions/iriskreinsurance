# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/schemas ./packages/schemas
COPY packages/utils ./packages/utils
COPY packages/config ./packages/config
COPY apps/auth-service ./apps/auth-service
RUN npm ci
RUN cd apps/auth-service && npx prisma@5.22.0 generate
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/schemas
RUN npm run build --workspace=packages/utils
RUN npm run build --workspace=packages/config
RUN npm run build --workspace=apps/auth-service
# Compile seed.ts and seed-resources.ts to JavaScript
# Use --rootDir . so that relative imports (../src/...) resolve correctly:
# src/permissions/... → dist/permissions/...
# prisma/seed.ts → dist/prisma/seed.js
RUN cd apps/auth-service && npx tsc \
  --rootDir . \
  --outDir dist \
  --module commonjs \
  --target es2020 \
  --skipLibCheck \
  prisma/seed.ts prisma/seed-resources.ts

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
# Copy root workspace manifest + lockfile
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
# Copy ALL workspace package.json files so npm can resolve the workspace graph
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/schemas/package.json ./packages/schemas/
COPY --from=builder /app/packages/utils/package.json ./packages/utils/
COPY --from=builder /app/packages/config/package.json ./packages/config/
COPY --from=builder /app/apps/auth-service/package.json ./apps/auth-service/
# Copy built workspace package dist folders so local @work-phelo/* imports resolve
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/schemas/dist ./packages/schemas/dist
COPY --from=builder /app/packages/utils/dist ./packages/utils/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/auth-service/node_modules ./apps/auth-service/node_modules
RUN npm rebuild bcrypt --update-binary
# Copy built service (dist includes compiled seed.js and seed-resources.js)
COPY --from=builder /app/apps/auth-service/dist ./apps/auth-service/dist
# Runtime app code expects the generated client under apps/auth-service/prisma/generated/client.
# The compiled seed expects the same client under dist/prisma/generated/client.
COPY --from=builder /app/apps/auth-service/prisma/generated/client ./apps/auth-service/prisma/generated/client
COPY --from=builder /app/apps/auth-service/prisma/generated/client ./apps/auth-service/dist/prisma/generated/client
COPY --from=builder /app/apps/auth-service/prisma/schema.prisma ./apps/auth-service/prisma/schema.prisma
COPY --from=builder /app/apps/auth-service/prisma/migrations ./apps/auth-service/prisma/migrations
WORKDIR /app/apps/auth-service
EXPOSE 4001
CMD ["node", "dist/main"]

