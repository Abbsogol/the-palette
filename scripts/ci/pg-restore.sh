#!/bin/sh
set -eu
test "$#" -eq 4 && test "$1" = '--exit-on-error' && test "$2" = '--dbname'
docker exec -i --env PGUSER --env PGPASSWORD --env PGHOST --env PGPORT --env PGSSLMODE \
  "$REHEARSAL_PG_CONTAINER" pg_restore --exit-on-error --dbname "$3" < "$4"
