/* ============================================================
   DOMINATION: BRITANNIA — app.js (o jogo como app no celular)
   Carregar por ÚLTIMO (depois de telas.js). Cuida de:
     - registrar o service worker (sw.js): o jogo abre sem internet;
     - avisar "Nova versão disponível" quando o sw.js baixar uma
       versão nova (e atualizar quando o jogador tocar no aviso);
     - botão "Instalar" (Android/computador, quando o navegador deixa);
     - travar a tela deitada no app instalado (o Android respeita;
       o iPhone não deixa, lá vale só o aviso "Gire o celular").
   ============================================================ */
(function () {
  "use strict";

  // ---------- aviso de versão nova ----------
  const banner = document.getElementById("atualizaBanner");
  let esperando = null; // service worker da versão nova, pronto e esperando
  let pediuAtualizar = false; // só recarrega a página quando o jogador pediu

  function mostrarAviso(sw) {
    esperando = sw;
    const emJogo = typeof window.partidaEmAndamento === "function" && window.partidaEmAndamento();
    banner.innerHTML = "<b>Nova versão disponível</b> — toque para atualizar" +
      (emJogo ? '<span class="atualizaNota">A partida em andamento recomeça.</span>' : "");
    banner.hidden = false;
  }
  banner.addEventListener("click", function () {
    if (!esperando) return;
    banner.innerHTML = "<b>Atualizando…</b>";
    pediuAtualizar = true;
    esperando.postMessage("atualizar");
  });

  if ("serviceWorker" in navigator) {
    let recarregou = false;
    // (na primeira visita o service worker também assume a página — aí não recarrega)
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (recarregou || !pediuAtualizar) return;
      recarregou = true;
      location.reload();
    });
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      // versão nova já baixada numa visita anterior e ainda esperando
      if (reg.waiting && navigator.serviceWorker.controller) mostrarAviso(reg.waiting);
      reg.addEventListener("updatefound", function () {
        const novo = reg.installing;
        if (!novo) return;
        novo.addEventListener("statechange", function () {
          // só é "atualização" se já havia uma versão controlando a página
          if (novo.state === "installed" && navigator.serviceWorker.controller) mostrarAviso(novo);
        });
      });
      // procura versão nova ao abrir e sempre que o app volta para a tela
      const procurar = function () { reg.update().catch(function () { /* sem internet: tudo bem */ }); };
      procurar();
      document.addEventListener("visibilitychange", function () { if (!document.hidden) procurar(); });
    }).catch(function () { /* sem service worker (ex.: arquivo aberto direto): o jogo funciona igual */ });
  }

  // ---------- botão "Instalar" ----------
  const instalar = document.getElementById("instalarBtn");
  let pedido = null;
  window.addEventListener("beforeinstallprompt", function (ev) {
    ev.preventDefault();
    pedido = ev;
    instalar.hidden = false;
  });
  instalar.addEventListener("click", function () {
    if (!pedido) return;
    pedido.prompt();
    pedido.userChoice.finally(function () { pedido = null; instalar.hidden = true; });
  });
  window.addEventListener("appinstalled", function () { instalar.hidden = true; });

  // ---------- tela deitada no app instalado ----------
  const instalado = window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (instalado && screen.orientation && screen.orientation.lock) {
    const travar = function () { screen.orientation.lock("landscape").catch(function () { /* iPhone e afins: não trava */ }); };
    travar();
    document.addEventListener("pointerdown", travar, { once: true });
  }
})();
