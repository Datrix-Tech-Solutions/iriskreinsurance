# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/schemas ./packages/schemas
COPY packages/utils ./packages/utils
COPY packages/config ./packages/config
COPY apps/notification-service ./apps/notification-service
RUN npm ci
RUN npm install --workspace=apps/notification-service @nestjs/platform-express --ignore-scripts
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/schemas
RUN npm run build --workspace=packages/utils
RUN npm run build --workspace=packages/config
RUN cd apps/notification-service && npx prisma@5.22.0 generate
RUN npm run build --workspace=apps/notification-service

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
COPY --from=builder /app/apps/notification-service/package.json ./apps/notification-service/
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/schemas/dist ./packages/schemas/dist
COPY --from=builder /app/packages/utils/dist ./packages/utils/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/notification-service/node_modules ./apps/notification-service/node_modules
COPY --from=builder /app/apps/notification-service/prisma ./apps/notification-service/prisma
RUN cd apps/notification-service && npx prisma@5.22.0 generate
COPY --from=builder /app/apps/notification-service/dist ./apps/notification-service/dist
WORKDIR /app/apps/notification-service
EXPOSE 4004
CMD ["node", "dist/main"]


