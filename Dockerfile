# syntax=docker/dockerfile:1.7
ARG BUN_VERSION=1.4.3

FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN bun run build
RUN mkdir -p /out/.data && chown -R 65532:65532 /out

FROM oven/bun:${BUN_VERSION}-distroless
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=65532:65532 /out/.data ./.data
COPY --from=build --chown=65532:65532 /app/dist ./dist
COPY --chown=65532:65532 drizzle ./drizzle
USER 65532:65532
VOLUME ["/app/.data"]
EXPOSE 3000
CMD ["dist/main.js"]
