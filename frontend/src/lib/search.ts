/**
 * Search index utilities for building and filtering FQDN and location indices
 */

import type { FQDNEntry, LocationEntry } from './types';

/** Parsed search query with include and exclude terms */
export interface ParsedQuery {
	includeTerms: string[];
	excludeTerms: string[];
}

/**
 * Parses a search query into include and exclude terms.
 * Terms prefixed with - are exclude terms.
 * Example: "cloudflare -microsoft -amazon" → include: ["cloudflare"], exclude: ["microsoft", "amazon"]
 */
export function parseSearchQuery(query: string): ParsedQuery {
	const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
	const includeTerms: string[] = [];
	const excludeTerms: string[] = [];

	for (const term of terms) {
		if (term.startsWith('-') && term.length > 1) {
			excludeTerms.push(term.slice(1));
		} else if (!term.startsWith('-')) {
			includeTerms.push(term);
		}
	}

	return { includeTerms, excludeTerms };
}

/**
 * Checks if a string matches any of the given terms (case-insensitive substring match)
 */
export function matchesAny(value: string, terms: string[]): boolean {
	const lower = value.toLowerCase();
	return terms.some((term) => lower.includes(term.toLowerCase()));
}

/**
 * Parses a JSON array from GeoJSON properties, handling both string and array formats
 */
function parseJsonArray(value: unknown): string[] {
	if (typeof value === 'string') {
		try {
			return JSON.parse(value);
		} catch {
			return [];
		}
	}
	if (Array.isArray(value)) {
		return value;
	}
	return [];
}

/**
 * Builds an index of all FQDNs from GeoJSON features for search
 * Each FQDN gets its own entry, sorted by lastSeenAt descending
 */
export function buildFQDNIndex(geojson: GeoJSON.FeatureCollection): FQDNEntry[] {
	const entries: FQDNEntry[] = [];

	for (const feature of geojson.features) {
		const props = feature.properties;
		const fqdns = parseJsonArray(props?.fqdns);
		const lastSeenAt = props?.last_seen_at ? new Date(props.last_seen_at) : new Date(0);

		for (const fqdn of fqdns) {
			entries.push({ fqdn, feature, lastSeenAt });
		}
	}

	// Sort by lastSeenAt descending (newest first)
	entries.sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
	return entries;
}

/**
 * Builds an index of unique locations from GeoJSON features
 * Each feature (location) gets one entry with its root domain, sorted by lastSeenAt descending
 */
export function buildLocationIndex(geojson: GeoJSON.FeatureCollection): LocationEntry[] {
	const entries: LocationEntry[] = [];

	for (const feature of geojson.features) {
		const props = feature.properties;
		const rootDomains = parseJsonArray(props?.root_domains);
		const fqdns = parseJsonArray(props?.fqdns);
		const lastSeenAt = props?.last_seen_at ? new Date(props.last_seen_at) : new Date(0);

		// If there's only one FQDN, show it directly instead of the root domain
		// Otherwise use the root domain as representative
		const displayName =
			fqdns.length === 1 ? fqdns[0] : rootDomains[0] || fqdns[0] || 'unknown';
		entries.push({ rootDomain: displayName, feature, lastSeenAt, fqdnCount: fqdns.length });
	}

	// Sort by lastSeenAt descending (newest first)
	entries.sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
	return entries;
}
