ALTER TABLE app_users
    ADD COLUMN email_verified boolean NOT NULL DEFAULT false,
    ADD COLUMN verified_at timestamptz;

-- Existing sessions predate verified-email enforcement and must not bypass it.
UPDATE auth_sessions
SET revoked_at = now()
WHERE revoked_at IS NULL;

CREATE TABLE auth_email_tokens (
    token_hash char(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    purpose text NOT NULL CHECK (purpose IN ('verify', 'reset')),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    consumed_at timestamptz
);
CREATE INDEX auth_email_tokens_user_purpose_idx
    ON auth_email_tokens(user_id, purpose, expires_at DESC);

-- Local-only delivery sink. Message bodies contain one-time URLs, so this table
-- must remain private to the API/database and be purged under the retention policy.
CREATE TABLE auth_email_outbox (
    id bigserial PRIMARY KEY,
    recipient text NOT NULL,
    purpose text NOT NULL CHECK (purpose IN ('verify', 'reset')),
    subject text NOT NULL,
    body_text text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_email_outbox_created_idx ON auth_email_outbox(created_at);

CREATE TABLE auth_rate_limits (
    bucket_hash char(64) PRIMARY KEY,
    window_started_at timestamptz NOT NULL,
    attempt_count integer NOT NULL CHECK (attempt_count > 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_rate_limits_updated_idx ON auth_rate_limits(updated_at);
