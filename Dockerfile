FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/auth-service/package.json packages/auth-service/
COPY packages/game-service/package.json packages/game-service/
COPY packages/save-service/package.json packages/save-service/
COPY packages/media-service/package.json packages/media-service/
COPY packages/gateway/package.json packages/gateway/
COPY packages/ws-service/package.json packages/ws-service/
COPY packages/frontend/package.json packages/frontend/

COPY package-lock.json* ./

RUN npm install --workspaces --if-present

COPY . .

RUN npm run build -w packages/shared \
    && npm run build -w packages/auth-service \
    && npm run build -w packages/game-service \
    && npm run build -w packages/save-service \
    && npm run build -w packages/media-service \
    && npm run build -w packages/gateway \
    && npm run build -w packages/ws-service \
    && npm run build -w packages/frontend

FROM node:20-alpine AS runtime

RUN apk add --no-cache \
    postgresql postgresql-contrib \
    redis \
    nginx \
    python3 py3-pip \
    su-exec \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/* \
    && pip install --no-cache-dir --break-system-packages supervisor

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist packages/shared/dist/
COPY --from=builder /app/packages/auth-service/package.json packages/auth-service/
COPY --from=builder /app/packages/auth-service/dist packages/auth-service/dist/
COPY --from=builder /app/packages/game-service/package.json packages/game-service/
COPY --from=builder /app/packages/game-service/dist packages/game-service/dist/
COPY --from=builder /app/packages/save-service/package.json packages/save-service/
COPY --from=builder /app/packages/save-service/dist packages/save-service/dist/
COPY --from=builder /app/packages/media-service/package.json packages/media-service/
COPY --from=builder /app/packages/media-service/dist packages/media-service/dist/
COPY --from=builder /app/packages/gateway/package.json packages/gateway/
COPY --from=builder /app/packages/gateway/dist packages/gateway/dist/
COPY --from=builder /app/packages/ws-service/package.json packages/ws-service/
COPY --from=builder /app/packages/ws-service/dist packages/ws-service/dist/
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
COPY --from=builder /app/node_modules node_modules/

COPY database/migrations/ /docker-entrypoint-initdb.d/

COPY docker/supervisord.conf /etc/supervisord.conf
RUN rm -f /etc/nginx/http.d/default.conf
COPY docker/nginx-all-in-one.conf /etc/nginx/http.d/default.conf
COPY docker/redis.conf /etc/redis.conf
COPY docker/entrypoint.sh /app/docker/entrypoint.sh
COPY docker/init-services.sh /app/docker/init-services.sh
COPY docker/start-service.sh /app/docker/start-service.sh

RUN chmod +x /app/docker/entrypoint.sh \
    && chmod +x /app/docker/init-services.sh \
    && chmod +x /app/docker/start-service.sh

RUN mkdir -p /var/lib/postgresql/data \
    && mkdir -p /data/redis \
    && mkdir -p /data/storage \
    && mkdir -p /var/log \
    && mkdir -p /var/run/postgresql \
    && mkdir -p /var/lib/nginx/tmp \
    && mkdir -p /var/log/nginx \
    && chown -R postgres:postgres /var/lib/postgresql \
    && chown -R postgres:postgres /var/run/postgresql \
    && chown -R nginx:nginx /var/lib/nginx \
    && chown -R nginx:nginx /var/log/nginx

ENV PGDATA=/var/lib/postgresql/data \
    DATABASE_URL=postgresql://retro_user:secure_password@localhost:5432/retro_cloudgame \
    REDIS_URL=redis://localhost:6379 \
    STORAGE_PATH=/data/storage \
    MEDIA_BASE_URL=/media \
    JWT_ACCESS_SECRET=production-access-secret-change-me \
    JWT_REFRESH_SECRET=production-refresh-secret-change-me \
    JWT_ACCESS_EXPIRES_IN=7d \
    JWT_REFRESH_EXPIRES_IN=30d \
    PORT_GATEWAY=3000 \
    PORT_AUTH=3001 \
    PORT_GAME=3002 \
    PORT_SAVE=3003 \
    PORT_MEDIA=3004 \
    PORT_WS=3005 \
    FRONTEND_URL=http://localhost \
    NODE_ENV=production

EXPOSE 80 3000 3005 5432 6379

VOLUME ["/var/lib/postgresql/data", "/data"]

ENTRYPOINT ["/app/docker/entrypoint.sh"]
