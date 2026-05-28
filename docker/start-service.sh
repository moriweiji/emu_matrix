#!/bin/sh
set -e

SERVICE_NAME="$1"
shift

MAX_WAIT=120
waited=0

while [ ! -f /tmp/services-ready ]; do
    if [ $waited -ge $MAX_WAIT ]; then
        echo "[$SERVICE_NAME] ERROR: Infrastructure did not become ready in time"
        exit 1
    fi
    echo "[$SERVICE_NAME] Waiting for infrastructure to be ready..."
    sleep 2
    waited=$((waited + 2))
done

echo "[$SERVICE_NAME] Starting..."
exec "$@"
