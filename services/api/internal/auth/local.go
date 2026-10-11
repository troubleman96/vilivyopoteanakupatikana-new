package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
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
	ErrEmailNotVerified   = errors.New("email verification is required")
	ErrInvalidToken       = errors.New("the link is invalid, expired, or already used")
)

const (
	sessionLifetime       = 30 * 24 * time.Hour
	verificationLifetime  = 24 * time.Hour
	passwordResetLifetime = time.Hour
	SessionCookieName     = "__Host-vp_session"
)

// User contains only the identity fields safe to return to the signed-in user.
type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

// Session contains a bearer secret returned to the HTTP layer for an HttpOnly
// cookie. Only its SHA-256 digest is stored in PostgreSQL; JSON never exposes it.
type Session struct {
	AccessToken string    `json:"-"`
	ExpiresAt   time.Time `json:"expires_at"`
	User        User      `json:"user"`
}

// Validator validates local opaque sessions against PostgreSQL.
type Validator struct {
	Pool         *pgxpool.Pool
	PublicAppURL string
	CookieSecure bool
}

// Register creates an unverified account and queues a verification message in
// the local database outbox. No email is sent to an external provider.
func (v Validator) Register(ctx context.Context, email, password string) error {
	if v.Pool == nil {
		return ErrNotConfigured
	}
	email, err := normalizeEmail(email)
	if err != nil {
		return err
	}
	if !validPassword(password) {
		return ErrWeakPassword
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	tx, err := v.Pool.Begin(ctx)
	if err != nil {
		return err
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
			return ErrEmailTaken
		}
		return err
	}
	if err := v.queueAuthEmail(ctx, tx, user, "verify", "Verify your email", verificationLifetime); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (v Validator) VerifyEmail(ctx context.Context, token string) error {
	if v.Pool == nil {
		return ErrNotConfigured
	}
	digest, ok := validOpaqueToken(token)
	if !ok {
		return ErrInvalidToken
	}
	tx, err := v.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var userID string
	err = tx.QueryRow(ctx, `
		UPDATE auth_email_tokens SET consumed_at=now()
		WHERE token_hash=$1 AND purpose='verify' AND consumed_at IS NULL AND expires_at>now()
		RETURNING user_id::text`, digest).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidToken
	}
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE app_users SET email_verified=true, verified_at=now() WHERE id=$1 AND active=true`, userID); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE auth_email_tokens SET consumed_at=now() WHERE user_id=$1 AND purpose='verify' AND consumed_at IS NULL`, userID)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ResendVerification deliberately succeeds for unknown and already verified
// addresses so the public endpoint cannot be used to enumerate accounts.
func (v Validator) ResendVerification(ctx context.Context, email string) error {
	if v.Pool == nil {
		return ErrNotConfigured
	}
	email, err := normalizeEmail(email)
	if err != nil {
		return nil
	}
	var user User
	err = v.Pool.QueryRow(ctx, `SELECT id::text,email FROM app_users WHERE email=$1 AND active=true AND email_verified=false`, email).Scan(&user.ID, &user.Email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	return v.issueAuthEmail(ctx, user, "verify", "Verify your email", verificationLifetime)
}

// RequestPasswordReset returns success for unknown addresses to prevent account
// enumeration. The reset URL is kept in the local database outbox.
func (v Validator) RequestPasswordReset(ctx context.Context, email string) error {
	if v.Pool == nil {
		return ErrNotConfigured
	}
	email, err := normalizeEmail(email)
	if err != nil {
		return nil
	}
	var user User
	err = v.Pool.QueryRow(ctx, `SELECT id::text,email FROM app_users WHERE email=$1 AND active=true`, email).Scan(&user.ID, &user.Email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	return v.issueAuthEmail(ctx, user, "reset", "Reset your password", passwordResetLifetime)
}

func (v Validator) ResetPassword(ctx context.Context, token, password string) error {
	if v.Pool == nil {
		return ErrNotConfigured
	}
	if !validPassword(password) {
		return ErrWeakPassword
	}
	digest, ok := validOpaqueToken(token)
	if !ok {
		return ErrInvalidToken
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	tx, err := v.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var userID string
	err = tx.QueryRow(ctx, `
		SELECT user_id::text FROM auth_email_tokens
		WHERE token_hash=$1 AND purpose='reset' AND consumed_at IS NULL AND expires_at>now()
		FOR UPDATE`, digest).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidToken
	}
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE app_users SET password_hash=$2 WHERE id=$1 AND active=true`, userID, string(passwordHash)); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE auth_email_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (v Validator) SignIn(ctx context.Context, email, password string) (Session, error) {
	if v.Pool == nil {
		return Session{}, ErrNotConfigured
	}
	email, err := normalizeEmail(email)
	if err != nil || password == "" || len(password) > 72 {
		_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte("invalid login"))
		return Session{}, ErrInvalidCredentials
	}
	var user User
	var passwordHash string
	var verified bool
	err = v.Pool.QueryRow(ctx,
		`SELECT id::text,email,password_hash,email_verified FROM app_users WHERE email=$1 AND active=true`,
		email,
	).Scan(&user.ID, &user.Email, &passwordHash, &verified)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(password))
			return Session{}, ErrInvalidCredentials
		}
		return Session{}, err
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)) != nil {
		return Session{}, ErrInvalidCredentials
	}
	if !verified {
		return Session{}, ErrEmailNotVerified
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
		   AND s.expires_at > now() AND u.active=true AND u.email_verified=true
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

func (v Validator) RevokeAll(ctx context.Context, header string) error {
	if v.Pool == nil {
		return ErrNotConfigured
	}
	token, ok := bearerToken(header)
	if !ok {
		return ErrUnauthenticated
	}
	tag, err := v.Pool.Exec(ctx, `
		UPDATE auth_sessions SET revoked_at=now()
		WHERE user_id=(SELECT user_id FROM auth_sessions WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now())
		  AND revoked_at IS NULL`, tokenDigest(token))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrUnauthenticated
	}
	return nil
}

// RateLimit atomically increments a database-backed fixed-window bucket.
func (v Validator) RateLimit(ctx context.Context, scope, key string, limit int, window time.Duration) (time.Duration, error) {
	if v.Pool == nil {
		return 0, ErrNotConfigured
	}
	digest := tokenDigest(scope + ":" + key)
	seconds := int64(math.Ceil(window.Seconds()))
	var attempts int
	var retrySeconds float64
	err := v.Pool.QueryRow(ctx, `
		INSERT INTO auth_rate_limits(bucket_hash,window_started_at,attempt_count)
		VALUES($1,now(),1)
		ON CONFLICT(bucket_hash) DO UPDATE SET
		 window_started_at=CASE WHEN auth_rate_limits.window_started_at + ($2 * interval '1 second') <= now() THEN now() ELSE auth_rate_limits.window_started_at END,
		 attempt_count=CASE WHEN auth_rate_limits.window_started_at + ($2 * interval '1 second') <= now() THEN 1 ELSE auth_rate_limits.attempt_count+1 END,
		 updated_at=now()
		RETURNING attempt_count, GREATEST(0,extract(epoch FROM (window_started_at + ($2 * interval '1 second') - now())))`,
		digest, seconds,
	).Scan(&attempts, &retrySeconds)
	if err != nil {
		return 0, err
	}
	if attempts <= limit {
		return 0, nil
	}
	return time.Duration(math.Ceil(retrySeconds)) * time.Second, nil
}

type sessionInserter interface {
	QueryRow(context.Context, string, ...any) pgx.Row
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}

func insertSession(ctx context.Context, db sessionInserter, user User) (Session, error) {
	token, err := randomOpaqueToken()
	if err != nil {
		return Session{}, err
	}
	expiresAt := time.Now().UTC().Add(sessionLifetime)
	_, err = db.Exec(ctx,
		`INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)`,
		tokenDigest(token), user.ID, expiresAt,
	)
	if err != nil {
		return Session{}, err
	}
	return Session{AccessToken: token, ExpiresAt: expiresAt, User: user}, nil
}

type emailQueue interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}

func (v Validator) queueAuthEmail(ctx context.Context, tx pgx.Tx, user User, purpose, subject string, lifetime time.Duration) error {
	return v.queueAuthEmailWith(ctx, tx, user, purpose, subject, lifetime)
}

func (v Validator) queueAuthEmailWith(ctx context.Context, tx emailQueue, user User, purpose, subject string, lifetime time.Duration) error {
	token, err := randomOpaqueToken()
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE auth_email_tokens SET consumed_at=now() WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL`, user.ID, purpose); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO auth_email_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+($4 * interval '1 second'))`, tokenDigest(token), user.ID, purpose, int64(math.Ceil(lifetime.Seconds()))); err != nil {
		return err
	}
	baseURL := strings.TrimRight(v.PublicAppURL, "/")
	if baseURL == "" {
		baseURL = "http://localhost:3000"
	}
	path := "/auth/verify?token="
	if purpose == "reset" {
		path = "/auth/reset-password?token="
	}
	link := baseURL + path + token
	body := subject + ": " + link + "\n\nThis link expires soon and can be used once. If you did not request it, ignore this message.\n"
	_, err = tx.Exec(ctx, `INSERT INTO auth_email_outbox(recipient,purpose,subject,body_text) VALUES($1,$2,$3,$4)`, user.Email, purpose, subject, body)
	return err
}

func (v Validator) issueAuthEmail(ctx context.Context, user User, purpose, subject string, lifetime time.Duration) error {
	tx, err := v.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := v.queueAuthEmail(ctx, tx, user, purpose, subject, lifetime); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func randomOpaqueToken() (string, error) {
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return "", fmt.Errorf("create one-time token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(secret), nil
}

func validOpaqueToken(token string) (string, bool) {
	if len(token) < 32 || len(token) > 128 {
		return "", false
	}
	return tokenDigest(token), true
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

var dummyPasswordHash = func() []byte {
	hash, err := bcrypt.GenerateFromPassword([]byte("not-a-real-account-password"), bcrypt.DefaultCost)
	if err != nil {
		panic("initialize dummy password hash: " + err.Error())
	}
	return hash
}()
