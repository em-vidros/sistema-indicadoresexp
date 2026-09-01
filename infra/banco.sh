#!/usr/bin/env bash
# Sobe o Postgres 17 do projeto em container rootless. Rodar quantas vezes quiser.
# Nao usa o docker daemon da casa nem o postgres central: banco proprio, backup proprio.
set -euo pipefail

CONTAINER=indicadores-pg
VOLUME=indicadores-pgdata
IMAGE=docker.io/library/postgres:17-alpine
PORTA=${PGPORT_HOST:-5433}
SENHA=${POSTGRES_PASSWORD:-indicadores_dev}
BANCO=${POSTGRES_DB:-indicadores}
USUARIO=${POSTGRES_USER:-indicadores}

estado=$(podman ps -a --filter "name=^${CONTAINER}$" --format '{{.State}}' || true)

case "$estado" in
  running) ;;
  created|exited|stopped) podman start "$CONTAINER" >/dev/null ;;
  *)
    podman volume exists "$VOLUME" || podman volume create "$VOLUME" >/dev/null
    podman run -d --name "$CONTAINER" \
      -e POSTGRES_PASSWORD="$SENHA" \
      -e POSTGRES_USER="$USUARIO" \
      -e POSTGRES_DB="$BANCO" \
      -e TZ=America/Sao_Paulo \
      -e PGTZ=America/Sao_Paulo \
      -p "127.0.0.1:${PORTA}:5432" \
      -v "${VOLUME}:/var/lib/postgresql/data" \
      --health-cmd "pg_isready -U ${USUARIO} -d ${BANCO}" \
      --health-interval 2s --health-retries 30 \
      "$IMAGE" >/dev/null
    ;;
esac

for _ in $(seq 60); do
  if podman exec "$CONTAINER" pg_isready -U "$USUARIO" -d "$BANCO" >/dev/null 2>&1; then
    echo "postgres pronto em 127.0.0.1:${PORTA}/${BANCO}"
    exit 0
  fi
  sleep 1
done

echo "postgres nao respondeu em 60s" >&2
podman logs --tail 30 "$CONTAINER" >&2
exit 1
