-- Verification is a separate, auditable staff action tied to the exact claim approval.
-- A later claim review changes reviewed_at, so an old verification cannot authorize a new approval.
ALTER TABLE claims
    ADD CONSTRAINT claims_id_item_key UNIQUE (id, item_id);

-- Keep the app's direct-SQL claim insert policy aligned with the API's found-only rule.
GRANT SELECT (kind) ON items TO vilivyopotea_public_reader;
GRANT CREATE ON SCHEMA public TO vilivyopotea_public_reader;
CREATE FUNCTION public.is_claimable_item(candidate uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.items AS item
        JOIN public.institutions AS institution ON institution.id = item.institution_id
        WHERE item.id = candidate
          AND item.kind = 'found'
          AND item.review_status = 'approved'
          AND item.visibility = 'public'
          AND item.status NOT IN ('returned', 'closed')
          AND institution.active = true
    );
$$;
ALTER FUNCTION public.is_claimable_item(uuid) OWNER TO vilivyopotea_public_reader;
REVOKE ALL ON FUNCTION public.is_claimable_item(uuid) FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM vilivyopotea_public_reader;
DROP POLICY claims_insert_by_claimant ON claims;
CREATE POLICY claims_insert_by_claimant ON claims
    FOR INSERT
    WITH CHECK (
        claimant_id::text = NULLIF(current_setting('app.user_id', true), '')
        AND public.is_claimable_item(item_id)
    );

CREATE TABLE claim_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id uuid NOT NULL,
    item_id uuid NOT NULL,
    institution_id uuid NOT NULL,
    verified_by uuid NOT NULL REFERENCES app_users(id),
    approved_at timestamptz NOT NULL,
    verification_method text NOT NULL
        CHECK (verification_method IN ('in_person', 'video_call', 'document_review', 'other')),
    verification_note text NOT NULL
        CHECK (char_length(btrim(verification_note)) BETWEEN 8 AND 2000),
    verified_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT claim_verifications_claim_approval_key UNIQUE (claim_id, approved_at),
    CONSTRAINT claim_verifications_claim_item_fkey
        FOREIGN KEY (claim_id, item_id) REFERENCES claims (id, item_id) ON DELETE CASCADE,
    CONSTRAINT claim_verifications_item_institution_fkey
        FOREIGN KEY (item_id, institution_id) REFERENCES items (id, institution_id) ON DELETE CASCADE
);
CREATE INDEX claim_verifications_institution_created_idx
    ON claim_verifications (institution_id, verified_at DESC);

ALTER TABLE claim_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_verifications FORCE ROW LEVEL SECURITY;

CREATE POLICY claim_verifications_select_by_tenant ON claim_verifications
    FOR SELECT
    USING (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        OR current_setting('app.platform_admin', true) = 'true'
    );
CREATE POLICY claim_verifications_insert_by_staff ON claim_verifications
    FOR INSERT
    WITH CHECK (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        AND verified_by::text = NULLIF(current_setting('app.user_id', true), '')
        AND EXISTS (
            SELECT 1 FROM institution_memberships AS membership
            WHERE membership.user_id::text = NULLIF(current_setting('app.user_id', true), '')
              AND membership.institution_id = claim_verifications.institution_id
              AND membership.active = true
              AND membership.role IN ('staff', 'institution_admin')
        )
        AND EXISTS (
            SELECT 1 FROM claims AS claim
            JOIN items AS item ON item.id = claim.item_id
            WHERE claim.id = claim_verifications.claim_id
              AND claim.item_id = claim_verifications.item_id
              AND item.kind = 'found'
              AND claim.status = 'approved'
              AND claim.reviewed_at = claim_verifications.approved_at
              AND item.institution_id = claim_verifications.institution_id
        )
    );

-- The handover insert itself is protected even if a future API handler forgets a check.
DROP POLICY handovers_insert_by_tenant ON handovers;
CREATE POLICY handovers_insert_by_tenant ON handovers
    FOR INSERT
    WITH CHECK (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        AND recorded_by::text = NULLIF(current_setting('app.user_id', true), '')
        AND EXISTS (
            SELECT 1 FROM institution_memberships AS membership
            WHERE membership.user_id::text = NULLIF(current_setting('app.user_id', true), '')
              AND membership.institution_id = handovers.institution_id
              AND membership.active = true
              AND membership.role IN ('staff', 'institution_admin')
        )
        AND EXISTS (
            SELECT 1
            FROM cases AS case_record
            JOIN claims AS claim
              ON claim.id = handovers.claim_id
             AND claim.item_id = case_record.item_id
            JOIN items AS item
              ON item.id = claim.item_id
             AND item.kind = 'found'
            JOIN claim_verifications AS verification
              ON verification.claim_id = claim.id
             AND verification.item_id = case_record.item_id
             AND verification.institution_id = case_record.institution_id
             AND verification.approved_at = claim.reviewed_at
            WHERE case_record.id = handovers.case_id
              AND case_record.institution_id = handovers.institution_id
              AND case_record.status = 'matched'
              AND claim.status = 'approved'
        )
    );

CREATE FUNCTION enforce_verified_handover_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    case_item uuid;
    case_status text;
    locked_claim uuid;
    valid_claim boolean;
BEGIN
    SELECT item_id, status INTO case_item, case_status
    FROM cases
    WHERE id = NEW.case_id AND institution_id = NEW.institution_id
    FOR UPDATE;

    IF NOT FOUND OR case_status <> 'matched' THEN
        RAISE EXCEPTION 'handover requires a matched case' USING ERRCODE = '23514';
    END IF;
    IF NEW.claim_id IS NULL OR NEW.recorded_by IS NULL THEN
        RAISE EXCEPTION 'handover requires a claim and recording staff member' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM handovers WHERE case_id = NEW.case_id) THEN
        RAISE EXCEPTION 'case already has a handover' USING ERRCODE = '23514';
    END IF;

    SELECT claim.id INTO locked_claim
    FROM claims AS claim
    JOIN items AS item ON item.id = claim.item_id AND item.kind = 'found'
    WHERE claim.id = NEW.claim_id AND claim.item_id = case_item AND claim.status = 'approved'
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'handover requires an approved claim for this case'
            USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM claims AS claim
        JOIN items AS item ON item.id = claim.item_id AND item.kind = 'found'
        JOIN claim_verifications AS verification
          ON verification.claim_id = claim.id
         AND verification.item_id = claim.item_id
         AND verification.institution_id = NEW.institution_id
         AND verification.approved_at = claim.reviewed_at
        WHERE claim.id = NEW.claim_id
          AND claim.item_id = case_item
          AND claim.status = 'approved'
    ) INTO valid_claim;
    IF NOT valid_claim THEN
        RAISE EXCEPTION 'handover requires a currently approved and verified claim for this case'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER handovers_require_verified_claim
    BEFORE INSERT ON handovers
    FOR EACH ROW EXECUTE FUNCTION enforce_verified_handover_insert();

CREATE FUNCTION enforce_case_return_handover()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'returned' AND OLD.status IS DISTINCT FROM NEW.status
       AND NOT EXISTS (
           SELECT 1
           FROM handovers AS handover
           JOIN claims AS claim
             ON claim.id = handover.claim_id
            AND claim.item_id = NEW.item_id
           JOIN items AS item
             ON item.id = claim.item_id
            AND item.kind = 'found'
           JOIN claim_verifications AS verification
             ON verification.claim_id = claim.id
            AND verification.item_id = NEW.item_id
            AND verification.institution_id = NEW.institution_id
            AND verification.approved_at = claim.reviewed_at
           WHERE handover.case_id = NEW.id
             AND handover.institution_id = NEW.institution_id
             AND claim.status = 'approved'
       ) THEN
        RAISE EXCEPTION 'case return requires a verified claim handover' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER cases_require_verified_handover
    BEFORE UPDATE OF status ON cases
    FOR EACH ROW EXECUTE FUNCTION enforce_case_return_handover();

CREATE FUNCTION enforce_item_return_handover()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'returned' AND OLD.status IS DISTINCT FROM NEW.status
       AND NOT EXISTS (
           SELECT 1
           FROM cases AS case_record
           JOIN handovers AS handover
             ON handover.case_id = case_record.id
            AND handover.institution_id = case_record.institution_id
           JOIN claims AS claim
             ON claim.id = handover.claim_id
            AND claim.item_id = NEW.id
           JOIN items AS item
             ON item.id = claim.item_id
            AND item.kind = 'found'
           JOIN claim_verifications AS verification
             ON verification.claim_id = claim.id
            AND verification.item_id = NEW.id
            AND verification.institution_id = case_record.institution_id
            AND verification.approved_at = claim.reviewed_at
           WHERE case_record.item_id = NEW.id
             AND case_record.institution_id = NEW.institution_id
             AND case_record.status = 'returned'
             AND claim.status = 'approved'
       ) THEN
        RAISE EXCEPTION 'item return requires a verified claim handover' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER items_require_verified_handover
    BEFORE UPDATE OF status ON items
    FOR EACH ROW EXECUTE FUNCTION enforce_item_return_handover();
