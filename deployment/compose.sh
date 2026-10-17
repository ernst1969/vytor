#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
exec docker compose --env-file .env.production -f compose.production.yml "$@"
