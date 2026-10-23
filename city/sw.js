// Service worker do nadacity (SPEC § 2, S8): guarda tudo o que o jogo baixa do próprio site e serve do cache quando
// não há rede. Páginas: rede primeiro (para a versão nova chegar). Arquivos do build (`assets/`, com hash no nome):
// cache primeiro. O resto (arte, ícones, manifesto): serve do cache e atualiza por trás.
// O cache tem o id do build (vem no endereço do registro, `sw.js?build=...`): cada build começa um cache limpo e a
// ativação apaga os anteriores, para os assets de builds velhos não se acumularem.
const CACHE = `nadacity-${new URL(self.location.href).searchParams.get('build') ?? 'dev'}`

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  const page = req.mode === 'navigate'
  const hashed = new URL(req.url).pathname.includes('/assets/')
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: page })
      if (hit && hashed) return hit
      if (hit && !page) {
        e.waitUntil(fetch(req).then((res) => res.ok && cache.put(req, res)).catch(() => {}))
        return hit
      }
      try {
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      } catch (err) {
        if (hit) return hit
        if (page) {
          const home = await cache.match('./')
          if (home) return home
        }
        throw err
      }
    }),
  )
})
