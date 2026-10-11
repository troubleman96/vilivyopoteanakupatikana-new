# Privacy and retention rules (pilot proposal)

**Status:** proposed local policy; not approved by DIT or another institution. Use synthetic data only until each participating institution's data controller/privacy lead approves the purposes, lawful basis, notice, access, retention, deletion, incident and backup rules in writing. The sample periods below are starting proposals, not a claim of institutional or legal approval.

## Data minimization and handling

- Public listing fields are reviewed and projected separately from private report data. Contact details, claimant statements, evidence references, staff notes and handover details are never sent to the matching service or returned in public listing DTOs.
- Matching uses only reviewed, public-safe summaries, is disabled by default, returns at most five suggestions for staff review, and never establishes ownership or approves a claim. Do not log prompts, public text, claims, contact information, credentials, client IPs or raw request bodies.
- Request logs contain request ID, method, coarse route family, response status and elapsed time only. Matching audit entries contain actor/tenant/target UUIDs and bounded action/status/count/filter metadata, but no prose, notes, email, phone or location text. UUIDs remain linkable while the account/data tables exist and therefore require a retention decision.
- The local email outbox contains raw single-use verification/reset URLs. It is a test sink only; never use real addresses until an approved mail provider and retention/access controls are in place. Evidence fields are references only; the MVP does not accept uploaded evidence files.
- Use least privilege, TLS in transit, encrypted storage/backups, tenant RLS, and documented access review. Do not put secrets, `.env` files, database dumps, Caddy private keys, or age identities in Git.

## Proposed schedule for institutional review

| Data class | Proposed retention | Disposal trigger |
|---|---:|---|
| Local auth mail outbox (raw links) | 1 day after creation | Secure deletion after the link has expired or is no longer needed for local testing |
| Auth token digests | 1 day after expiry | Delete expired verification/reset tokens |
| Expired or revoked sessions | 30 days after expiry/revocation | Delete old session digests |
| Hashed rate-limit buckets | 7 days after last update | Delete stale buckets |
| Operational audit events | 365 days | Delete or archive only under approved institutional schedule |
| Encrypted database backups | 35 days rolling | Prune only after a newer backup has passed validation and restore-drill requirements |

The figures are explicit proposals for DIT/institution review and may need to be shortened or extended. Set the approved values as environment variables before running `scripts/ops/retention-sweep.sh`; the script has no defaults and fails if any period is missing. It runs no background deletion or scheduler by itself. Backups similarly require an explicit `BACKUP_RETENTION_DAYS` and default to refusing unencrypted output.

## User requests and deletion

Before pilot, the institution must designate who verifies access/correction/deletion requests, how legal holds and ongoing claims are handled, what is deleted versus retained for accountability, and how deletions propagate to replicas, backups and exports. Do not promise immediate removal from a backup: record the backup expiry and restore/re-delete procedure. The local implementation has no self-service data-export/deletion workflow; complete and test an approved manual process before accepting real records.
