package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrNotConfigured      = errors.New("local authentication is not configured")
	ErrUnauthenticated    = errors.New("authentication required or invalid")
	ErrEmailTaken         = errors.New("email is already registered")
	ErrInvalidEmail       = errors.New("a valid email address is required")
	ErrWeakPassword       = errors.New("password must be at least 12 characters and no more than 72 bytes")
	ErrInvalidCredentials = errors.New("email or password is incorrect")
)

const sessionLifetime = 30 * 24 * time.Hour

// User contains only the identity fields safe to return to the signed-in user.
type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

// Session contains a bearer secret returned once at account creation or sign-in.
// Only the SHA-256 digest of AccessToken is stored in PostgreSQL.
type Session struct {
	AccessToken string    `json:"access_token"`
	ExpiresAt   time.Time `json:"expires_at"`
	User        User      `json:"user"`
}

// Validator validates local opaque bearer tokens against PostgreSQL. The legacy
// type name is retained to keep authorization call sites explicit and simple.
type Validator struct {
	Pool *pgxpool.Pool
}

func (v Validator) Register(ctx context.Context, email, password string) (Session, error) {
	if v.Pool == nil {
		return Session{}, ErrNotConfigured
	}
	email, err := normalizeEmail(email)
	if err != nil {
		return Session{}, err
	}
	if !validPassword(password) {
		return Session{}, ErrWeakPassword
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return Session{}, fmt.Errorf("hash password: %w", err)
	}

	tx, err := v.Pool.Begin(ctx)
	if err != nil {
		return Session{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var user User
	err = tx.QueryRow(ctx,
		`INSERT INTO app_users(email, password_hash) VALUES($1, $2) RETURNING id::text, email`,
		email, string(passwordHash),
	).Scan(&user.ID, &user.Email)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return Session{}, ErrEmailTaken
		}
		return Session{}, err
	}

	session, err := insertSession(ctx, tx, user)
	if err != nil {
		return Session{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Session{}, err
	}
	return session, nil
}

func (v Validator) SignIn(ctx context.Context, email, password string) (Session, error) {
	if v.Pool == nil {
		return Session{}, ErrNotConfigured
	}
	email, err := normalizeEmail(email)
	if err != nil || password == "" || len(password) > 72 {
		return Session{}, ErrInvalidCredentials
	}
	var user User
	var passwordHash string
	err = v.Pool.QueryRow(ctx,
		`SELECT id::text, email, password_hash FROM app_users WHERE email=$1 AND active=true`,
		email,
	).Scan(&user.ID, &user.Email, &passwordHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Session{}, ErrInvalidCredentials
		}
		return Session{}, err
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)) != nil {
		return Session{}, ErrInvalidCredentials
	}
	return insertSession(ctx, v.Pool, user)
}

func (v Validator) Validate(ctx context.Context, header string) (User, error) {
	if v.Pool == nil {
		return User{}, ErrNotConfigured
	}
	token, ok := bearerToken(header)
	if !ok {
		return User{}, ErrUnauthenticated
	}
	var user User
	err := v.Pool.QueryRow(ctx,
		`UPDATE auth_sessions AS s SET last_used_at=now()
		 FROM app_users AS u
		 WHERE s.user_id=u.id AND s.token_hash=$1 AND s.revoked_at IS NULL
		   AND s.expires_at > now() AND u.active=true
		 RETURNING u.id::text, u.email`,
		tokenDigest(token),
	).Scan(&user.ID, &user.Email)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUnauthenticated
	}
	if err != nil {
		return User{}, err
	}
	return user, nil
}

func (v Validator) Revoke(ctx context.Context, header string) error {
	if v.Pool == nil {
		return ErrNotConfigured
	}
	token, ok := bearerToken(header)
	if !ok {
		return ErrUnauthenticated
	}
	tag, err := v.Pool.Exec(ctx,
		`UPDATE auth_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL`,
		tokenDigest(token),
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrUnauthenticated
	}
	return nil
}

type sessionInserter interface {
	QueryRow(context.Context, string, ...any) pgx.Row
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}

func insertSession(ctx context.Context, db sessionInserter, user User) (Session, error) {
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return Session{}, fmt.Errorf("create session token: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(secret)
	expiresAt := time.Now().UTC().Add(sessionLifetime)
	_, err := db.Exec(ctx,
		`INSERT INTO auth_sessions(token_hash, user_id, expires_at) VALUES($1, $2, $3)`,
		tokenDigest(token), user.ID, expiresAt,
	)
	if err != nil {
		return Session{}, err
	}
	return Session{AccessToken: token, ExpiresAt: expiresAt, User: user}, nil
}

func tokenDigest(token string) string {
	digest := sha256.Sum256([]byte(token))
	return hex.EncodeToString(digest[:])
}

func bearerToken(header string) (string, bool) {
	parts := strings.Fields(header)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || len(parts[1]) < 32 || len(parts[1]) > 128 {
		return "", false
	}
	return parts[1], true
}

func normalizeEmail(email string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if len(email) > 254 || strings.Count(email, "@") != 1 {
		return "", ErrInvalidEmail
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || strings.ContainsAny(email, "\r\n") {
		return "", ErrInvalidEmail
	}
	return email, nil
}

func validPassword(password string) bool {
	return utf8.RuneCountInString(password) >= 12 && len(password) <= 72
}
