import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		paths: {
			base: ''
		},
		prerender: {
			handleHttpError: ({ path, message }) => {
				// Ignore 404s for API routes - they don't exist at build time
				if (path.startsWith('/api/')) {
					return;
				}
				throw new Error(message);
			}
		}
	}
};

export default config;
