CREATE TABLE platform_admin_events (
    id bigserial PRIMARY KEY,
    actor_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_admin_events_created_idx ON platform_admin_events(created_at DESC);
ALTER TABLE platform_admin_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admin_events FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_admin_events_access ON platform_admin_events
    USING (current_setting('app.platform_admin', true) = 'true')
    WITH CHECK (current_setting('app.platform_admin', true) = 'true');

CREATE POLICY platform_admin_manage_institutions ON institutions
    FOR ALL
    USING (current_setting('app.platform_admin', true) = 'true')
    WITH CHECK (current_setting('app.platform_admin', true) = 'true');
CREATE POLICY platform_admin_manage_memberships ON institution_memberships
    FOR ALL
    USING (current_setting('app.platform_admin', true) = 'true')
    WITH CHECK (current_setting('app.platform_admin', true) = 'true');
CREATE POLICY platform_admin_manage_admins ON platform_admins
    FOR ALL
    USING (current_setting('app.platform_admin', true) = 'true')
    WITH CHECK (current_setting('app.platform_admin', true) = 'true');

DROP POLICY operational_audit_events_select_tenant ON operational_audit_events;
CREATE POLICY operational_audit_events_select_tenant ON operational_audit_events
    FOR SELECT USING (
        current_setting('app.platform_admin', true) = 'true'
        OR (
            institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
            AND (
                actor_user_id::text = NULLIF(current_setting('app.user_id', true), '')
                OR EXISTS (
                    SELECT 1 FROM institution_memberships AS membership
                    WHERE membership.user_id::text = NULLIF(current_setting('app.user_id', true), '')
                      AND membership.institution_id = operational_audit_events.institution_id
                      AND membership.active = true
                      AND membership.role = 'institution_admin'
                )
            )
        )
    );
