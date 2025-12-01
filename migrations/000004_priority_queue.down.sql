-- Rollback Migration 004: Remove priority queue support

DROP INDEX IF EXISTS idx_root_domains_queued;
ALTER TABLE root_domains DROP COLUMN IF EXISTS queued_at;
