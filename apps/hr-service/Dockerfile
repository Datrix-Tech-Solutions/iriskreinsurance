# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/schemas ./packages/schemas
COPY packages/utils ./packages/utils
COPY packages/config ./packages/config
COPY apps/hr-service ./apps/hr-service
RUN npm ci
RUN cd apps/hr-service && npx prisma@5.22.0 generate
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/schemas
RUN npm run build --workspace=packages/utils
RUN npm run build --workspace=packages/config
RUN npm run build --workspace=apps/hr-service
# Compile seed.ts to JavaScript so it can be run with node in the runner stage.
# --rootDir . maps prisma/seed.ts → dist/prisma/seed.js, keeping the relative
# import to ../prisma/generated/client intact at runtime.
RUN cd apps/hr-service && npx tsc \
  --rootDir . \
  --outDir dist \
  --module commonjs \
  --target es2020 \
  --esModuleInterop true \
  --skipLibCheck true \
  prisma/seed.ts

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/schemas/package.json ./packages/schemas/
COPY --from=builder /app/packages/utils/package.json ./packages/utils/
COPY --from=builder /app/packages/config/package.json ./packages/config/
COPY --from=builder /app/apps/hr-service/package.json ./apps/hr-service/
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/schemas/dist ./packages/schemas/dist
COPY --from=builder /app/packages/utils/dist ./packages/utils/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/hr-service/node_modules ./apps/hr-service/node_modules
COPY --from=builder /app/apps/hr-service/prisma ./apps/hr-service/prisma
RUN cd apps/hr-service && npx prisma@5.22.0 generate
COPY --from=builder /app/apps/hr-service/dist ./apps/hr-service/dist
# The compiled seed resolves its Prisma client import at dist/prisma/generated/client
RUN cp -r apps/hr-service/prisma/generated apps/hr-service/dist/prisma/
WORKDIR /app/apps/hr-service
EXPOSE 4002
CMD ["node", "dist/main"]

