# Pin these tags to verified registry digests before the first deployment.
ARG NODE_IMAGE=node:22.23.3-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --ignore-scripts
COPY server/prisma ./prisma
COPY server/prisma.config.ts ./
RUN DATABASE_URL=postgresql://unused:unused@localhost/unused npm run db:generate
COPY server/tsconfig*.json ./
COPY server/src ./src
RUN npm run build

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts /app/package.json ./
# Prisma CLI retained for explicit one-off migration jobs, never run on startup.
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
