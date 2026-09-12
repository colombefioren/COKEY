# syntax=docker/dockerfile:1

# ---- build -----------------------------------------------------------------
FROM node:20-bookworm-slim AS build

WORKDIR /app

# better-sqlite3 ships a native addon; the toolchain is only needed to build it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.test.json vite.config.ts ./
COPY src ./src
COPY scripts ./scripts

RUN npm run build

# ---- runtime ---------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    COKEY_HOST=0.0.0.0 \
    COKEY_PORT=8787 \
    COKEY_DATA_DIR=/data

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tini \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data \
    && chown -R node:node /data

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node
VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.COKEY_PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/cli/index.js", "start"]
