// Tăng version để force update
var CACHE_NAME = 'chamcong-v2';  // 👈 Đổi v1 → v2

var urlsToCache = [
    '/cc/',
    '/cc/index.html',
    '/cc/app.js',
    '/cc/style.css'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(urlsToCache);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 👈 QUAN TRỌNG: Không cache data từ Firebase
self.addEventListener('fetch', function(event) {
    // Bỏ qua request đến Firebase, GitHub API
    if (event.request.url.includes('firebase') || 
        event.request.url.includes('googleapis') ||
        event.request.url.includes('githubusercontent')) {
        return; // Không cache
    }
    
    event.respondWith(
        caches.match(event.request).then(function(response) {
            return response || fetch(event.request);
        })
    );
});
