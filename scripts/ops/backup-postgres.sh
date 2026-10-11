#!/bin/sh
set -eu
umask 077

: "${PGHOST:?Set PGHOST to the database host}"
: "${PGDATABASE:?Set PGDATABASE to the database name}"
: "${PGUSER:?Set PGUSER to an authorized backup role}"
: "${PGPASSFILE:?Set PGPASSFILE to a mounted PostgreSQL passfile secret}"
: "${BACKUP_DIR:?Set BACKUP_DIR to private backup storage}"
: "${BACKUP_RETENTION_DAYS:?Set BACKUP_RETENTION_DAYS to the institution-approved retention period}"

case "$BACKUP_RETENTION_DAYS" in
  ''|*[!0-9]*) echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2; exit 2 ;;
esac
[ "$BACKUP_RETENTION_DAYS" -ge 1 ] || { echo "BACKUP_RETENTION_DAYS must be at least 1" >&2; exit 2; }
[ -r "$PGPASSFILE" ] || { echo "PGPASSFILE is not readable" >&2; exit 2; }

require_encryption=${BACKUP_ENCRYPTION_REQUIRED:-true}
recipient=${BACKUP_AGE_RECIPIENT:-}
case "$require_encryption" in
  true|false) ;;
  *) echo "BACKUP_ENCRYPTION_REQUIRED must be true or false" >&2; exit 2 ;;
esac
if [ "$require_encryption" = "true" ] && [ -z "$recipient" ]; then
	echo "Encrypted backups are required; set an approved BACKUP_AGE_RECIPIENT" >&2
	exit 2
fi
if [ -z "$recipient" ] && [ "${BACKUP_ALLOW_UNENCRYPTED_SYNTHETIC:-false}" != "true" ]; then
	echo "Plaintext backups require BACKUP_ALLOW_UNENCRYPTED_SYNTHETIC=true for synthetic local testing only" >&2
	exit 2
fi
if [ -n "$recipient" ] && ! command -v age >/dev/null 2>&1; then
  echo "age is required when BACKUP_AGE_RECIPIENT is configured" >&2
  exit 2
fi

mkdir -p -- "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/vp-db-backup.XXXXXX")
chmod 700 "$work_dir"
passfile="$work_dir/pgpass"
cat "$PGPASSFILE" > "$passfile"
chmod 600 "$passfile"
export PGPASSFILE="$passfile"
cleanup() { rm -rf -- "$work_dir"; }
trap cleanup EXIT HUP INT TERM

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
plain="$work_dir/database.dump"
pg_dump --no-password --format=custom --no-owner --no-privileges \
  --host="$PGHOST" --port="${PGPORT:-5432}" --username="$PGUSER" \
  --dbname="$PGDATABASE" --file="$plain"
pg_restore --list "$plain" >/dev/null

if [ -n "$recipient" ]; then
  target="$BACKUP_DIR/db-$timestamp.dump.age"
  partial="$target.partial"
  age --recipient "$recipient" --output "$partial" "$plain"
else
  target="$BACKUP_DIR/db-$timestamp.dump"
  partial="$target.partial"
  cp -- "$plain" "$partial"
fi
chmod 600 "$partial"
mv -- "$partial" "$target"
sha256sum "$target" > "$target.sha256.partial"
chmod 600 "$target.sha256.partial"
mv -- "$target.sha256.partial" "$target.sha256"

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'db-*.dump*' -mtime "+$BACKUP_RETENTION_DAYS" -delete
printf 'Backup created and archive-validated: %s\n' "$(basename "$target")"
