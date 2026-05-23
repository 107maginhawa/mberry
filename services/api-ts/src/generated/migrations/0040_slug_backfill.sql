-- Wave 0 T1: Backfill slugs for existing organizations
-- Expand phase of expand-then-contract migration (D5)
-- Generates URL-safe slugs from org names, auto-suffixes collisions
-- Falls back to 'org-<first8-uuid>' for names with no alphanumeric chars

-- Step 1: Backfill slugs from org names (simple cases — no collision)
UPDATE organization
SET slug = lower(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(trim(name), '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    ),
    '^-|-$', '', 'g'
  )
)
WHERE slug IS NULL;

-- Step 2: Fix any empty slugs (all-special-char names) → 'org-<first8uuid>'
UPDATE organization
SET slug = 'org-' || left(replace(id::text, '-', ''), 8)
WHERE slug IS NULL OR slug = '';

-- Step 3: Handle collisions — append suffix for duplicates
-- Uses a window function to find duplicates and suffix them
WITH dupes AS (
  SELECT id, slug,
    ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
  FROM organization
)
UPDATE organization o
SET slug = o.slug || '-' || d.rn
FROM dupes d
WHERE o.id = d.id AND d.rn > 1;
