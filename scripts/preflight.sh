#!/bin/sh
# Read-only checks to run on a shared server BEFORE the first deploy.
# It changes nothing. It tells you if Bug Zoo could clash with what is
# already running there.
#
#   sh scripts/preflight.sh
#
# Exit code 1 if any FAIL.

cd "$(dirname "$0")/.." || exit 1
# Pick up port overrides from .env, the same file docker compose reads.
if [ -f .env ]; then set -a; . ./.env; set +a; fi

PORT="${BUGZOO_PORT:-8080}"
CLEAN_PORT="${BUGZOO_CLEAN_PORT:-8081}"
fails=0
pass() { echo "PASS  $*"; }
warn() { echo "WARN  $*"; }
fail() { echo "FAIL  $*"; fails=$((fails + 1)); }
listening() {
  if command -v ss >/dev/null 2>&1; then ss -Htln 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$"
  else lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
  fi
}

echo "Bug Zoo pre-flight on $(hostname) ($(date -u +%FT%TZ))"
if [ "$(uname -s)" != Linux ]; then
  echo "NOTE  This is not Linux. Run this on the server you deploy to; results here only describe this machine."
fi
echo

# 1. Docker and Compose v2
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  pass "docker compose available: $(docker compose version --short 2>/dev/null)"
else
  fail "docker with the compose v2 plugin is not available"
fi

# 2. No existing project or containers called bugzoo
if docker compose ls -a 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx bugzoo; then
  warn "a compose project named 'bugzoo' already exists (fine if it is a previous Bug Zoo deploy)"
else
  pass "no existing compose project named 'bugzoo'"
fi

# 3. Host ports free (Docker refuses to start on a taken port, so a clash
#    cannot break the other site, but Bug Zoo would not start)
ours() { docker ps --filter label=com.docker.compose.project=bugzoo --format '{{.Ports}}' 2>/dev/null | grep -q ":$1->"; }
check_port() { # $1 port, $2 variable name, $3 fail|warn
  if ! command -v ss >/dev/null 2>&1 && ! command -v lsof >/dev/null 2>&1; then
    warn "cannot check port $1 (neither 'ss' nor 'lsof' found)"
  elif ours "$1"; then
    pass "port $1 is used by Bug Zoo itself (re-deploy)"
  elif listening "$1"; then
    "$3" "port $1 is already used by something else. Pick another: $2=<port> in a .env file next to docker-compose.yml"
  else
    pass "port $1 is free"
  fi
}
check_port "$PORT" BUGZOO_PORT fail
check_port "$CLEAN_PORT" BUGZOO_CLEAN_PORT warn  # only matters with --profile clean

# 4. Memory: Bug Zoo needs at most 128 MB (256 MB with the clean shop)
if command -v free >/dev/null 2>&1; then
  avail=$(free -m | awk '/^Mem:/ {print $7}')
  if [ "${avail:-0}" -ge 512 ]; then pass "available memory: ${avail} MB"
  elif [ "${avail:-0}" -ge 256 ]; then warn "available memory is low: ${avail} MB (Bug Zoo is capped at 128 MB)"
  else fail "available memory is only ${avail} MB"
  fi
  swap=$(free -m | awk '/^Swap:/ {print $2}')
  [ "${swap:-0}" -gt 0 ] && pass "swap: ${swap} MB" || warn "no swap configured (not required)"
else
  warn "cannot check free memory ('free' not found; Linux only)"
fi

# 5. Disk: image is about 60 MB; keep a safe margin
root=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)
[ -d "$root" ] || root=/
disk=$(df -Pm "$root" | awk 'NR==2 {print $4}')
if [ "${disk:-0}" -ge 2048 ]; then pass "free disk on $root: ${disk} MB"
elif [ "${disk:-0}" -ge 500 ]; then warn "free disk on $root is low: ${disk} MB"
else fail "free disk on $root is only ${disk} MB"
fi

# 6. CPU
cpus=$(nproc 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null || echo "?")
pass "CPU cores: $cpus (Bug Zoo is capped at 0.25 of one core)"

# 7. Reverse proxy: who owns ports 80/443? This decides how to expose Bug Zoo.
echo
echo "INFO  what listens on 80/443:"
if command -v ss >/dev/null 2>&1; then
  ss -Htlnp 2>/dev/null | awk '$4 ~ /[:.](80|443)$/ {print "        " $4 "  " $6}'
else
  lsof -nP -iTCP:80 -iTCP:443 -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print "        " $9 "  " $1}'
fi
proxy_ctr=$(docker ps --format '{{.Names}} {{.Image}} {{.Ports}}' 2>/dev/null | grep -E ':(80|443)->' || true)
if [ -n "$proxy_ctr" ]; then
  echo "INFO  the web proxy runs inside Docker:"
  echo "$proxy_ctr" | sed 's/^/        /'
  warn "a proxy inside Docker cannot reach 127.0.0.1:$PORT on the host. Either deploy Bug Zoo through that tool (Dokploy/Coolify/Traefik labels) or attach the 'shop' service to the proxy's Docker network. See README 'Self-hosting'."
else
  pass "no Docker-based proxy on 80/443; a host proxy (nginx/Caddy) can use 127.0.0.1:$PORT"
fi

# 8. Cron available for the nightly reset
if command -v crontab >/dev/null 2>&1; then pass "crontab available for the nightly reset"
else warn "crontab not found; use a systemd timer for the nightly reset instead"
fi

echo
if [ "$fails" -gt 0 ]; then echo "Result: $fails problem(s). Fix them before deploying."; exit 1; fi
echo "Result: OK to deploy (read the WARN lines, if any)."
