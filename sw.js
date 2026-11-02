// Tăng số này lên mỗi khi bạn sửa code (v1 -> v2 -> v3...)
var CACHE_NAME = 'chamcong-v6'; 

var urlsToCache = [
    '/cc/',
    '/cc/index.html',
    '/cc/app.js',
    '/cc/style.css'
];

self.addEventListener('install', function(event) {
    self.skipWaiting(); // Bắt buộc kích hoạt bản mới ngay
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName); // Xóa cache cũ
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 👉 CƠ CHẾ MỚI: Ưu tiên lấy từ mạng, nếu lỗi mới lấy từ cache
self.addEventListener('fetch', function(event) {
    // Bỏ qua các request đến Firebase
    if (event.request.url.includes('firebase') || event.request.url.includes('googleapis')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(function(response) {
                // Nếu tải từ mạng thành công, cập nhật lại vào cache
                var responseClone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(function() {
                // Nếu mất mạng, lấy bản lưu trong cache ra dùng
                return caches.match(event.request);
            })
    );
});
