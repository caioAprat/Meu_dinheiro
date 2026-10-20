// Guarda a "casca" do painel para abrir instantaneamente e sem internet. Os DADOS nunca passam por aqui.
const VERSAO = 'v2';
const CASCA = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;     // chamadas ao assistente: direto pela rede
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(guardado => {
      const rede = fetch(e.request).then(r => {
        if (r && r.ok) caches.open(VERSAO).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => guardado);
      return guardado || rede;                                                    // abre na hora e atualiza por trás
    })
  );
});
