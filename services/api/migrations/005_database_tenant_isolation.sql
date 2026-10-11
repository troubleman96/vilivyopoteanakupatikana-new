-- Enforce tenant consistency even when application queries omit a tenant filter.
ALTER TABLE items
    ADD CONSTRAINT items_id_institution_key UNIQUE (id, institution_id);

ALTER TABLE cases
    ADD CONSTRAINT cases_id_institution_key UNIQUE (id, institution_id),
    ADD CONSTRAINT cases_item_institution_fkey
        FOREIGN KEY (item_id, institution_id)
        REFERENCES items (id, institution_id);

ALTER TABLE handovers
    ADD CONSTRAINT handovers_case_institution_fkey
        FOREIGN KEY (case_id, institution_id)
        REFERENCES cases (id, institution_id);

-- Retire only the three exact synthetic listings inserted by the old 002 seed.
-- Keep rows and claims in place; hide the listing and close its case only when
-- there is no claimant or completed handover relying on that sample workflow.
CREATE TEMP TABLE phase2_legacy_demo_items ON COMMIT DROP AS
SELECT i.id, i.institution_id
FROM items AS i
JOIN institutions AS org ON org.id = i.institution_id
WHERE org.name = 'Example University'
  AND i.contact_details = ''
  AND i.status = 'open'
  AND i.review_status = 'approved'
  AND i.visibility = 'public'
  AND (
      (i.kind = 'found' AND i.category = 'electronics'
       AND i.private_title = 'Dark laptop sleeve'
       AND i.private_description = 'Dark padded laptop sleeve found near a shared library area.'
       AND i.private_location = 'Library entrance area'
       AND i.public_title = 'Dark laptop sleeve'
       AND i.public_description = 'Dark padded laptop sleeve found near a shared library area.'
       AND i.public_location = 'Library entrance area'
       AND i.occurred_on = DATE '2026-10-10')
      OR
      (i.kind = 'lost' AND i.category = 'accessories'
       AND i.private_title = 'Blue umbrella'
       AND i.private_description = 'Foldable blue umbrella reported missing around a public study area.'
       AND i.private_location = 'Student commons area'
       AND i.public_title = 'Blue umbrella'
       AND i.public_description = 'Foldable blue umbrella reported missing around a public study area.'
       AND i.public_location = 'Student commons area'
       AND i.occurred_on = DATE '2026-10-09')
      OR
      (i.kind = 'found' AND i.category = 'keys'
       AND i.private_title = 'Small keyring with blue tag'
       AND i.private_description = 'Small set of keys found near a campus service desk.'
       AND i.private_location = 'Student services area'
       AND i.public_title = 'Small keyring with blue tag'
       AND i.public_description = 'Small set of keys found near a campus service desk.'
       AND i.public_location = 'Student services area'
       AND i.occurred_on = DATE '2026-10-08')
  );

UPDATE items AS i
SET status = 'closed', visibility = 'private'
FROM phase2_legacy_demo_items AS demo
WHERE i.id = demo.id;

UPDATE cases AS c
SET status = 'closed', updated_at = now()
WHERE c.item_id IN (SELECT id FROM phase2_legacy_demo_items)
  AND c.status NOT IN ('returned', 'closed')
  AND NOT EXISTS (SELECT 1 FROM claims AS claim WHERE claim.item_id = c.item_id)
  AND NOT EXISTS (SELECT 1 FROM handovers AS handover WHERE handover.case_id = c.id);

UPDATE institutions AS org
SET active = false
WHERE org.name = 'Example University'
  AND org.region = 'Dar es Salaam, Tanzania · synthetic demo'
  AND NOT EXISTS (
      SELECT 1 FROM institution_memberships AS membership
      WHERE membership.institution_id = org.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM items AS i
      WHERE i.institution_id = org.id
        AND NOT EXISTS (SELECT 1 FROM phase2_legacy_demo_items AS demo WHERE demo.id = i.id)
  )
  AND NOT EXISTS (
      SELECT 1 FROM claims AS claim
      JOIN phase2_legacy_demo_items AS demo ON demo.id = claim.item_id
      WHERE demo.institution_id = org.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM handovers AS handover
      JOIN cases AS c ON c.id = handover.case_id
      JOIN phase2_legacy_demo_items AS demo ON demo.id = c.item_id
      WHERE demo.institution_id = org.id
  );

-- The API connects as a non-owner role. FORCE also protects against accidental
-- use of the migration owner for ordinary application queries.
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions FORCE ROW LEVEL SECURITY;
ALTER TABLE institution_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins FORCE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE items FORCE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases FORCE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims FORCE ROW LEVEL SECURITY;
ALTER TABLE handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE handovers FORCE ROW LEVEL SECURITY;

CREATE POLICY institutions_visible_active ON institutions
    FOR SELECT
    USING (active OR current_setting('app.platform_admin', true) = 'true');

CREATE POLICY memberships_visible_to_owner ON institution_memberships
    FOR SELECT
    USING (user_id::text = NULLIF(current_setting('app.user_id', true), ''));

CREATE POLICY platform_admins_visible_to_owner ON platform_admins
    FOR SELECT
    USING (user_id::text = NULLIF(current_setting('app.user_id', true), ''));

CREATE POLICY items_select_by_tenant_or_owner ON items
    FOR SELECT
    USING (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        OR reporter_id::text = NULLIF(current_setting('app.user_id', true), '')
        OR current_setting('app.platform_admin', true) = 'true'
    );

-- Anonymous/public search runs only through this projection. The view owner
-- bypasses base-table RLS, but no private item fields are present in its schema.
CREATE VIEW public_items WITH (security_barrier = true) AS
    SELECT i.id, i.institution_id, org.name AS institution_name,
           i.category, i.public_title, i.public_description, i.public_location,
           i.occurred_on, i.kind, i.status
    FROM public.items AS i
    JOIN public.institutions AS org ON org.id = i.institution_id
    WHERE i.review_status = 'approved'
      AND i.visibility = 'public'
      AND i.status NOT IN ('returned', 'closed')
      AND org.active = true;

CREATE FUNCTION public.is_public_item(candidate uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.items AS i
        JOIN public.institutions AS org ON org.id = i.institution_id
        WHERE i.id = candidate
          AND i.review_status = 'approved'
          AND i.visibility = 'public'
          AND i.status NOT IN ('returned', 'closed')
          AND org.active = true
    );
$$;
REVOKE ALL ON FUNCTION public.is_public_item(uuid) FROM PUBLIC;

-- This NOLOGIN BYPASSRLS owner is granted only the columns required by the
-- safe public projection and validator. The API role is never a member of it.
GRANT USAGE ON SCHEMA public TO vilivyopotea_public_reader;
GRANT SELECT (id, institution_id, category, public_title, public_description,
              public_location, occurred_on, kind, status, review_status, visibility)
    ON items TO vilivyopotea_public_reader;
GRANT SELECT (id, name, active) ON institutions TO vilivyopotea_public_reader;
GRANT CREATE ON SCHEMA public TO vilivyopotea_public_reader;
ALTER VIEW public_items OWNER TO vilivyopotea_public_reader;
ALTER FUNCTION public.is_public_item(uuid) OWNER TO vilivyopotea_public_reader;
REVOKE CREATE ON SCHEMA public FROM vilivyopotea_public_reader;

CREATE POLICY items_insert_as_reporter ON items
    FOR INSERT
    WITH CHECK (
        reporter_id::text = NULLIF(current_setting('app.user_id', true), '')
        AND institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
    );
CREATE POLICY items_update_by_tenant ON items
    FOR UPDATE
    USING (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        OR current_setting('app.platform_admin', true) = 'true'
    )
    WITH CHECK (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        OR current_setting('app.platform_admin', true) = 'true'
    );

CREATE POLICY cases_select_by_tenant ON cases
    FOR SELECT
    USING (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        OR current_setting('app.platform_admin', true) = 'true'
    );
CREATE POLICY cases_insert_by_tenant ON cases
    FOR INSERT
    WITH CHECK (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        AND EXISTS (
            SELECT 1 FROM items AS i
            WHERE i.id = cases.item_id AND i.institution_id = cases.institution_id
        )
    );
CREATE POLICY cases_update_by_tenant ON cases
    FOR UPDATE
    USING (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        OR current_setting('app.platform_admin', true) = 'true'
    )
    WITH CHECK (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        OR current_setting('app.platform_admin', true) = 'true'
    );

CREATE POLICY claims_select_by_tenant_or_claimant ON claims
    FOR SELECT
    USING (
        claimant_id::text = NULLIF(current_setting('app.user_id', true), '')
        OR current_setting('app.platform_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM items AS i
            WHERE i.id = claims.item_id
              AND i.institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        )
    );
CREATE POLICY claims_insert_by_claimant ON claims
    FOR INSERT
    WITH CHECK (
        claimant_id::text = NULLIF(current_setting('app.user_id', true), '')
        AND public.is_public_item(item_id)
    );
CREATE POLICY claims_update_by_tenant ON claims
    FOR UPDATE
    USING (
        current_setting('app.platform_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM items AS i
            WHERE i.id = claims.item_id
              AND i.institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        )
    )
    WITH CHECK (
        current_setting('app.platform_admin', true) = 'true'
        OR EXISTS (
            SELECT 1 FROM items AS i
            WHERE i.id = claims.item_id
              AND i.institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        )
    );

CREATE POLICY handovers_select_by_tenant ON handovers
    FOR SELECT
    USING (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        OR current_setting('app.platform_admin', true) = 'true'
    );
CREATE POLICY handovers_insert_by_tenant ON handovers
    FOR INSERT
    WITH CHECK (
        institution_id::text = NULLIF(current_setting('app.institution_id', true), '')
        OR current_setting('app.platform_admin', true) = 'true'
    );
