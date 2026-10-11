package main

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"path/filepath"
	"sort"
)

func main() {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
		os.Exit(1)
	}
	ctx := context.Background()
	p, e := pgxpool.New(ctx, url)
	if e != nil {
		panic(e)
	}
	defer p.Close()
	if _, e = p.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`); e != nil {
		panic(e)
	}
	files, e := filepath.Glob("migrations/*.sql")
	if e != nil {
		panic(e)
	}
	sort.Strings(files)
	for _, f := range files {
		var exists bool
		if e = p.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name=$1)`, filepath.Base(f)).Scan(&exists); e != nil {
			panic(e)
		}
		if exists {
			continue
		}
		b, e := os.ReadFile(f)
		if e != nil {
			panic(e)
		}
		tx, e := p.Begin(ctx)
		if e != nil {
			panic(e)
		}
		if _, e = tx.Exec(ctx, string(b)); e == nil {
			_, e = tx.Exec(ctx, `INSERT INTO schema_migrations(name) VALUES($1)`, filepath.Base(f))
		}
		if e != nil {
			_ = tx.Rollback(ctx)
			panic(e)
		}
		if e = tx.Commit(ctx); e != nil {
			panic(e)
		}
		fmt.Println("applied", f)
	}
}
