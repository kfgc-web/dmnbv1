const VERSAO = 25;

const CACHE = "britannia-v" + VERSAO;

const ARQUIVOS = [ "./", "index.html", "baixar.html", "estilo.css?v=" + VERSAO, "mapa.js?v=" + VERSAO, "motor.js?v=" + VERSAO, "bots.js?v=" + VERSAO, "desenho.js?v=" + VERSAO, "cartas.js?v=" + VERSAO, "rede.js?v=" + VERSAO, "online.js?v=" + VERSAO, "tutorial.js?v=" + VERSAO, "telas.js?v=" + VERSAO, "app.js?v=" + VERSAO, "manifest.webmanifest", "icones/icone-192.png", "icones/icone-512.png", "icones/maskable-192.png", "icones/maskable-512.png", "icones/apple-touch-icon.png", "icones/favicon-32.png", "fontes/cinzel-500.woff2", "fontes/cinzel-700.woff2" ];

self.addEventListener("install", function(ev) {
    ev.waitUntil(caches.open(CACHE).then(function(c) {
        return c.addAll(ARQUIVOS.map(function(u) {
            return new Request(u, {
                cache: "reload"
            });
        }));
    }));
});

self.addEventListener("activate", function(ev) {
    ev.waitUntil(caches.keys().then(function(nomes) {
        return Promise.all(nomes.filter(function(n) {
            return n.indexOf("britannia-") === 0 && n !== CACHE;
        }).map(function(n) {
            return caches.delete(n);
        }));
    }).then(function() {
        return self.clients.claim();
    }));
});

self.addEventListener("message", function(ev) {
    if (ev.data === "atualizar") self.skipWaiting();
});

self.addEventListener("fetch", function(ev) {
    const req = ev.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    ev.respondWith(caches.open(CACHE).then(function(c) {
        return c.match(req, {
            ignoreSearch: req.mode === "navigate"
        }).then(function(achou) {
            if (achou) return achou;
            return fetch(req).catch(function() {
                if (req.mode === "navigate") return c.match("index.html");
                return Response.error();
            });
        });
    }));
});
