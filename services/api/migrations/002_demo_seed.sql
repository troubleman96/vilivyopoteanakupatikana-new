INSERT INTO institutions (name, region, active)
SELECT 'Example University', 'Dar es Salaam, Tanzania · synthetic demo', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM institutions WHERE name = 'Example University' AND active = TRUE
);

WITH example_institution AS (
    SELECT id
    FROM institutions
    WHERE name = 'Example University' AND active = TRUE
    ORDER BY created_at
    LIMIT 1
), demo_items(kind, category, title, description, location, occurred_on) AS (
    VALUES
        ('found', 'electronics', 'Dark laptop sleeve', 'Dark padded laptop sleeve found near a shared library area.', 'Library entrance area', DATE '2026-10-10'),
        ('lost', 'accessories', 'Blue umbrella', 'Foldable blue umbrella reported missing around a public study area.', 'Student commons area', DATE '2026-10-09'),
        ('found', 'keys', 'Small keyring with blue tag', 'Small set of keys found near a campus service desk.', 'Student services area', DATE '2026-10-08')
)
INSERT INTO items (
    institution_id, reporter_id, kind, category,
    private_title, private_description, private_location,
    public_title, public_description, public_location,
    contact_details, occurred_on, status, review_status, visibility
)
SELECT
    institution.id, gen_random_uuid(), demo_items.kind, demo_items.category,
    demo_items.title, demo_items.description, demo_items.location,
    demo_items.title, demo_items.description, demo_items.location,
    '', demo_items.occurred_on, 'open', 'approved', 'public'
FROM example_institution AS institution
CROSS JOIN demo_items
WHERE NOT EXISTS (
    SELECT 1 FROM items AS existing
    WHERE existing.institution_id = institution.id
      AND existing.public_title = demo_items.title
);

INSERT INTO cases (item_id, institution_id, status)
SELECT item.id, item.institution_id, 'open'
FROM items AS item
JOIN institutions AS institution ON institution.id = item.institution_id
WHERE institution.name = 'Example University'
  AND item.public_title IN ('Dark laptop sleeve', 'Blue umbrella', 'Small keyring with blue tag')
  AND NOT EXISTS (SELECT 1 FROM cases AS existing WHERE existing.item_id = item.id);
