package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/config"
)

const publicViewRole = "vilivyopotea_public_reader"

func main() {
	url, err := config.SecretEnv("DATABASE_URL")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if url == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
		os.Exit(1)
	}
	appRole := os.Getenv("APP_DATABASE_USER")
	appPassword, err := config.SecretEnv("APP_DATABASE_PASSWORD")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if appRole == "" || appPassword == "" {
		fmt.Fprintln(os.Stderr, "APP_DATABASE_USER and APP_DATABASE_PASSWORD are required")
		os.Exit(1)
	}
	if appRole == publicViewRole {
		panic("APP_DATABASE_USER must not match the internal public-view owner role")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		panic(err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		panic(err)
	}

	if err := provisionRuntimeRole(ctx, pool, appRole, appPassword); err != nil {
		panic(err)
	}
	if err := provisionPublicViewRole(ctx, pool); err != nil {
		panic(err)
	}
	if _, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`); err != nil {
		panic(err)
	}
	files, err := filepath.Glob("migrations/*.sql")
	if err != nil {
		panic(err)
	}
	sort.Strings(files)
	for _, file := range files {
		var exists bool
		if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name=$1)`, filepath.Base(file)).Scan(&exists); err != nil {
			panic(err)
		}
		if exists {
			continue
		}
		source, err := os.ReadFile(file)
		if err != nil {
			panic(err)
		}
		tx, err := pool.Begin(ctx)
		if err != nil {
			panic(err)
		}
		if _, err = tx.Exec(ctx, string(source)); err == nil {
			_, err = tx.Exec(ctx, `INSERT INTO schema_migrations(name) VALUES($1)`, filepath.Base(file))
		}
		if err != nil {
			_ = tx.Rollback(ctx)
			panic(err)
		}
		if err := tx.Commit(ctx); err != nil {
			panic(err)
		}
		fmt.Println("applied", file)
	}
	if err := grantRuntimePrivileges(ctx, pool, appRole); err != nil {
		panic(err)
	}
}

func provisionRuntimeRole(ctx context.Context, pool *pgxpool.Pool, name, password string) error {
	var currentRole string
	if err := pool.QueryRow(ctx, `SELECT current_user`).Scan(&currentRole); err != nil {
		return err
	}
	if name == currentRole {
		return fmt.Errorf("APP_DATABASE_USER must be distinct from the migration login")
	}
	var exists bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=$1)`, name).Scan(&exists); err != nil {
		return err
	}
	statement := `CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`
	if exists {
		statement = `ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`
	}
	var ddl string
	if err := pool.QueryRow(ctx, `SELECT format($1::text, $2::text, $3::text)`, statement, name, password).Scan(&ddl); err != nil {
		return err
	}
	_, err := pool.Exec(ctx, ddl)
	return err
}

func provisionPublicViewRole(ctx context.Context, pool *pgxpool.Pool) error {
	var exists bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=$1)`, publicViewRole).Scan(&exists); err != nil {
		return err
	}
	if exists {
		var login, superuser, createDB, createRole, inherit, bypassRLS, membership bool
		if err := pool.QueryRow(ctx, `SELECT r.rolcanlogin, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolinherit, r.rolbypassrls, EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.roleid=r.oid OR m.member=r.oid) FROM pg_roles r WHERE r.rolname=$1`, publicViewRole).Scan(&login, &superuser, &createDB, &createRole, &inherit, &bypassRLS, &membership); err != nil {
			return err
		}
		if login || superuser || createDB || createRole || inherit || !bypassRLS || membership {
			return fmt.Errorf("existing %s role does not have the required NOLOGIN, no-membership public-view attributes", publicViewRole)
		}
		return nil
	}
	var ddl string
	if err := pool.QueryRow(ctx, `SELECT format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS', $1::text)`, publicViewRole).Scan(&ddl); err != nil {
		return err
	}
	_, err := pool.Exec(ctx, ddl)
	return err
}

func grantRuntimePrivileges(ctx context.Context, pool *pgxpool.Pool, role string) error {
	var schemaGrant string
	if err := pool.QueryRow(ctx, `SELECT format('GRANT USAGE ON SCHEMA public TO %I', $1::text)`, role).Scan(&schemaGrant); err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, schemaGrant); err != nil {
		return err
	}
	grants := []string{
		`GRANT SELECT ON institutions, institution_memberships, platform_admins, public_items TO %I`,
		`GRANT EXECUTE ON FUNCTION public.is_public_item(uuid) TO %I`,
		`GRANT EXECUTE ON FUNCTION public.is_claimable_item(uuid) TO %I`,
		`GRANT SELECT, INSERT, UPDATE ON app_users TO %I`,
		`GRANT SELECT, INSERT, UPDATE ON auth_sessions, auth_email_tokens TO %I`,
		`GRANT INSERT ON auth_email_outbox TO %I`,
		`GRANT SELECT, INSERT, UPDATE ON auth_rate_limits TO %I`,
		`GRANT SELECT, INSERT, UPDATE ON items, cases, claims TO %I`,
		`GRANT SELECT, INSERT ON handovers TO %I`,
		`GRANT SELECT, INSERT ON claim_verifications TO %I`,
		`GRANT SELECT, INSERT ON operational_audit_events TO %I`,
		`GRANT USAGE, SELECT ON SEQUENCE auth_email_outbox_id_seq TO %I`,
		`GRANT USAGE, SELECT ON SEQUENCE operational_audit_events_id_seq TO %I`,
	}
	for _, grant := range grants {
		var statement string
		if err := pool.QueryRow(ctx, `SELECT format($1::text, $2::text)`, grant, role).Scan(&statement); err != nil {
			return err
		}
		if _, err := pool.Exec(ctx, statement); err != nil {
			return err
		}
	}
	return nil
}
