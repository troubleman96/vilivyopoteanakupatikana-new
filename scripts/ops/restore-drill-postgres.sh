#!/bin/sh
set -eu
umask 077

[ "$#" -eq 1 ] || { echo "usage: restore-drill-postgres.sh <backup.dump[.age]>" >&2; exit 2; }
archive=$1
: "${PGHOST:?Set PGHOST to the isolated restore-test PostgreSQL host}"
: "${PGDATABASE:?Set PGDATABASE to a disposable database ending in _restore_test}"
: "${PGUSER:?Set PGUSER to an authorized restore-test role}"
: "${PGPASSFILE:?Set PGPASSFILE to a mounted PostgreSQL passfile secret}"
case "$PGDATABASE" in
  *_restore_test) ;;
  *) echo "refusing restore: PGDATABASE must end in _restore_test" >&2; exit 2 ;;
esac
[ -r "$archive" ] || { echo "backup archive is not readable" >&2; exit 2; }
[ -r "$PGPASSFILE" ] || { echo "PGPASSFILE is not readable" >&2; exit 2; }

work_dir=$(mktemp -d "${TMPDIR:-/tmp}/vp-db-restore.XXXXXX")
chmod 700 "$work_dir"
passfile="$work_dir/pgpass"
cat "$PGPASSFILE" > "$passfile"
chmod 600 "$passfile"
export PGPASSFILE="$passfile"
cleanup() { rm -rf -- "$work_dir"; }
trap cleanup EXIT HUP INT TERM

restore_archive=$archive
case "$archive" in
  *.age)
    : "${BACKUP_AGE_IDENTITY_FILE:?Set BACKUP_AGE_IDENTITY_FILE to the mounted private age identity}"
    [ -r "$BACKUP_AGE_IDENTITY_FILE" ] || { echo "age identity file is not readable" >&2; exit 2; }
    command -v age >/dev/null 2>&1 || { echo "age is required to decrypt this backup" >&2; exit 2; }
    restore_archive="$work_dir/database.dump"
    age --decrypt --identity "$BACKUP_AGE_IDENTITY_FILE" --output "$restore_archive" "$archive"
    ;;
esac

pg_restore --list "$restore_archive" >/dev/null
pg_restore --no-password --exit-on-error --no-owner --no-privileges \
  --host="$PGHOST" --port="${PGPORT:-5432}" --username="$PGUSER" \
  --dbname="$PGDATABASE" "$restore_archive"
verified=$(psql -X --no-password --host="$PGHOST" --port="${PGPORT:-5432}" \
  --username="$PGUSER" --dbname="$PGDATABASE" --tuples-only --no-align \
  --command="SELECT (to_regclass('public.items') IS NOT NULL AND to_regclass('public.schema_migrations') IS NOT NULL)::text")
[ "$verified" = "true" ] || { echo "restore verification failed: expected items and schema_migrations tables" >&2; exit 1; }
printf 'Restore drill passed for disposable database %s.\n' "$PGDATABASE"
