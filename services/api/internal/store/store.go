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
	p, e := pgxpool.New(ctx, url)
	if e != nil {
		return nil, e
	}
	if e = p.Ping(ctx); e != nil {
		p.Close()
		return nil, e
	}
	return &Store{Pool: p}, nil
}
func (s *Store) Member(ctx context.Context, userID, instID string, roles ...string) (bool, error) {
	if s == nil || s.Pool == nil {
		return false, errors.New("database unavailable")
	}
	var role string
	e := s.Pool.QueryRow(ctx, `SELECT role FROM institution_memberships WHERE user_id=$1 AND institution_id=$2 AND active=true`, userID, instID).Scan(&role)
	if errors.Is(e, pgx.ErrNoRows) {
		return false, nil
	}
	if e != nil {
		return false, e
	}
	if len(roles) == 0 {
		return true, nil
	}
	for _, r := range roles {
		if role == r || role == "institution_admin" {
			return true, nil
		}
	}
	return false, nil
}
func (s *Store) PlatformAdmin(ctx context.Context, userID string) (bool, error) {
	if s == nil || s.Pool == nil {
		return false, errors.New("database unavailable")
	}
	var ok bool
	e := s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM platform_admins WHERE user_id=$1 AND active=true)`, userID).Scan(&ok)
	return ok, e
}
func (s *Store) InstitutionStats(ctx context.Context, id string) (map[string]int, error) {
	m := map[string]int{}
	for k, q := range map[string]string{"open_cases": `SELECT count(*) FROM cases WHERE institution_id=$1 AND status NOT IN ('returned','closed')`, "open_claims": `SELECT count(*) FROM claims c JOIN items i ON i.id=c.item_id WHERE i.institution_id=$1 AND c.status='pending'`} {
		var count int
		if e := s.Pool.QueryRow(ctx, q, id).Scan(&count); e != nil {
			return nil, e
		}
		m[k] = count
	}
	return m, nil
}
func (s *Store) PlatformStats(ctx context.Context) (map[string]int, error) {
	m := map[string]int{}
	for k, q := range map[string]string{"institutions": `SELECT count(*) FROM institutions WHERE active=true`, "public_items": `SELECT count(*) FROM items WHERE review_status='approved' AND visibility='public'`, "open_cases": `SELECT count(*) FROM cases WHERE status NOT IN ('returned','closed')`} {
		var count int
		if e := s.Pool.QueryRow(ctx, q).Scan(&count); e != nil {
			return nil, e
		}
		m[k] = count
	}
	return m, nil
}
func (s *Store) Ensure() error {
	if s == nil || s.Pool == nil {
		return fmt.Errorf("database unavailable")
	}
	return nil
}
