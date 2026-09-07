# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/config ./packages/config
COPY apps/accounting-service ./apps/accounting-service
RUN npm ci
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/config
RUN npm run build --workspace=apps/accounting-service

FROM node:20-alpine AS runner
RUN apk add --no-cache ca-certificates openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/config/package.json ./packages/config/
COPY --from=builder /app/apps/accounting-service/package.json ./apps/accounting-service/
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/accounting-service/prisma ./apps/accounting-service/prisma
COPY --from=builder /app/apps/accounting-service/dist ./apps/accounting-service/dist
WORKDIR /app/apps/accounting-service
EXPOSE 4008
CMD ["node", "dist/main"]
