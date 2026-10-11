#!/bin/sh
set -eu
umask 077

: "${PGHOST:?Set PGHOST}"
: "${PGDATABASE:?Set PGDATABASE}"
: "${PGUSER:?Set PGUSER to a maintenance role authorized to delete expired rows}"
: "${PGPASSFILE:?Set PGPASSFILE to a mounted PostgreSQL passfile secret}"
: "${AUTH_OUTBOX_RETENTION_DAYS:?Set the institution-approved outbox retention period}"
: "${AUTH_TOKEN_RETENTION_DAYS:?Set the institution-approved token retention period}"
: "${SESSION_RETENTION_DAYS:?Set the institution-approved session retention period}"
: "${RATE_LIMIT_RETENTION_DAYS:?Set the institution-approved rate-limit retention period}"
: "${AUDIT_RETENTION_DAYS:?Set the institution-approved audit retention period}"

validate_days() {
  name=$1
  value=$2
  case "$value" in ''|*[!0-9]*) echo "$name must be a positive integer" >&2; exit 2 ;; esac
  [ "$value" -ge 1 ] || { echo "$name must be at least 1" >&2; exit 2; }
}
validate_days AUTH_OUTBOX_RETENTION_DAYS "$AUTH_OUTBOX_RETENTION_DAYS"
validate_days AUTH_TOKEN_RETENTION_DAYS "$AUTH_TOKEN_RETENTION_DAYS"
validate_days SESSION_RETENTION_DAYS "$SESSION_RETENTION_DAYS"
validate_days RATE_LIMIT_RETENTION_DAYS "$RATE_LIMIT_RETENTION_DAYS"
validate_days AUDIT_RETENTION_DAYS "$AUDIT_RETENTION_DAYS"
[ -r "$PGPASSFILE" ] || { echo "PGPASSFILE is not readable" >&2; exit 2; }

work_dir=$(mktemp -d "${TMPDIR:-/tmp}/vp-retention.XXXXXX")
chmod 700 "$work_dir"
passfile="$work_dir/pgpass"
cat "$PGPASSFILE" > "$passfile"
chmod 600 "$passfile"
export PGPASSFILE="$passfile"
cleanup() { rm -rf -- "$work_dir"; }
trap cleanup EXIT HUP INT TERM

psql -X --no-password --host="$PGHOST" --port="${PGPORT:-5432}" --username="$PGUSER" \
  --dbname="$PGDATABASE" --set=ON_ERROR_STOP=1 \
  --set=outbox_days="$AUTH_OUTBOX_RETENTION_DAYS" \
  --set=token_days="$AUTH_TOKEN_RETENTION_DAYS" \
  --set=session_days="$SESSION_RETENTION_DAYS" \
  --set=rate_limit_days="$RATE_LIMIT_RETENTION_DAYS" \
  --set=audit_days="$AUDIT_RETENTION_DAYS" \
  --file="$(dirname "$0")/retention-sweep.sql"
