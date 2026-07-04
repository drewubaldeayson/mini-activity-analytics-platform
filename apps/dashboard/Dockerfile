FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/shared-ui ./apps/shared-ui
COPY apps/dashboard ./apps/dashboard

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mini-analytics/shared build
RUN pnpm --filter @mini-analytics/shared-ui build
RUN pnpm --filter @mini-analytics/dashboard build

FROM nginx:1.27-alpine
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html
EXPOSE 80
