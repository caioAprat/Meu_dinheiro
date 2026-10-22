// Guarda a "casca" do painel para abrir sem internet. Os DADOS nunca passam por aqui.
const VERSAO = 'v4';
const CASCA = ['./', 'index.html', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;     // chamadas ao assistente: direto pela rede
  const guardar = r => { if (r && r.ok) { const c = r.clone(); caches.open(VERSAO).then(x => x.put(e.request, c)); } return r; };
  if (e.request.mode === 'navigate') {                                          // a página: rede primeiro (pega correções na hora)
    e.respondWith(fetch(e.request).then(guardar).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(g => g || fetch(e.request).then(guardar)));
});
