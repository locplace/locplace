<script>
	// MapLibre CSS must be imported first so app.css can override it
	import 'maplibre-gl/dist/maplibre-gl.css';
	import '../app.css';

	let { children } = $props();
</script>

{@render children()}
