# syntax=docker/dockerfile:1

# ----------------------------------------------------------------------------
# 1. Build del cliente (Vite + React)
# ----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS client-build
WORKDIR /app/client

COPY client/package.json ./
RUN npm install --no-audit --no-fund

COPY client/ ./
RUN npm run build

# ----------------------------------------------------------------------------
# 2. Dependencias de produccion del servidor
#    (build-essential por si better-sqlite3 no encuentra un binario precompilado)
# ----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS server-deps
WORKDIR /app/server

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# ----------------------------------------------------------------------------
# 3. Imagen final
# ----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/data/steamlab.db \
    CLIENT_DIST=/app/client/dist

WORKDIR /app

COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/package.json ./server/package.json
COPY server/src ./server/src
COPY --from=client-build /app/client/dist ./client/dist

RUN mkdir -p /data && chown -R node:node /data /app

USER node
WORKDIR /app/server
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
