package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct{ Pool *pgxpool.Pool }

func Open(ctx context.Context, url string) (*Store, error) {
	if url == "" {
		return nil, errors.New("DATABASE_URL is not configured")
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{Pool: pool}, nil
}

func (s *Store) Ensure() error {
	if s == nil || s.Pool == nil {
		return fmt.Errorf("database unavailable")
	}
	return nil
}

func (s *Store) BeginUser(ctx context.Context, userID string) (pgx.Tx, error) {
	if err := s.Ensure(); err != nil {
		return nil, err
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `SELECT set_config('app.user_id', $1, true)`, userID); err != nil {
		_ = tx.Rollback(ctx)
		return nil, err
	}
	return tx, nil
}

func (s *Store) BeginInstitution(ctx context.Context, userID, institutionID string) (pgx.Tx, error) {
	tx, err := s.BeginUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `SELECT set_config('app.institution_id', $1, true)`, institutionID); err != nil {
		_ = tx.Rollback(ctx)
		return nil, err
	}
	return tx, nil
}

func (s *Store) Member(ctx context.Context, userID, institutionID string, roles ...string) (bool, error) {
	tx, err := s.BeginUser(ctx, userID)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var role string
	err = tx.QueryRow(ctx, `SELECT role FROM institution_memberships WHERE user_id=$1 AND institution_id=$2 AND active=true`, userID, institutionID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, tx.Commit(ctx)
	}
	if err != nil {
		return false, err
	}
	if len(roles) > 0 {
		allowed := false
		for _, expected := range roles {
			if role == expected || role == "institution_admin" {
				allowed = true
				break
			}
		}
		if !allowed {
			return false, tx.Commit(ctx)
		}
	}
	return true, tx.Commit(ctx)
}

func (s *Store) PlatformAdmin(ctx context.Context, userID string) (bool, error) {
	tx, err := s.BeginUser(ctx, userID)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var allowed bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM platform_admins WHERE user_id=$1 AND active=true)`, userID).Scan(&allowed); err != nil {
		return false, err
	}
	return allowed, tx.Commit(ctx)
}

func (s *Store) InstitutionStats(ctx context.Context, userID, institutionID string) (map[string]int, error) {
	tx, err := s.BeginInstitution(ctx, userID, institutionID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	stats := map[string]int{}
	queries := map[string]string{
		"open_cases":  `SELECT count(*) FROM cases WHERE institution_id=$1 AND status NOT IN ('returned','closed')`,
		"open_claims": `SELECT count(*) FROM claims c JOIN items i ON i.id=c.item_id WHERE i.institution_id=$1 AND c.status='pending'`,
	}
	for key, query := range queries {
		var count int
		if err := tx.QueryRow(ctx, query, institutionID).Scan(&count); err != nil {
			return nil, err
		}
		stats[key] = count
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return stats, nil
}

func (s *Store) PlatformStats(ctx context.Context, userID string) (map[string]int, error) {
	tx, err := s.BeginUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `SELECT set_config('app.platform_admin', 'true', true)`); err != nil {
		return nil, err
	}
	stats := map[string]int{}
	queries := map[string]string{
		"institutions": `SELECT count(*) FROM institutions WHERE active=true`,
		"public_items": `SELECT count(*) FROM items WHERE review_status='approved' AND visibility='public'`,
		"open_cases":   `SELECT count(*) FROM cases WHERE status NOT IN ('returned','closed')`,
	}
	for key, query := range queries {
		var count int
		if err := tx.QueryRow(ctx, query).Scan(&count); err != nil {
			return nil, err
		}
		stats[key] = count
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return stats, nil
}
