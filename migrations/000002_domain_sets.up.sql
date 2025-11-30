-- Migration 002: Domain sets for organizing domain sources

-- Domain sets (e.g., "com zone file" from "ICANN CZDS")
CREATE TABLE domain_sets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    source      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add domain_set_id to root_domains (required)
ALTER TABLE root_domains ADD COLUMN domain_set_id UUID NOT NULL REFERENCES domain_sets(id) ON DELETE CASCADE;

CREATE INDEX idx_root_domains_domain_set ON root_domains(domain_set_id);
