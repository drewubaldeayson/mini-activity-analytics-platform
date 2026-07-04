FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mini-analytics/shared build
RUN pnpm --filter @mini-analytics/backend build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app /app

WORKDIR /app/apps/backend
ENV PORT=4000
EXPOSE 4000
CMD ["node", "dist/main.js"]
