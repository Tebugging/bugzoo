#!/bin/sh
# Reset Bug Zoo to its seed data. All data lives in memory, so a restart is a
# full reset (users, carts, orders back to the seed).
#
# Nightly on a server (crontab -e), e.g. 04:00 every day:
#   0 4 * * * /opt/bugzoo/scripts/reset.sh >> /var/log/bugzoo-reset.log 2>&1
set -eu
cd "$(dirname "$0")/.."

# Restart every running Bug Zoo service (shop, and shop-clean if enabled).
services=$(docker compose ps --services --status running | tr "\n" " ")
if [ -z "$services" ]; then
  echo "$(date -u +%FT%TZ) bugzoo: nothing running, nothing to reset"
  exit 0
fi
# shellcheck disable=SC2086
docker compose restart $services
echo "$(date -u +%FT%TZ) bugzoo: reset $services"
