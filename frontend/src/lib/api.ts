// API client with auth handling

export function getApiKey(): string | null {
	if (typeof sessionStorage === 'undefined') return null;
	return sessionStorage.getItem('admin_api_key');
}

export function setApiKey(key: string): void {
	sessionStorage.setItem('admin_api_key', key);
}

export function clearApiKey(): void {
	sessionStorage.removeItem('admin_api_key');
}

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
	const apiKey = getApiKey();
	if (!apiKey) {
		throw new ApiError(401, 'No API key');
	}

	const response = await fetch(path, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			'X-Admin-Key': apiKey,
			...options.headers
		}
	});

	if (!response.ok) {
		if (response.status === 401) {
			clearApiKey();
		}
		const data = await response.json().catch(() => ({ error: 'Request failed' }));
		throw new ApiError(response.status, data.error || 'Request failed');
	}

	return response;
}

// Types
export interface Scanner {
	id: string;
	name: string;
	created_at: string;
	last_heartbeat: string | null;
	is_active: boolean;
}

export interface NewScanner {
	id: string;
	name: string;
	token: string;
}

export interface DomainSet {
	id: string;
	name: string;
	source: string;
	created_at: string;
	total_domains: number;
	scanned_domains: number;
}

export interface NewDomainSet {
	id: string;
	name: string;
	source: string;
}

// API functions
export async function listScanners(): Promise<Scanner[]> {
	const response = await adminFetch('/api/admin/clients');
	const data = await response.json();
	return data.clients || [];
}

export async function createScanner(name: string): Promise<NewScanner> {
	const response = await adminFetch('/api/admin/clients', {
		method: 'POST',
		body: JSON.stringify({ name })
	});
	return response.json();
}

export async function deleteScanner(id: string): Promise<void> {
	await adminFetch(`/api/admin/clients/${id}`, {
		method: 'DELETE'
	});
}

export async function addDomains(domains: string[]): Promise<{ added: number }> {
	const response = await adminFetch('/api/admin/domains', {
		method: 'POST',
		body: JSON.stringify({ domains })
	});
	return response.json();
}

export async function verifyApiKey(key: string): Promise<boolean> {
	const response = await fetch('/api/admin/clients', {
		headers: { 'X-Admin-Key': key }
	});
	return response.ok;
}

// Domain Sets API
export async function listDomainSets(): Promise<DomainSet[]> {
	const response = await adminFetch('/api/admin/domain-sets');
	const data = await response.json();
	return data.sets || [];
}

export async function createDomainSet(name: string, source: string): Promise<NewDomainSet> {
	const response = await adminFetch('/api/admin/domain-sets', {
		method: 'POST',
		body: JSON.stringify({ name, source })
	});
	return response.json();
}

export async function deleteDomainSet(id: string): Promise<void> {
	await adminFetch(`/api/admin/domain-sets/${id}`, {
		method: 'DELETE'
	});
}

export async function addDomainsToSet(
	setId: string,
	domains: string[]
): Promise<{ inserted: number; duplicates: number }> {
	const response = await adminFetch(`/api/admin/domain-sets/${setId}/domains`, {
		method: 'POST',
		body: JSON.stringify({ domains })
	});
	return response.json();
}
