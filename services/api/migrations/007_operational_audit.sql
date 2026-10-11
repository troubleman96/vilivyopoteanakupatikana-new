CREATE TABLE operational_audit_events (
    id bigserial PRIMARY KEY,
    institution_id uuid NOT NULL REFERENCES institutions(id),
    actor_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    action text NOT NULL CHECK (action IN (
        'item.reviewed',
        'case.updated',
        'claim.reviewed',
        'claim.verified',
        'handover.recorded',
        'match.shortlist_requested'
    )),
    target_type text NOT NULL CHECK (target_type IN ('item', 'case', 'claim')),
    target_id uuid NOT NULL,
    request_id text NOT NULL CHECK (request_id ~ '^[a-f0-9]{32}$'),
    details jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(details) = 'object' AND octet_length(details::text) <= 1024),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX operational_audit_events_institution_created_idx
    ON operational_audit_events (institution_id, created_at DESC);
CREATE INDEX operational_audit_events_actor_created_idx
    ON operational_audit_events (actor_user_id, created_at DESC);

ALTER TABLE operational_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY operational_audit_events_insert_staff ON operational_audit_events
    FOR INSERT
    WITH CHECK (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        AND actor_user_id::text = NULLIF(current_setting('app.user_id', true), '')
        AND EXISTS (
            SELECT 1
            FROM institution_memberships AS membership
            WHERE membership.user_id::text = NULLIF(current_setting('app.user_id', true), '')
              AND membership.institution_id = operational_audit_events.institution_id
              AND membership.active = true
              AND membership.role IN ('staff', 'institution_admin')
        )
    );

CREATE POLICY operational_audit_events_select_tenant ON operational_audit_events
    FOR SELECT
    USING (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        AND (
            actor_user_id::text = NULLIF(current_setting('app.user_id', true), '')
            OR EXISTS (
                SELECT 1
                FROM institution_memberships AS membership
                WHERE membership.user_id::text = NULLIF(current_setting('app.user_id', true), '')
                  AND membership.institution_id = operational_audit_events.institution_id
                  AND membership.active = true
                  AND membership.role = 'institution_admin'
            )
        )
    );

CREATE INDEX auth_email_tokens_expiry_idx ON auth_email_tokens (expires_at);
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions (expires_at);
