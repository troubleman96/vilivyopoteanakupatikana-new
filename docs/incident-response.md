# Incident response runbook (pre-pilot)

**Status:** operational template only. Before a pilot, name the institution's incident commander, security/privacy contacts, escalation channels, vendor contacts, legal reporting obligations and decision authority. No institution or DIT is represented as having approved this runbook.

## First response

1. **Contain:** use the deployment edge to restrict or take the service offline. If matching is implicated, set `AI_MATCHING_ENABLED=false` and restart the API; matching remains advisory and must never auto-match. Isolate affected credentials or network paths. Do not delete records, backups or logs to “clean up.”
2. **Preserve:** record the incident time, request IDs, relevant JSON logs, database audit rows and backup identifiers. Restrict evidence access to the named responders; preserve integrity/checksums and document each transfer. Avoid exporting unrelated tenant data.
3. **Protect accounts and secrets:** rotate the affected secret through the approved secret store, revoke affected sessions using the authenticated sign-out-all capability or the institution's controlled admin procedure, and verify the old credential no longer works. Do not send secrets through incident tickets or chat.
4. **Scope safely:** identify affected tenants, data classes, systems, time window and whether private claims/contact/evidence metadata may have been accessed. Use RLS-scoped queries and a designated data custodian. Do not infer that a match suggestion is evidence of ownership.
5. **Notify and decide:** promptly contact the institution's designated security/privacy lead, system owner and legal/data-protection contacts. They determine notices, regulator/user communication and timelines under applicable law and institutional policy; this template does not set a legal deadline.
6. **Recover:** rebuild from a verified, encrypted backup only after preserving evidence. Rotate secrets, patch the cause, validate TLS, least privilege, migrations, tenant RLS, rate limits and audit records, and complete an independent restore/recovery check before re-opening.
7. **Close out:** document scope, decisions, impact, notifications, corrective actions and owner/due date. Review the event with the institution and update this runbook and the pilot risk register.

## Readiness checks

- Keep production endpoint and credentials out of public chat, tickets and source control.
- Keep matching disabled unless the written pilot decision authorizes it.
- Ensure logs omit query strings, bodies, identifiers and client IPs; keep `/metrics` private.
- Verify current encrypted backup checksum and last restore-drill result.
- Maintain an incident contact tree and a secure evidence location before the first real record is collected.
