// Minimal service worker — just enough for PWA install prompt
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
