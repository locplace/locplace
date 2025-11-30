-- Rollback migration 002

DROP INDEX IF EXISTS idx_root_domains_domain_set;
ALTER TABLE root_domains DROP COLUMN IF EXISTS domain_set_id;
DROP TABLE IF EXISTS domain_sets;
