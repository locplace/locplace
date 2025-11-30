package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// DomainSet represents a collection of domains from a specific source.
type DomainSet struct {
	ID        string
	Name      string
	Source    string
	CreatedAt time.Time
	// Computed fields
	TotalDomains   int
	ScannedDomains int
}

// CreateDomainSet creates a new domain set.
func (db *DB) CreateDomainSet(ctx context.Context, name, source string) (*DomainSet, error) {
	var ds DomainSet
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO domain_sets (name, source)
		VALUES ($1, $2)
		RETURNING id, name, source, created_at
	`, name, source).Scan(&ds.ID, &ds.Name, &ds.Source, &ds.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &ds, nil
}

// GetDomainSet returns a domain set by ID.
func (db *DB) GetDomainSet(ctx context.Context, id string) (*DomainSet, error) {
	var ds DomainSet
	err := db.Pool.QueryRow(ctx, `
		SELECT
			ds.id, ds.name, ds.source, ds.created_at,
			COUNT(rd.id) as total_domains,
			COUNT(rd.id) FILTER (WHERE rd.last_scanned_at IS NOT NULL) as scanned_domains
		FROM domain_sets ds
		LEFT JOIN root_domains rd ON rd.domain_set_id = ds.id
		WHERE ds.id = $1
		GROUP BY ds.id
	`, id).Scan(&ds.ID, &ds.Name, &ds.Source, &ds.CreatedAt, &ds.TotalDomains, &ds.ScannedDomains)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &ds, nil
}

// ListDomainSets returns all domain sets with counts.
func (db *DB) ListDomainSets(ctx context.Context) ([]DomainSet, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT
			ds.id, ds.name, ds.source, ds.created_at,
			COUNT(rd.id) as total_domains,
			COUNT(rd.id) FILTER (WHERE rd.last_scanned_at IS NOT NULL) as scanned_domains
		FROM domain_sets ds
		LEFT JOIN root_domains rd ON rd.domain_set_id = ds.id
		GROUP BY ds.id
		ORDER BY ds.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sets []DomainSet
	for rows.Next() {
		var ds DomainSet
		if err := rows.Scan(&ds.ID, &ds.Name, &ds.Source, &ds.CreatedAt, &ds.TotalDomains, &ds.ScannedDomains); err != nil {
			return nil, err
		}
		sets = append(sets, ds)
	}
	return sets, rows.Err()
}

// DeleteDomainSet deletes a domain set. Domains in the set will have their domain_set_id set to NULL.
func (db *DB) DeleteDomainSet(ctx context.Context, id string) error {
	tag, err := db.Pool.Exec(ctx, `DELETE FROM domain_sets WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// InsertDomainsToSet inserts multiple domains into a specific set, ignoring duplicates.
func (db *DB) InsertDomainsToSet(ctx context.Context, setID string, domains []string) (inserted, duplicates int, err error) {
	for _, domain := range domains {
		tag, err := db.Pool.Exec(ctx,
			`INSERT INTO root_domains (domain, domain_set_id) VALUES ($1, $2) ON CONFLICT (domain) DO NOTHING`,
			domain, setID,
		)
		if err != nil {
			return inserted, duplicates, err
		}
		if tag.RowsAffected() > 0 {
			inserted++
		} else {
			duplicates++
		}
	}
	return inserted, duplicates, nil
}
