import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	server: {
		allowedHosts: ['resolved-bytes-prerequisite-editor.trycloudflare.com']
	},
	plugins: [
		tailwindcss(), 
		sveltekit(),
	],
});
