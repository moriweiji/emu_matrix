#!/bin/sh
set -e

echo "Waiting for infrastructure services to be ready..."

MAX_WAIT=60
waited=0

until pg_isready -h 127.0.0.1 -p 5432 > /dev/null 2>&1; do
    if [ $waited -ge $MAX_WAIT ]; then
        echo "ERROR: PostgreSQL did not become ready in time"
        exit 1
    fi
    echo "Waiting for PostgreSQL..."
    sleep 1
    waited=$((waited + 1))
done
echo "PostgreSQL is ready"

waited=0
until redis-cli -h 127.0.0.1 -p 6379 ping > /dev/null 2>&1; do
    if [ $waited -ge $MAX_WAIT ]; then
        echo "ERROR: Redis did not become ready in time"
        exit 1
    fi
    echo "Waiting for Redis..."
    sleep 1
    waited=$((waited + 1))
done
echo "Redis is ready"

mkdir -p "${STORAGE_PATH:-/data/storage}"
echo "Storage directory ensured: ${STORAGE_PATH:-/data/storage}"

touch /tmp/services-ready
echo "=========================================="
echo "  All services initialized and ready"
echo "=========================================="
