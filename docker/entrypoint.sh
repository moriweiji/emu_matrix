#!/bin/sh
set -e

PGDATA="${PGDATA:-/var/lib/postgresql/data}"

mkdir -p /var/run/postgresql /var/log/postgresql
chown -R postgres:postgres /var/run/postgresql /var/log/postgresql
touch /var/log/postgresql/postgresql.log 2>/dev/null || true
chown postgres:postgres /var/log/postgresql/postgresql.log 2>/dev/null || true

if [ -z "$(ls -A "$PGDATA" 2>/dev/null)" ]; then
    echo "=========================================="
    echo "  Initializing PostgreSQL database..."
    echo "=========================================="
    mkdir -p "$PGDATA"
    chown -R postgres:postgres "$PGDATA"

    su-exec postgres initdb -D "$PGDATA" -E UTF8 --locale=C.UTF-8

    echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"
    echo "port = 5432" >> "$PGDATA/postgresql.conf"
    echo "log_directory = '/var/log/postgresql'" >> "$PGDATA/postgresql.conf"
    echo "log_filename = 'postgresql.log'" >> "$PGDATA/postgresql.conf"

    cat > "$PGDATA/pg_hba.conf" << EOF
local   all   all   trust
host    all   all   127.0.0.1/32   trust
host    all   all   ::1/128        trust
host    all   all   0.0.0.0/0      md5
EOF

    su-exec postgres pg_ctl -D "$PGDATA" -l /var/log/postgresql/postgresql.log -w start

    su-exec postgres psql -c "CREATE USER retro_user WITH PASSWORD '${PGPASSWORD:-secure_password}' SUPERUSER;" 2>/dev/null || true
    su-exec postgres psql -c "CREATE DATABASE retro_cloudgame OWNER retro_user;" 2>/dev/null || true

    for f in /docker-entrypoint-initdb.d/*.sql; do
        if [ -f "$f" ]; then
            echo "Running migration: $f"
            su-exec postgres psql -d retro_cloudgame -f "$f"
        fi
    done

    su-exec postgres psql -d retro_cloudgame -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO retro_user;" 2>/dev/null || true
    su-exec postgres psql -d retro_cloudgame -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO retro_user;" 2>/dev/null || true
    su-exec postgres psql -d retro_cloudgame -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO retro_user;" 2>/dev/null || true
    su-exec postgres psql -d retro_cloudgame -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO retro_user;" 2>/dev/null || true

    su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop

    echo "=========================================="
    echo "  PostgreSQL initialization complete."
    echo "=========================================="
else
    echo "PostgreSQL data directory already exists, checking user and database..."

    cat > "$PGDATA/pg_hba.conf" << EOF
local   all   all   trust
host    all   all   127.0.0.1/32   trust
host    all   all   ::1/128        trust
host    all   all   0.0.0.0/0      md5
EOF

    su-exec postgres pg_ctl -D "$PGDATA" -l /var/log/postgresql/postgresql.log -w start

    su-exec postgres psql -c "CREATE USER retro_user WITH PASSWORD '${PGPASSWORD:-secure_password}' SUPERUSER;" 2>/dev/null || echo "User retro_user already exists, skipping."
    su-exec postgres psql -c "CREATE DATABASE retro_cloudgame OWNER retro_user;" 2>/dev/null || echo "Database retro_cloudgame already exists, skipping."

    su-exec postgres psql -d retro_cloudgame -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO retro_user;" 2>/dev/null || true
    su-exec postgres psql -d retro_cloudgame -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO retro_user;" 2>/dev/null || true
    su-exec postgres psql -d retro_cloudgame -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO retro_user;" 2>/dev/null || true
    su-exec postgres psql -d retro_cloudgame -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO retro_user;" 2>/dev/null || true

    MIGRATION_NEEDED=false
    su-exec postgres psql -d retro_cloudgame -c "SELECT 1 FROM games LIMIT 1;" > /dev/null 2>&1 || MIGRATION_NEEDED=true

    if [ "$MIGRATION_NEEDED" = true ]; then
        echo "Running pending migrations..."
        for f in /docker-entrypoint-initdb.d/*.sql; do
            if [ -f "$f" ]; then
                echo "Running migration: $f"
                su-exec postgres psql -d retro_cloudgame -f "$f" 2>/dev/null || true
            fi
        done
    else
        echo "Database already has data, skipping migrations."
    fi

    su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop
fi

mkdir -p /data/redis /data/storage

rm -f /tmp/services-ready

echo "Starting all services via supervisord..."
exec /usr/bin/supervisord -c /etc/supervisord.conf
