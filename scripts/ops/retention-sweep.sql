BEGIN;

WITH removed AS (
    DELETE FROM auth_email_outbox
    WHERE created_at < now() - make_interval(days => :'outbox_days'::integer)
    RETURNING 1
)
SELECT 'auth_email_outbox', count(*) FROM removed;

WITH removed AS (
    DELETE FROM auth_email_tokens
    WHERE expires_at < now() - make_interval(days => :'token_days'::integer)
    RETURNING 1
)
SELECT 'auth_email_tokens', count(*) FROM removed;

WITH removed AS (
    DELETE FROM auth_sessions
    WHERE (expires_at < now() - make_interval(days => :'session_days'::integer))
       OR (revoked_at IS NOT NULL AND revoked_at < now() - make_interval(days => :'session_days'::integer))
    RETURNING 1
)
SELECT 'auth_sessions', count(*) FROM removed;

WITH removed AS (
    DELETE FROM auth_rate_limits
    WHERE updated_at < now() - make_interval(days => :'rate_limit_days'::integer)
    RETURNING 1
)
SELECT 'auth_rate_limits', count(*) FROM removed;

WITH removed AS (
    DELETE FROM operational_audit_events
    WHERE created_at < now() - make_interval(days => :'audit_days'::integer)
    RETURNING 1
)
SELECT 'operational_audit_events', count(*) FROM removed;

COMMIT;
