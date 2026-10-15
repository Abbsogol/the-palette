#!/bin/sh
set -eu
# Narrow adapter for the rehearsal's exact argument contract. Backup paths stay
# on the runner; tools and libpq remain in the matching PostgreSQL 17 image.
test "$#" -eq 5 && test "$1" = '--format=custom' && test "$2" = '--file' && test "$4" = '--dbname'
docker exec -i --env PGUSER --env PGPASSWORD --env PGHOST --env PGPORT --env PGSSLMODE \
  "$REHEARSAL_PG_CONTAINER" pg_dump --format=custom --dbname "$5" > "$3"
