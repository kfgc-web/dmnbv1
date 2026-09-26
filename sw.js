/* ============================================================
   DOMINATION: BRITANNIA — sw.js (service worker do app)
   Guarda os arquivos do jogo no aparelho para ele abrir sem
   internet. VERSAO tem de ser IGUAL ao ?v=N do index.html:
   quando ela muda, o navegador baixa a versão nova em segundo
   plano e a tela mostra "Nova versão disponível".
   ============================================================ */
const VERSAO = 20;
const CACHE = "britannia-v" + VERSAO;
const ARQUIVOS = [
  "./",
  "index.html",
  "estilo.css?v=" + VERSAO,
  "mapa.js?v=" + VERSAO,
  "motor.js?v=" + VERSAO,
  "bots.js?v=" + VERSAO,
  "desenho.js?v=" + VERSAO,
  "cartas.js?v=" + VERSAO,
  "rede.js?v=" + VERSAO,
  "online.js?v=" + VERSAO,
  "tutorial.js?v=" + VERSAO,
  "telas.js?v=" + VERSAO,
  "app.js?v=" + VERSAO,
  "manifest.webmanifest",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "icones/maskable-192.png",
  "icones/maskable-512.png",
  "icones/apple-touch-icon.png",
  "icones/favicon-32.png",
];

// Instala: baixa tudo da versão nova. NÃO assume sozinho — espera o
// jogador tocar em "atualizar" (mensagem "atualizar" abaixo).
self.addEventListener("install", function (ev) {
  ev.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(ARQUIVOS.map(function (u) { return new Request(u, { cache: "reload" }); }));
  }));
});

// Ativa: apaga as versões antigas guardadas.
self.addEventListener("activate", function (ev) {
  ev.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n.indexOf("britannia-") === 0 && n !== CACHE; })
      .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("message", function (ev) {
  if (ev.data === "atualizar") self.skipWaiting();
});

// Busca: primeiro o que está guardado; se não tiver, a internet.
// As fontes (Google Fonts) são guardadas na primeira vez que chegam.
self.addEventListener("fetch", function (ev) {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const fonte = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== self.location.origin && !fonte) return;
  ev.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(req, { ignoreSearch: req.mode === "navigate" }).then(function (achou) {
        if (achou) return achou;
        return fetch(req).then(function (resp) {
          if (fonte && resp && (resp.ok || resp.type === "opaque")) c.put(req, resp.clone());
          return resp;
        }).catch(function () {
          // sem internet: uma navegação cai na página do jogo guardada
          if (req.mode === "navigate") return c.match("index.html");
          return Response.error();
        });
      });
    })
  );
});
