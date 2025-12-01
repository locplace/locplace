-- Migration 004: Add priority queue support via queued_at timestamp
-- NULL = normal priority, timestamp = bumped (higher timestamp = higher priority)

ALTER TABLE root_domains ADD COLUMN queued_at TIMESTAMPTZ;

-- Index for efficient priority ordering
CREATE INDEX idx_root_domains_queued ON root_domains(queued_at DESC NULLS LAST);
