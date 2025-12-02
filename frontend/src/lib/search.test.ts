import { describe, it, expect } from 'vitest';
import { buildFQDNIndex, buildLocationIndex, parseSearchQuery, matchesAny } from './search';

const mockFeature = (fqdns: string[], rootDomains: string[], lastSeenAt: string) => ({
	type: 'Feature' as const,
	geometry: { type: 'Point' as const, coordinates: [0, 0] },
	properties: {
		fqdns: JSON.stringify(fqdns),
		root_domains: JSON.stringify(rootDomains),
		last_seen_at: lastSeenAt
	}
});

describe('buildFQDNIndex', () => {
	it('creates an entry for each FQDN in all features', () => {
		const geojson: GeoJSON.FeatureCollection = {
			type: 'FeatureCollection',
			features: [
				mockFeature(['a.example.com', 'b.example.com'], ['example.com'], '2024-01-01'),
				mockFeature(['c.test.org'], ['test.org'], '2024-01-02')
			]
		};

		const index = buildFQDNIndex(geojson);

		expect(index).toHaveLength(3);
		expect(index.map((e) => e.fqdn)).toContain('a.example.com');
		expect(index.map((e) => e.fqdn)).toContain('b.example.com');
		expect(index.map((e) => e.fqdn)).toContain('c.test.org');
	});

	it('sorts entries by lastSeenAt descending (newest first)', () => {
		const geojson: GeoJSON.FeatureCollection = {
			type: 'FeatureCollection',
			features: [
				mockFeature(['old.com'], ['old.com'], '2024-01-01'),
				mockFeature(['new.com'], ['new.com'], '2024-06-01'),
				mockFeature(['mid.com'], ['mid.com'], '2024-03-01')
			]
		};

		const index = buildFQDNIndex(geojson);

		expect(index[0].fqdn).toBe('new.com');
		expect(index[1].fqdn).toBe('mid.com');
		expect(index[2].fqdn).toBe('old.com');
	});

	it('handles features with fqdns as array (not JSON string)', () => {
		const geojson: GeoJSON.FeatureCollection = {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [0, 0] },
					properties: {
						fqdns: ['direct.com'],
						last_seen_at: '2024-01-01'
					}
				}
			]
		};

		const index = buildFQDNIndex(geojson);

		expect(index).toHaveLength(1);
		expect(index[0].fqdn).toBe('direct.com');
	});

	it('handles missing properties gracefully', () => {
		const geojson: GeoJSON.FeatureCollection = {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [0, 0] },
					properties: null
				}
			]
		};

		const index = buildFQDNIndex(geojson);

		expect(index).toHaveLength(0);
	});
});

describe('buildLocationIndex', () => {
	it('creates one entry per feature', () => {
		const geojson: GeoJSON.FeatureCollection = {
			type: 'FeatureCollection',
			features: [
				mockFeature(['a.example.com', 'b.example.com'], ['example.com'], '2024-01-01'),
				mockFeature(['c.test.org'], ['test.org'], '2024-01-02')
			]
		};

		const index = buildLocationIndex(geojson);

		expect(index).toHaveLength(2);
	});

	it('shows FQDN directly when there is only one', () => {
		const geojson: GeoJSON.FeatureCollection = {
			type: 'FeatureCollection',
			features: [mockFeature(['sub.example.com'], ['example.com', 'other.com'], '2024-01-01')]
		};

		const index = buildLocationIndex(geojson);

		// Single FQDN should be shown directly, not the root domain
		expect(index[0].rootDomain).toBe('sub.example.com');
	});

	it('uses root domain when there are multiple FQDNs', () => {
		const geojson: GeoJSON.FeatureCollection = {
			type: 'FeatureCollection',
			features: [
				mockFeature(['a.example.com', 'b.example.com'], ['example.com'], '2024-01-01')
			]
		};

		const index = buildLocationIndex(geojson);

		// Multiple FQDNs should show the root domain
		expect(index[0].rootDomain).toBe('example.com');
	});

	it('falls back to FQDN if no root domain', () => {
		const geojson: GeoJSON.FeatureCollection = {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [0, 0] },
					properties: {
						fqdns: JSON.stringify(['fallback.com']),
						root_domains: JSON.stringify([]),
						last_seen_at: '2024-01-01'
					}
				}
			]
		};

		const index = buildLocationIndex(geojson);

		expect(index[0].rootDomain).toBe('fallback.com');
	});

	it('includes fqdnCount for each location', () => {
		const geojson: GeoJSON.FeatureCollection = {
			type: 'FeatureCollection',
			features: [
				mockFeature(
					['a.example.com', 'b.example.com', 'c.example.com'],
					['example.com'],
					'2024-01-01'
				)
			]
		};

		const index = buildLocationIndex(geojson);

		expect(index[0].fqdnCount).toBe(3);
	});

	it('sorts entries by lastSeenAt descending', () => {
		const geojson: GeoJSON.FeatureCollection = {
			type: 'FeatureCollection',
			features: [
				mockFeature(['old.com'], ['old.com'], '2024-01-01'),
				mockFeature(['new.com'], ['new.com'], '2024-06-01')
			]
		};

		const index = buildLocationIndex(geojson);

		expect(index[0].rootDomain).toBe('new.com');
		expect(index[1].rootDomain).toBe('old.com');
	});
});

describe('parseSearchQuery', () => {
	it('parses simple include terms', () => {
		const result = parseSearchQuery('cloudflare');
		expect(result.includeTerms).toEqual(['cloudflare']);
		expect(result.excludeTerms).toEqual([]);
	});

	it('parses multiple include terms', () => {
		const result = parseSearchQuery('cloudflare amazon');
		expect(result.includeTerms).toEqual(['cloudflare', 'amazon']);
		expect(result.excludeTerms).toEqual([]);
	});

	it('parses exclude terms with - prefix', () => {
		const result = parseSearchQuery('-microsoft');
		expect(result.includeTerms).toEqual([]);
		expect(result.excludeTerms).toEqual(['microsoft']);
	});

	it('parses mixed include and exclude terms', () => {
		const result = parseSearchQuery('cloudflare -microsoft -amazon');
		expect(result.includeTerms).toEqual(['cloudflare']);
		expect(result.excludeTerms).toEqual(['microsoft', 'amazon']);
	});

	it('handles empty query', () => {
		const result = parseSearchQuery('');
		expect(result.includeTerms).toEqual([]);
		expect(result.excludeTerms).toEqual([]);
	});

	it('handles whitespace-only query', () => {
		const result = parseSearchQuery('   ');
		expect(result.includeTerms).toEqual([]);
		expect(result.excludeTerms).toEqual([]);
	});

	it('ignores lone - character', () => {
		const result = parseSearchQuery('- test');
		expect(result.includeTerms).toEqual(['test']);
		expect(result.excludeTerms).toEqual([]);
	});

	it('converts to lowercase', () => {
		const result = parseSearchQuery('CloudFlare -MICROSOFT');
		expect(result.includeTerms).toEqual(['cloudflare']);
		expect(result.excludeTerms).toEqual(['microsoft']);
	});
});

describe('matchesAny', () => {
	it('returns true if value contains any term', () => {
		expect(matchesAny('sub.cloudflare.com', ['cloudflare'])).toBe(true);
		expect(matchesAny('test.example.com', ['example', 'other'])).toBe(true);
	});

	it('returns false if value contains no terms', () => {
		expect(matchesAny('cloudflare.com', ['microsoft', 'amazon'])).toBe(false);
	});

	it('is case-insensitive', () => {
		expect(matchesAny('CloudFlare.com', ['cloudflare'])).toBe(true);
		expect(matchesAny('cloudflare.com', ['CLOUDFLARE'])).toBe(true);
	});

	it('returns false for empty terms array', () => {
		expect(matchesAny('anything.com', [])).toBe(false);
	});
});
