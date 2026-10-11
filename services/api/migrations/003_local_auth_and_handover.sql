CREATE TABLE app_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_sessions (
    token_hash char(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz
);
CREATE INDEX auth_sessions_user_expiry_idx ON auth_sessions(user_id, expires_at);
CREATE INDEX items_reporter_created_idx ON items(reporter_id, created_at DESC);
CREATE INDEX claims_claimant_created_idx ON claims(claimant_id, created_at DESC);

ALTER TABLE handovers
    ADD COLUMN claim_id uuid REFERENCES claims(id);
ALTER TABLE handovers
    ADD COLUMN recorded_by uuid REFERENCES app_users(id);
CREATE INDEX handovers_claim_idx ON handovers(claim_id);
CREATE INDEX handovers_recorded_by_idx ON handovers(recorded_by);
