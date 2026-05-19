const CACHE_NAME = 'aforoya-v1';
const SHELL_FILES = ['/', '/index.html', '/app.bundle.js', '/manifest.json'];
const SYNC_TAG = 'aforoya-sync';

// Offline queue stored in IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('aforoya-offline', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('queue', { autoIncrement: true });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = reject;
  });
}

async function enqueue(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add(item);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

async function dequeueAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    const items = [];
    const keys = [];
    store.openCursor().onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        items.push(cursor.value);
        keys.push(cursor.key);
        cursor.continue();
      } else {
        keys.forEach(k => store.delete(k));
        tx.oncomplete = () => resolve(items);
      }
    };
    tx.onerror = reject;
  });
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Firebase and CDN — stale while revalidate
  if (url.hostname.includes('firebase') || url.hostname.includes('gstatic') || url.hostname.includes('cdn')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          const fresh = fetch(e.request).then(res => {
            cache.put(e.request, res.clone());
            return res;
          });
          return cached || fresh;
        })
      )
    );
    return;
  }

  // Shell — cache first
  if (SHELL_FILES.includes(url.pathname) || url.pathname === '/admin.html') {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }

  // Default — network first with cache fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

self.addEventListener('sync', async e => {
  if (e.tag === SYNC_TAG) {
    e.waitUntil(processQueue());
  }
});

async function processQueue() {
  const items = await dequeueAll();
  for (const item of items) {
    try {
      await fetch(item.url, { method: item.method, body: item.body, headers: item.headers });
    } catch (_) {
      await enqueue(item);
    }
  }
}

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'ENQUEUE') {
    enqueue(e.data.payload);
  }
});
