<script lang="ts">
	import { onMount, mount } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import MapPopup from '$lib/components/MapPopup.svelte';

	let mapContainer: HTMLDivElement;
	let map: maplibregl.Map;

	// Info overlay state
	let isOverlayOpen = true;
	let isDarkTheme = false;

	function getStyleUrl(): string {
		const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		return `https://tiles.immich.cloud/v1/style/${isDark ? 'dark' : 'light'}.json`;
	}

	function toggleOverlay() {
		isOverlayOpen = !isOverlayOpen;
	}

	onMount(() => {
		// Set initial theme and overlay state
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		isDarkTheme = mediaQuery.matches;

		// Collapse by default on small screens (< 768px)
		isOverlayOpen = window.innerWidth >= 768;

		map = new maplibregl.Map({
			container: mapContainer,
			style: getStyleUrl(),
			center: [0, 30],
			zoom: 2
		});

		map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

		// Listen for theme changes
		const handleThemeChange = () => {
			isDarkTheme = mediaQuery.matches;
			map.setStyle(getStyleUrl());
			// Re-add LOC records after style change
			map.once('style.load', loadLOCRecords);
		};
		mediaQuery.addEventListener('change', handleThemeChange);

		map.on('load', async () => {
			await loadLOCRecords();
		});

		return () => {
			mediaQuery.removeEventListener('change', handleThemeChange);
			map?.remove();
		};
	});

	async function loadLOCRecords() {
		try {
			const response = await fetch('/api/public/records.geojson');
			if (!response.ok) throw new Error('Failed to fetch records');

			const geojson = await response.json();

			map.addSource('loc-records', {
				type: 'geojson',
				data: geojson
			});

			map.addLayer({
				id: 'points',
				type: 'circle',
				source: 'loc-records',
				paint: {
					'circle-radius': 8,
					'circle-color': '#e74c3c',
					'circle-stroke-width': 2,
					'circle-stroke-color': '#fff'
				}
			});

			// Click handler for points
			map.on('click', 'points', (e) => {
				if (!e.features?.length) return;

				const feature = e.features[0];
				const props = feature.properties;
				const coords = (feature.geometry as GeoJSON.Point).coordinates;

				// Parse arrays - they come as JSON strings from MapLibre
				const fqdns = typeof props?.fqdns === 'string' ? JSON.parse(props.fqdns) : props?.fqdns || [];
				const rootDomains = typeof props?.root_domains === 'string' ? JSON.parse(props.root_domains) : props?.root_domains || [];

				const container = document.createElement('div');
				mount(MapPopup, {
					target: container,
					props: {
						fqdns,
						rootDomains,
						latitude: coords[1],
						longitude: coords[0],
						altitudeM: props?.altitude_m || 0,
						rawRecord: props?.raw_record || ''
					}
				});

				new maplibregl.Popup()
					.setLngLat(coords as [number, number])
					.setDOMContent(container)
					.addTo(map);
			});

			// Change cursor on hover
			map.on('mouseenter', 'points', () => {
				map.getCanvas().style.cursor = 'pointer';
			});
			map.on('mouseleave', 'points', () => {
				map.getCanvas().style.cursor = '';
			});

			// Fit to data bounds if we have records
			if (geojson.features.length > 0) {
				const bounds = new maplibregl.LngLatBounds();
				for (const feature of geojson.features) {
					bounds.extend(feature.geometry.coordinates as [number, number]);
				}
				map.fitBounds(bounds, { padding: 50, maxZoom: 10 });
			}
		} catch (error) {
			console.error('Error loading LOC records:', error);
		}
	}
</script>

<div id="map" bind:this={mapContainer}></div>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="info-overlay" class:collapsed={!isOverlayOpen} class:dark={isDarkTheme}>
	<div class="header" onclick={toggleOverlay}>
		<span class="title">About LOC.place</span>
		<span class="toggle-icon">{isOverlayOpen ? '−' : '+'}</span>
	</div>
	<div class="content">
		<p>
			As one of the old, core pieces internet infrastructure, the DNS system has many obscure and forgotten corners.
			One of those is the <a href="https://en.wikipedia.org/wiki/LOC_record">LOC record</a>, which ties a domain name
			to a set of geographical coordinates.
			There are only a few thousand of these records in the entirety of DNS, making it feasible to map all of them.
		</p>
		<p>
			This effort would not have been possible without tb0hdan's <a href="https://github.com/tb0hdan/domains/">list of domains</a>,
			or without my colleagues taking it as a personal challenge to run as many scanners as they could.
		</p>
		<p>
			You can find the source code on <a href="https://github.com/locplace/locplace">github</a>. 
			If you have any questions, remarks, or you just want to say hi, don't hesitate to <a href="mailto:contact@loc.place">email me</a>.
		</p>
	</div>
</div>

<style>
	/* Prevent scroll on map page - it should fill viewport */
	:global(html), :global(body) {
		overflow: hidden;
	}

	.info-overlay {
		position: absolute;
		top: 10px;
		left: 10px;
		max-width: 320px;
		width: calc(100vw - 20px);
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(8px);
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		overflow: hidden;
		transition: max-width 0.2s ease;
	}

	.info-overlay.dark {
		background: rgba(30, 30, 30, 0.9);
		color: #e0e0e0;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 14px;
		cursor: pointer;
		user-select: none;
		font-weight: 600;
		font-size: 14px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
	}

	.info-overlay.dark .header {
		border-bottom-color: rgba(255, 255, 255, 0.1);
	}

	.info-overlay.collapsed .header {
		border-bottom: none;
	}

	.toggle-icon {
		font-size: 18px;
		line-height: 1;
		opacity: 0.6;
	}

	.content {
		padding: 12px 14px;
		font-size: 13px;
		line-height: 1.5;
		max-height: 500px;
		overflow-y: auto;
		transition: max-height 0.2s ease, padding 0.2s ease, opacity 0.2s ease;
	}

	.info-overlay.collapsed .content {
		max-height: 0;
		padding-top: 0;
		padding-bottom: 0;
		opacity: 0;
	}

	.content p {
		margin: 0 0 10px 0;
	}

	.content p:last-child {
		margin-bottom: 0;
	}

	.content a {
		color: #2563eb;
		text-decoration: none;
	}

	.content a:hover {
		text-decoration: underline;
	}

	.info-overlay.dark .content a {
		color: #60a5fa;
	}

	@media (max-width: 400px) {
		.info-overlay {
			max-width: calc(100vw - 20px);
		}
	}
</style>
