# Institution-approved pilot gate

**Current status:** no DIT or other institution has approved a pilot. This checklist is not approval. Use synthetic data and leave AI matching off until a named institution signs the written pilot decision.

## Required before any live pilot

- [ ] Written approval from the institution's authorized sponsor and data controller, including DIT if DIT is the participating institution; name the accountable service owner.
- [ ] Privacy/legal/security review: data purpose and lawful basis, user notice/consent where required, data minimization, access roles, retention/deletion schedule, data-residency/vendor review, incident notification, and handling of minors or especially sensitive records.
- [ ] Institution-defined tenant boundaries and initial staff roster, with least-privilege onboarding/offboarding and a tested account-recovery process.
- [ ] A domain owned/authorized by the institution, valid public DNS, ports 80/443, verified HTTPS certificate and cookie/CORS settings; no direct public API, AI, database or metrics access.
- [ ] Production secret store and rotation owners for PostgreSQL owner/app-role credentials, database DSNs and AI-service token. Secrets must be file-mounted or injected by the approved runtime and excluded from Git/backups/logs.
- [ ] Approved email delivery provider, sender domain, bounce/abuse handling and retention; the local outbox with raw links is not a production mailer.
- [ ] Independent database-role, RLS/tenant-isolation, network, TLS, auth, rate-limit, dependency and threat-model review; resolve all findings before live records.
- [ ] Approved baseline for rate limits, monitoring access/alerting, audit review and retention; `/metrics` is private and logs are intentionally content-free.
- [ ] Encrypted backup destination and key custody, documented RPO/RTO, backup monitoring, and a successful isolated restore drill.
- [ ] Named incident commander and privacy/security escalation contacts; rehearse service containment, secret rotation, session revocation and recovery.
- [ ] Staff training and accessible user support for independent identity/ownership verification, appeal/correction requests and false/ambiguous leads.
- [ ] Written pilot scope, duration, data deletion/return date, success/safety criteria and a stop authority.

## Matching-specific gate

- [ ] Reconfirm English, Swahili, code-switching, typo, near-duplicate and distractor benchmark results using only approved, de-identified or synthetic evaluation data.
- [ ] Verify EmbeddingGemma loads in the exact approved AI container/checkpoint and monitor latency, memory, failure/fallback rates and top-five review workload.
- [ ] Show only a top-five shortlist, never auto-match, auto-approve, or treat similarity as ownership evidence.
- [ ] Obtain explicit written approval to enable `AI_MATCHING_ENABLED=true`; otherwise keep it `false`.
