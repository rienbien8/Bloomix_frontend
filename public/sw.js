const CACHE_NAME = 'oshi-spo-navi-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Service Workerのインストール時
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('キャッシュを開きました');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('キャッシュの追加に失敗しました:', error);
      })
  );
});

// Service Workerのアクティベート時
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('古いキャッシュを削除します:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// フェッチイベントの処理
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュに存在する場合はキャッシュから返す
        if (response) {
          return response;
        }

        // ネットワークリクエストを実行
        return fetch(event.request)
          .then((response) => {
            // 成功したレスポンスのみキャッシュに保存
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // レスポンスをクローンしてキャッシュに保存
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // オフライン時のフォールバック
            if (event.request.destination === 'image') {
              return caches.match('/icons/icon-192x192.png');
            }
          });
      })
  );
});

// バックグラウンド同期（対応している場合）
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // バックグラウンドでデータを同期
      console.log('バックグラウンド同期を実行中...')
    );
  }
});

// プッシュ通知（対応している場合）
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : '新しい推しスポットが追加されました！',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '詳細を見る',
        icon: '/icons/compass.svg'
      },
      {
        action: 'close',
        title: '閉じる',
        icon: '/icons/close.svg'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Oshi Spo Navi', options)
  );
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
}); 