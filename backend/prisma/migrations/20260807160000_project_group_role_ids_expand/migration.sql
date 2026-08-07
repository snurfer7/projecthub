-- Store assigned role IDs on ProjectGroup; expand membership at read time.
ALTER TABLE "project_groups" ADD COLUMN "role_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

-- Recreate missing ProjectGroup rows from legacy group-sourced roles (orphans).
INSERT INTO "project_groups" ("project_id", "group_id", "role_ids")
SELECT
  pm.project_id,
  pmr.source_group_id,
  ARRAY_AGG(DISTINCT pmr.role_id ORDER BY pmr.role_id)
FROM "project_member_roles" pmr
INNER JOIN "project_members" pm ON pm.id = pmr.project_member_id
WHERE pmr.source_group_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM "groups" g WHERE g.id = pmr.source_group_id)
  AND NOT EXISTS (
    SELECT 1 FROM "project_groups" pg
    WHERE pg.project_id = pm.project_id AND pg.group_id = pmr.source_group_id
  )
GROUP BY pm.project_id, pmr.source_group_id
ON CONFLICT ("project_id", "group_id") DO NOTHING;

-- Backfill role_ids on existing / newly created ProjectGroup rows.
UPDATE "project_groups" AS pg
SET "role_ids" = sub.role_ids
FROM (
  SELECT
    pm.project_id,
    pmr.source_group_id AS group_id,
    ARRAY_AGG(DISTINCT pmr.role_id ORDER BY pmr.role_id) AS role_ids
  FROM "project_member_roles" pmr
  INNER JOIN "project_members" pm ON pm.id = pmr.project_member_id
  WHERE pmr.source_group_id IS NOT NULL
  GROUP BY pm.project_id, pmr.source_group_id
) AS sub
WHERE pg.project_id = sub.project_id
  AND pg.group_id = sub.group_id
  AND (pg.role_ids IS NULL OR cardinality(pg.role_ids) = 0);

-- Drop legacy group-sourced roles (access now comes from ProjectGroup.role_ids).
DELETE FROM "project_member_roles" WHERE "source_group_id" IS NOT NULL;

-- Remove ProjectMember rows that no longer hold any role.
DELETE FROM "project_members" pm
WHERE NOT EXISTS (
  SELECT 1 FROM "project_member_roles" pmr WHERE pmr.project_member_id = pm.id
);
