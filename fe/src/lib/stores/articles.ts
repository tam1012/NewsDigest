import { writable } from 'svelte/store';

export const filters = writable({ tag: '', minHot: 0, sourceId: '', sort: 'date' });
