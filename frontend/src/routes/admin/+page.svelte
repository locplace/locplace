<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getApiKey,
		setApiKey,
		clearApiKey,
		verifyApiKey,
		listScanners,
		createScanner,
		deleteScanner,
		addDomains,
		ApiError,
		type Scanner,
		type NewScanner
	} from '$lib/api';

	let authenticated = $state(false);
	let apiKeyInput = $state('');
	let authError = $state('');

	let scanners = $state<Scanner[]>([]);
	let scannersLoading = $state(false);
	let scannersError = $state('');

	let newScannerName = $state('');
	let newScannerResult = $state<NewScanner | null>(null);
	let createError = $state('');

	let domainsInput = $state('');
	let domainsResult = $state<{ added: number } | null>(null);
	let domainsError = $state('');

	onMount(() => {
		if (getApiKey()) {
			authenticated = true;
			loadScanners();
		}
	});

	async function login() {
		authError = '';
		if (!apiKeyInput.trim()) {
			authError = 'API key is required';
			return;
		}

		const valid = await verifyApiKey(apiKeyInput.trim());
		if (valid) {
			setApiKey(apiKeyInput.trim());
			authenticated = true;
			apiKeyInput = '';
			loadScanners();
		} else {
			authError = 'Invalid API key';
		}
	}

	function logout() {
		clearApiKey();
		authenticated = false;
		scanners = [];
	}

	async function loadScanners() {
		scannersLoading = true;
		scannersError = '';
		try {
			scanners = await listScanners();
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) {
				authenticated = false;
			} else {
				scannersError = e instanceof Error ? e.message : 'Failed to load scanners';
			}
		} finally {
			scannersLoading = false;
		}
	}

	async function handleCreateScanner() {
		createError = '';
		newScannerResult = null;
		if (!newScannerName.trim()) {
			createError = 'Name is required';
			return;
		}

		try {
			newScannerResult = await createScanner(newScannerName.trim());
			newScannerName = '';
			loadScanners();
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) {
				authenticated = false;
			} else {
				createError = e instanceof Error ? e.message : 'Failed to create scanner';
			}
		}
	}

	async function handleDeleteScanner(id: string, name: string) {
		if (!confirm(`Delete scanner "${name}"?`)) return;

		try {
			await deleteScanner(id);
			loadScanners();
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) {
				authenticated = false;
			} else {
				alert(e instanceof Error ? e.message : 'Failed to delete scanner');
			}
		}
	}

	async function handleAddDomains() {
		domainsError = '';
		domainsResult = null;

		const domains = domainsInput
			.split(/[\n,]+/)
			.map((d) => d.trim())
			.filter((d) => d.length > 0);

		if (domains.length === 0) {
			domainsError = 'Enter at least one domain';
			return;
		}

		try {
			domainsResult = await addDomains(domains);
			domainsInput = '';
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) {
				authenticated = false;
			} else {
				domainsError = e instanceof Error ? e.message : 'Failed to add domains';
			}
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const date = new Date(dateStr);
		return date.toLocaleString();
	}
</script>

<svelte:head>
	<title>Admin - LOC Place</title>
</svelte:head>

<div class="admin">
	{#if !authenticated}
		<div class="login-container">
			<h1>Admin Login</h1>
			<form onsubmit={(e) => { e.preventDefault(); login(); }}>
				<input
					type="password"
					bind:value={apiKeyInput}
					placeholder="Admin API Key"
					autocomplete="off"
				/>
				<button type="submit">Login</button>
			</form>
			{#if authError}
				<p class="error">{authError}</p>
			{/if}
		</div>
	{:else}
		<header>
			<h1>LOC Place Admin</h1>
			<button class="logout" onclick={logout}>Logout</button>
		</header>

		<section>
			<h2>Scanners</h2>

			{#if scannersLoading}
				<p>Loading...</p>
			{:else if scannersError}
				<p class="error">{scannersError}</p>
			{:else if scanners.length === 0}
				<p class="muted">No scanners registered</p>
			{:else}
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Status</th>
							<th>Last Heartbeat</th>
							<th>Created</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each scanners as scanner}
							<tr>
								<td>{scanner.name}</td>
								<td>
									<span class="status" class:active={scanner.is_active}>
										{scanner.is_active ? 'Active' : 'Inactive'}
									</span>
								</td>
								<td>{formatDate(scanner.last_heartbeat)}</td>
								<td>{formatDate(scanner.created_at)}</td>
								<td>
									<button
										class="delete"
										onclick={() => handleDeleteScanner(scanner.id, scanner.name)}
									>
										Delete
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<h3>Add Scanner</h3>
			<form class="inline-form" onsubmit={(e) => { e.preventDefault(); handleCreateScanner(); }}>
				<input
					type="text"
					bind:value={newScannerName}
					placeholder="Scanner name"
				/>
				<button type="submit">Create</button>
			</form>
			{#if createError}
				<p class="error">{createError}</p>
			{/if}
			{#if newScannerResult}
				<div class="token-result">
					<p><strong>Scanner created!</strong> Save this token - it won't be shown again:</p>
					<code>{newScannerResult.token}</code>
				</div>
			{/if}
		</section>

		<section>
			<h2>Add Domains</h2>
			<form onsubmit={(e) => { e.preventDefault(); handleAddDomains(); }}>
				<textarea
					bind:value={domainsInput}
					placeholder="Enter domains (one per line or comma-separated)"
					rows="5"
				></textarea>
				<button type="submit">Add Domains</button>
			</form>
			{#if domainsError}
				<p class="error">{domainsError}</p>
			{/if}
			{#if domainsResult}
				<p class="success">Added {domainsResult.added} domain(s)</p>
			{/if}
		</section>
	{/if}
</div>

<style>
	.admin {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.login-container {
		max-width: 300px;
		margin: 4rem auto;
		text-align: center;
	}

	.login-container input {
		width: 100%;
		padding: 0.75rem;
		margin-bottom: 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
	}

	.login-container button {
		width: 100%;
		padding: 0.75rem;
		background: #3131dc;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
	}

	.login-container button:hover {
		background: #2828b8;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #eee;
	}

	header h1 {
		margin: 0;
	}

	.logout {
		padding: 0.5rem 1rem;
		background: #666;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	section {
		margin-bottom: 3rem;
	}

	h2 {
		margin-bottom: 1rem;
		color: #333;
	}

	h3 {
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		font-size: 1rem;
		color: #666;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th, td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid #eee;
	}

	th {
		font-weight: 600;
		color: #666;
		font-size: 0.875rem;
	}

	.status {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		background: #fee;
		color: #c00;
	}

	.status.active {
		background: #efe;
		color: #080;
	}

	.inline-form {
		display: flex;
		gap: 0.5rem;
	}

	input[type="text"], input[type="password"] {
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
	}

	.inline-form input {
		flex: 1;
	}

	textarea {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
		font-family: inherit;
		resize: vertical;
	}

	button {
		padding: 0.5rem 1rem;
		background: #3131dc;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
	}

	button:hover {
		background: #2828b8;
	}

	button.delete {
		background: #c00;
		font-size: 0.875rem;
		padding: 0.25rem 0.5rem;
	}

	button.delete:hover {
		background: #a00;
	}

	.error {
		color: #c00;
		margin-top: 0.5rem;
	}

	.success {
		color: #080;
		margin-top: 0.5rem;
	}

	.muted {
		color: #999;
	}

	.token-result {
		margin-top: 1rem;
		padding: 1rem;
		background: #ffe;
		border: 1px solid #cc0;
		border-radius: 4px;
	}

	.token-result code {
		display: block;
		margin-top: 0.5rem;
		padding: 0.5rem;
		background: #fff;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-family: monospace;
		word-break: break-all;
	}
</style>
