-- Rename the paid agent packages. Only names (and the one feature line that names another package)
-- an administrator has not changed since are touched.
UPDATE "subscription_plans" SET "name" = 'Basic Agent', "updatedAt" = CURRENT_TIMESTAMP WHERE "code" = 'agent-basic' AND "name" = 'Agent Basic';
UPDATE "subscription_plans" SET "name" = 'Advanced Agent', "updatedAt" = CURRENT_TIMESTAMP WHERE "code" = 'agent-premium' AND "name" = 'Agent Premium';
UPDATE "subscription_plans" SET "name" = 'Super Agent', "updatedAt" = CURRENT_TIMESTAMP WHERE "code" = 'agent-premium-pro' AND "name" = 'Agent Premium Pro';
UPDATE "subscription_plans"
SET "features" = array_replace("features", 'Your listings appear above Basic and free listings in search', 'Your listings appear above Basic Agent and free listings in search')
WHERE "code" = 'agent-premium';
