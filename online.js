/* ============================================================
   DOMINATION: BRITANNIA — online.js (jogar com amigos)
   Carregar depois de rede.js e ANTES de telas.js (a tela chama
   window.ONLINE; aqui só chamamos window.TELAS quando já existe).

   Como funciona:
   - SALA: quem cria escolhe o modo e cada lugar (pessoa, bot, vazio);
     cada pessoa escolhe a cor (no Grande Exército, o reino = o lugar).
     No Equipes, quem criou monta as equipes (ou sorteia).
   - PARTIDA: a nuvem guarda a semente + a lista de jogadas. Cada
     aparelho refaz a partida com o motor (aplicarAcao), então todos
     chegam ao mesmo lugar e ninguém inventa dado nem jogada proibida.
     A minha jogada vale na hora aqui e vai para a fila de envio; se
     alguém gravou antes (ex.: o bot assumiu), refaço a partida da lista.
   - BOTS: o "juiz" (a pessoa conectada de menor número na mesa) grava a
     jogada do bot; todos calculam o turno do bot igual.
   - QUEM CAIU: na vez de quem está desconectado, o juiz espera 10 s e o
     bot joga aquele turno. Voltou? Joga normalmente o próximo.
   - QUEM ESTÁ PARADO (conectado): depois de 60 s sem nenhum toque na vez
     dele, quem criou a sala vê o botão "Bot joga por ele" (só aquele turno).
   - REVANCHE: no fim, quem criou a sala (se estiver fora, o juiz) toca em
     "Jogar de novo": nasce uma sala nova com o mesmo modo e os mesmos
     lugares, e a jogada { t: "revanche", sala } leva todos para ela (cada
     um volta ao seu lugar, com a sua cor). Quem não estiver lá fica com o
     lugar aberto, esperando; o convite antigo também leva para a nova.
   ============================================================ */
(function () {
  "use strict";

  const ESP = window.__ESPERAS || {}; // (só o teste encurta as esperas)
  const DELAY_BOT = 750;          // pausa antes de cada turno de bot (ms)
  const ESPERA_CAIU = ESP.caiu || 10000;     // desconectado: o bot assume depois disto
  const ESPERA_PARADO = ESP.parado || 60000; // parado: aparece o botão para quem criou a sala
  const INTERVALO_SINAL = 5000;   // de quanto em quanto tempo o "estou aqui" vai para a nuvem
  const CHAVE_SALA = "britannia.sala", CHAVE_NOME = "britannia.nome", CHAVE_COR = "britannia.cor";
  const CHAVE_SAIU = "britannia.saiu"; // saiu da partida de propósito: não volta sozinho ao abrir
  const NOMES_COR_SALA = ["Vermelho", "Azul", "Verde", "Âmbar", "Roxo", "Turquesa"];

  // estado da sessão online
  let S = novoS();
  function novoS() {
    return {
      fase: null,            // null | "lobby" | "jogo"
      codigo: null, meta: null, assentos: null, lugar: null,
      config: null, meuId: -1, log: [], fila: [], enviando: false, geracao: 0,
      marco: 0, vistoN: -1, pedidoEm: null, caiuEm: {}, sinalVisto: {}, onlineAntes: {},
      ultimoSinal: 0, parado: null, timer: null, avisouSinc: false, revancheHtml: null, chamando: false,
    };
  }

  function guardar(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } }
  function lerGuardado(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // Nome: até 16 letras, sem símbolos que atrapalham a tela.
  function limparNome(s) { return String(s || "").replace(/[<>&"'\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 16); }
  function idAleatorio() { return Math.random().toString(36).slice(2, 10); }
  function T() { return window.TELAS; }
  function overlay() { return document.getElementById("overlay"); }
  function toast(m) { if (T()) T().toast(m); }

  function embaralharLocal(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }

  /* ---------------- tela de entrada ---------------- */
  function abrirEntrada(opcoes) {
    opcoes = opcoes || {};
    const ov = overlay();
    const nome = lerGuardado(CHAVE_NOME) || "";
    ov.innerHTML =
      '<div class="modal modalOnline">' +
        "<h2>Jogar online</h2>" +
        '<p class="lead">' + (opcoes.codigo
          ? "Você foi convidado para a sala <b>" + esc(opcoes.codigo) + "</b>. Digite seu nome e toque em Entrar."
          : "Cada um joga no seu aparelho. Crie uma sala e mande o convite, ou entre com o código que recebeu.") + "</p>" +
        '<label class="flabel" for="onNome">Seu nome</label>' +
        '<input id="onNome" class="onCampo" maxlength="16" autocomplete="nickname" value="' + esc(nome) + '" placeholder="Como te chamam">' +
        '<div class="onBotoes">' +
          (opcoes.codigo ? "" : '<button class="primary" id="onCriar">Criar sala</button><span class="onOu">ou</span>') +
          '<div class="onEntrar"><input id="onCodigo" class="onCampo onCodigo" maxlength="5" autocapitalize="characters" placeholder="CÓDIGO" value="' + esc(opcoes.codigo || "") + '">' +
          '<button class="' + (opcoes.codigo ? "primary" : "") + '" id="onEntrarBtn">Entrar</button></div>' +
        "</div>" +
        '<p class="onErro" id="onErro">' + esc(opcoes.erro || "") + "</p>" +
        '<button class="ghost" id="onVoltar">Voltar</button>' +
      "</div>";
    ov.classList.add("on");
    const campoNome = ov.querySelector("#onNome"), campoCod = ov.querySelector("#onCodigo");
    const erro = function (m) { ov.querySelector("#onErro").textContent = m || ""; };
    const pegarNome = function () {
      const n = limparNome(campoNome.value);
      if (!n) { erro("Digite seu nome primeiro."); campoNome.focus(); return null; }
      guardar(CHAVE_NOME, n);
      return n;
    };
    const ocupado = function (sim) { ov.querySelectorAll("button, input").forEach(function (b) { b.disabled = sim; }); };
    const criar = ov.querySelector("#onCriar");
    if (criar) criar.addEventListener("click", function () {
      const n = pegarNome(); if (!n) return;
      ocupado(true); erro("Criando a sala…");
      const cor = Number(lerGuardado(CHAVE_COR)) || 0;
      REDE.criarSala(n, cor).then(function (codigo) { return entrar(codigo); })
        .catch(function (e) { ocupado(false); erro(mensagem(e)); });
    });
    campoCod.addEventListener("input", function () { campoCod.value = campoCod.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
    ov.querySelector("#onEntrarBtn").addEventListener("click", function () {
      const n = pegarNome(); if (!n) return;
      const c = campoCod.value.trim().toUpperCase();
      if (c.length !== 5) { erro("O código da sala tem 5 letras."); campoCod.focus(); return; }
      ocupado(true); erro("Entrando…");
      entrar(c).catch(function (e) { ocupado(false); erro(mensagem(e)); });
    });
    ov.querySelector("#onVoltar").addEventListener("click", function () { T().mostrarInicio(); });
    if (!nome) campoNome.focus();
  }

  function mensagem(e) {
    const m = (e && e.message) || String(e);
    if (/permission|PERMISSION/.test(m)) return "A nuvem recusou (as regras do banco estão publicadas?).";
    return m;
  }

  // Entra (ou volta) numa sala e passa a acompanhar o que acontece nela.
  // lugar: o lugar preferido (na revanche, o mesmo da partida anterior).
  async function entrar(codigo, lugar, corAntes) {
    const nome = lerGuardado(CHAVE_NOME) || "Jogador";
    const cor = Number.isInteger(corAntes) ? corAntes : Number(lerGuardado(CHAVE_COR)) || 0;
    const r = await REDE.entrarSala(codigo, nome, cor, lugar);
    desligar();
    S.codigo = codigo;
    S.fase = r.jogando ? "entrando" : "lobby";
    S.lugar = r.lugar;
    guardar(CHAVE_SALA, codigo);
    guardar(CHAVE_SAIU, null);
    REDE.marcarPresenca(codigo, r.lugar);
    REDE.escutarMeta(codigo, aoMudarMeta);
    REDE.escutarAssentos(codigo, aoMudarAssentos);
  }

  function aoMudarMeta(m) {
    if (!S.codigo) return;
    if (!m) { // a sala sumiu (quem criou saiu sozinho, ou a faxina apagou)
      const estava = S.fase;
      desligar(); guardar(CHAVE_SALA, null);
      if (estava === "lobby" || estava === "entrando") abrirEntrada({ erro: "A sala foi encerrada." });
      return;
    }
    S.meta = m;
    if (m.status === "jogando" && S.fase !== "jogo") comecarJogo();
    else if (S.fase === "lobby") renderSala();
  }

  function aoMudarAssentos(lista) {
    if (!S.codigo) return;
    S.assentos = lista;
    const agora = Date.now();
    if (S.fase === "lobby") {
      const meu = lista.findIndex(function (a) { return a.uid === REDE.uid; });
      if (meu < 0) { // tiraram você da sala
        desligar(); guardar(CHAVE_SALA, null);
        abrirEntrada({ erro: "Você não está mais na sala." });
        return;
      }
      if (meu !== S.lugar) { S.lugar = meu; REDE.marcarPresenca(S.codigo, meu); }
      renderSala();
    } else if (S.fase === "jogo" && S.config) {
      S.config.jogadores.forEach(function (j, id) {
        if (j.tipo !== "humano") return;
        const on = estaOnline(id);
        if (!on && S.onlineAntes[id] !== false) S.caiuEm[id] = agora;
        S.onlineAntes[id] = on;
      });
      if (T()) T().render();
    }
  }

  /* ---------------- sala (antes da partida) ---------------- */
  function souHost() { return S.meta && S.meta.host === REDE.uid; }
  function ehGrande() { return S.meta && S.meta.modo === "grande"; }
  function lugaresVisiveis() { return ehGrande() ? REDE.LUGARES : 6; }

  // Quem joga: no Grande Exército os 9 lugares; nos outros, os 6 primeiros que não estão vazios.
  function participantes() {
    const out = [];
    S.assentos.forEach(function (a, i) {
      if (i >= lugaresVisiveis()) return;
      if (ehGrande() || a.tipo !== "vazio") out.push(i);
    });
    return out;
  }

  // Cor de cada lugar: pessoas usam a escolhida; bots e lugares abertos pegam as que sobraram.
  function coresDosLugares() {
    const cores = [];
    if (ehGrande()) { S.assentos.forEach(function (a, i) { cores[i] = COR_REINO[REINOS_GRANDE[i]]; }); return cores; }
    const usadas = [];
    S.assentos.forEach(function (a, i) { if (a.tipo === "humano" && i < 6) { cores[i] = CORES[a.cor] || CORES[0]; usadas.push(a.cor); } });
    const livres = [0, 1, 2, 3, 4, 5].filter(function (c) { return usadas.indexOf(c) === -1; });
    participantes().forEach(function (i) { if (cores[i] == null) cores[i] = CORES[livres.shift()]; });
    return cores;
  }

  function tamanhoEquipe() { const n = participantes().length; return n === 6 && S.meta.tamEquipe === 3 ? 3 : 2; }

  // Equipe de cada lugar: a escolhida por quem criou a sala; quem não tem
  // (ou tem uma que não existe neste formato) vai para a equipe com menos gente.
  function equipesEfetivas() {
    const parts = participantes(), nEq = participantes().length / tamanhoEquipe();
    const eq = {}, conta = [];
    for (let e = 0; e < nEq; e++) conta.push(0);
    parts.forEach(function (i) {
      const e = S.assentos[i].equipe;
      if (Number.isInteger(e) && e >= 0 && e < nEq) { eq[i] = e; conta[e]++; }
    });
    parts.forEach(function (i) {
      if (eq[i] != null) return;
      let menor = 0;
      for (let e = 1; e < nEq; e++) if (conta[e] < conta[menor]) menor = e;
      eq[i] = menor; conta[menor]++;
    });
    return { eq: eq, conta: conta, nEq: nEq };
  }

  // O que impede de começar (ou null se pode).
  function problemaParaComecar() {
    const n = participantes().length;
    const humanos = S.assentos.filter(function (a) { return a.tipo === "humano"; }).length;
    if (!ehGrande() && humanos > 6) return "Com mais de 6 pessoas, só dá para jogar o Grande Exército.";
    if (n < 2) return "Precisa de pelo menos 2 jogadores (pessoas ou bots).";
    if (!modoDisponivel(S.meta.modo, n)) {
      if (S.meta.modo === "equipes") return "Equipes precisa de 4 ou 6 jogadores (agora são " + n + ").";
      return "Esse modo é para 2 a 6 jogadores.";
    }
    if (S.meta.modo === "equipes") {
      const ef = equipesEfetivas(), tam = tamanhoEquipe();
      if (ef.conta.some(function (c) { return c !== tam; }))
        return "As equipes precisam ter " + tam + " jogadores cada. Toque nas letras para montar, ou em Sortear.";
    }
    return null;
  }

  function renderSala() {
    if (!S.meta || !S.assentos) return; // ainda chegando da nuvem
    const ov = overlay();
    const antigo = ov.querySelector(".modalSala");
    const rolagem = antigo ? antigo.scrollTop : 0;
    const host = souHost(), grande = ehGrande(), modo = S.meta.modo;
    const cores = coresDosLugares();
    const n = participantes().length;
    const humanos = S.assentos.filter(function (a) { return a.tipo === "humano"; }).length;
    const equipes = modo === "equipes" && modoDisponivel("equipes", n);
    const ef = equipes ? equipesEfetivas() : null;
    const hostNome = (S.assentos.filter(function (a) { return a.uid === S.meta.host; })[0] || {}).nome || "quem criou a sala";

    let html = '<div class="modal modalSala">' +
      '<div class="salaTopo"><div><div class="flabel">Sala</div><div class="salaCodigo">' + esc(S.codigo) + "</div></div>" +
      '<div class="salaConvite"><button class="primary" id="salaCopiar">Copiar convite</button>' +
      (navigator.share ? '<button class="ghost" id="salaCompartilhar">Compartilhar</button>' : "") + "</div></div>" +
      '<p class="lead">Mande o convite para os amigos: o link já entra direto nesta sala.</p>';

    // modo
    html += '<div class="flabel" style="margin-bottom:8px">Modo de jogo</div>';
    if (host) {
      html += '<div class="modos">' + Object.keys(MODOS).filter(function (m) { return m !== "tutorial"; }).map(function (m) { // o Tutorial é só sozinho
        const pode = m === "grande" || humanos <= 6;
        return '<button class="modoOpcao' + (m === modo ? " sel" : "") + '" data-modo="' + m + '"' + (pode ? "" : " disabled") +
          ' aria-pressed="' + (m === modo) + '"><b>' + MODOS[m].nome + "</b><span>" + MODOS[m].resumo + "</span></button>";
      }).join("") + "</div>";
    } else {
      html += '<p class="salaModo"><b>' + MODOS[modo].nome + "</b> — " + MODOS[modo].resumo + "</p>";
    }
    if (modo === "equipes" && n === 6) {
      html += '<div class="formatos">' + [[3, "3 × 3"], [2, "2 × 2 × 2"]].map(function (f) {
        return '<button class="formatoOpcao' + (f[0] === tamanhoEquipe() ? " sel" : "") + '" data-tam="' + f[0] + '"' + (host ? "" : " disabled") + ">" + f[1] + "</button>";
      }).join("") + "</div>";
    }

    // lugares
    html += '<div class="flabel salaLugaresTit">' + (grande ? "Reinos (toque em Sentar aqui para escolher o seu)" : "Jogadores") +
      (equipes && host ? ' <button class="ghost mini" id="salaSortear">Sortear equipes</button>' : "") + "</div>";
    html += '<div class="salaLugares">';
    for (let i = 0; i < lugaresVisiveis(); i++) {
      const a = S.assentos[i];
      const eu = a.uid === REDE.uid;
      const tipo = grande && a.tipo === "vazio" ? "bot" : a.tipo;
      let nome = tipo === "humano" ? esc(a.nome) + (eu ? " (você)" : "") + (a.uid === S.meta.host ? ' <span class="salaChefe">criou a sala</span>' : "")
        : tipo === "aberto" ? '<i>Lugar aberto — esperando alguém</i>'
        : tipo === "bot" ? "Bot" : '<i>Vazio</i>';
      if (grande) nome = '<b class="salaReino">' + REINOS_GRANDE[i] + "</b> " + nome;
      html += '<div class="salaLugar' + (eu ? " eu" : "") + (tipo === "vazio" ? " vazio" : "") + '">' +
        '<span class="dot" style="background:' + (cores[i] || "transparent") + (cores[i] ? "" : ";box-shadow:none;border:1px dashed var(--line)") + '"></span>';
      if (equipes && tipo !== "vazio") {
        const e = ef.eq[i];
        html += host ? '<button class="eqTag salaEq" data-i="' + i + '" title="Trocar de equipe">' + NOMES_EQUIPE[e] + "</button>"
          : '<span class="eqTag">' + NOMES_EQUIPE[e] + "</span>";
      }
      html += '<span class="salaNome">' + nome + "</span>";
      if (tipo === "humano" && !a.online) html += '<span class="salaOff">desconectado</span>';
      if (host && tipo !== "humano") html += '<button class="ghost mini salaTipo" data-i="' + i + '">' + (tipo === "aberto" ? "Pôr bot" : tipo === "bot" ? (grande ? "Abrir" : "Esvaziar") : "Abrir") + "</button>";
      if (host && tipo === "humano" && !eu) html += '<button class="ghost mini salaTirar" data-i="' + i + '">Tirar</button>';
      if (tipo !== "humano") html += '<button class="mini salaSentar" data-i="' + i + '">Sentar aqui</button>';
      html += "</div>";
    }
    html += "</div>";

    // cor (fora do Grande Exército, onde a cor é a do reino)
    if (!grande) {
      const minha = S.assentos[S.lugar];
      const usadas = S.assentos.filter(function (a, i) { return a.tipo === "humano" && i !== S.lugar && i < 6; }).map(function (a) { return a.cor; });
      html += '<div class="flabel" style="margin:14px 0 8px">Sua cor</div><div class="salaCores">' +
        [0, 1, 2, 3, 4, 5].map(function (c) {
          const tomada = usadas.indexOf(c) !== -1;
          return '<button class="salaCor' + (minha && minha.cor === c ? " sel" : "") + '" data-cor="' + c + '"' + (tomada ? " disabled" : "") +
            ' title="' + NOMES_COR_SALA[c] + (tomada ? " (já escolhida)" : "") + '" style="background:' + CORES[c] + '"></button>';
        }).join("") + "</div>";
    }

    const prob = problemaParaComecar();
    html += '<p class="salaAviso">' + (prob ? esc(prob) : host ? "Tudo pronto. Lugares abertos viram bot quando a partida começar." : "Esperando " + esc(hostNome) + " começar a partida…") + "</p>";
    html += '<div class="salaAcoes">' + (host ? '<button class="primary" id="salaComecar"' + (prob ? " disabled" : "") + ">Começar partida</button>" : "") +
      '<button class="ghost" id="salaSair">Sair da sala</button></div></div>';
    ov.innerHTML = html;
    ov.classList.add("on");
    const modal = ov.querySelector(".modalSala");
    modal.scrollTop = rolagem;

    ov.querySelector("#salaCopiar").addEventListener("click", copiarConvite);
    const comp = ov.querySelector("#salaCompartilhar");
    if (comp) comp.addEventListener("click", function () {
      navigator.share({ title: "Domination: Britannia", text: "Bora jogar Domination: Britannia? Sala " + S.codigo, url: REDE.linkConvite(S.codigo) }).catch(function () {});
    });
    ov.querySelectorAll(".modoOpcao").forEach(function (b) { b.addEventListener("click", function () { trocarModo(b.dataset.modo); }); });
    ov.querySelectorAll(".formatoOpcao").forEach(function (b) { b.addEventListener("click", function () { REDE.gravarMeta(S.codigo, { tamEquipe: Number(b.dataset.tam) }); }); });
    ov.querySelectorAll(".salaTipo").forEach(function (b) { b.addEventListener("click", function () { trocarTipo(Number(b.dataset.i)); }); });
    ov.querySelectorAll(".salaTirar").forEach(function (b) { b.addEventListener("click", function () { tirar(Number(b.dataset.i)); }); });
    ov.querySelectorAll(".salaSentar").forEach(function (b) { b.addEventListener("click", function () { sentar(Number(b.dataset.i)); }); });
    ov.querySelectorAll(".salaEq").forEach(function (b) { b.addEventListener("click", function () { trocarEquipe(Number(b.dataset.i)); }); });
    ov.querySelectorAll(".salaCor").forEach(function (b) {
      b.addEventListener("click", function () {
        const c = Number(b.dataset.cor);
        guardar(CHAVE_COR, c);
        REDE.mexerAssentos(S.codigo, function (lista) {
          const tomada = lista.some(function (a, i) { return a.tipo === "humano" && a.uid !== REDE.uid && a.cor === c && i < 6; });
          const meu = lista.findIndex(function (a) { return a.uid === REDE.uid; });
          if (tomada || meu < 0) return;
          lista[meu].cor = c;
          return lista;
        }).catch(falhou);
      });
    });
    const sortear = ov.querySelector("#salaSortear");
    if (sortear) sortear.addEventListener("click", sortearEquipes);
    const comecar = ov.querySelector("#salaComecar");
    if (comecar) comecar.addEventListener("click", comecarPartida);
    ov.querySelector("#salaSair").addEventListener("click", function () {
      const cod = S.codigo;
      desligar(); guardar(CHAVE_SALA, null);
      REDE.sairDoLobby(cod).catch(function () {});
      T().mostrarInicio();
    });
  }

  function falhou(e) { toast(mensagem(e)); }

  function copiarConvite() {
    const link = REDE.linkConvite(S.codigo);
    const ok = function () { toast("Convite copiado! Cole no WhatsApp para os amigos."); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(ok, function () { window.prompt("Copie o convite:", link); });
    else window.prompt("Copie o convite:", link);
  }

  function trocarModo(modo) {
    if (!souHost() || modo === S.meta.modo) return;
    // saindo do Grande Exército: quem estava nos lugares 7 a 9 vem para os 6 primeiros
    const precisa = modo !== "grande" && S.assentos.some(function (a, i) { return i >= 6 && a.tipo === "humano"; });
    const antes = precisa ? REDE.mexerAssentos(S.codigo, function (lista) {
      for (let i = 6; i < lista.length; i++) {
        if (lista[i].tipo !== "humano") continue;
        const j = lista.findIndex(function (a, k) { return k < 6 && a.tipo !== "humano"; });
        if (j < 0) return; // não cabe: desiste
        const x = lista[j]; lista[j] = lista[i]; lista[i] = x;
      }
      return lista;
    }) : Promise.resolve();
    antes.then(function () { return REDE.gravarMeta(S.codigo, { modo: modo }); }).catch(falhou);
  }

  function trocarTipo(i) {
    const grande = ehGrande();
    REDE.mexerAssentos(S.codigo, function (lista) {
      const a = lista[i];
      if (a.tipo === "humano") return;
      const tipo = grande && a.tipo === "vazio" ? "bot" : a.tipo;
      const prox = tipo === "aberto" ? "bot" : tipo === "bot" ? (grande ? "aberto" : "vazio") : "aberto";
      lista[i] = { tipo: prox };
      if (Number.isInteger(a.equipe)) lista[i].equipe = a.equipe;
      return lista;
    }).catch(falhou);
  }

  function tirar(i) {
    REDE.mexerAssentos(S.codigo, function (lista) {
      if (lista[i].tipo !== "humano" || lista[i].uid === REDE.uid) return;
      lista[i] = { tipo: "aberto" };
      return lista;
    }).catch(falhou);
  }

  // Troca de lugar com o que estiver lá (bot, aberto ou vazio).
  function sentar(i) {
    REDE.mexerAssentos(S.codigo, function (lista) {
      const meu = lista.findIndex(function (a) { return a.uid === REDE.uid; });
      if (meu < 0 || meu === i || lista[i].tipo === "humano") return;
      const x = lista[i]; lista[i] = lista[meu]; lista[meu] = x;
      return lista;
    }).catch(falhou);
  }

  function trocarEquipe(i) {
    const ef = equipesEfetivas();
    const nova = (ef.eq[i] + 1) % ef.nEq;
    REDE.gravarAssento(S.codigo, i, { equipe: nova }).catch(falhou);
  }

  function sortearEquipes() {
    const parts = embaralharLocal(participantes()), tam = tamanhoEquipe();
    REDE.mexerAssentos(S.codigo, function (lista) {
      parts.forEach(function (i, k) { lista[i].equipe = Math.floor(k / tam); });
      return lista;
    }).catch(falhou);
  }

  // Quem criou a sala começa: monta a lista de jogadores na ordem de jogada.
  function comecarPartida() {
    if (!souHost() || problemaParaComecar()) return;
    const cores = coresDosLugares(), grande = ehGrande();
    let bots = 0;
    let jogadores = participantes().map(function (i) {
      const a = S.assentos[i];
      const humano = a.tipo === "humano";
      const j = { nome: humano ? limparNome(a.nome) || "Jogador" : grande ? REINOS_GRANDE[i] : "Bot " + (++bots), tipo: humano ? "humano" : "bot", cor: cores[i], lugar: i };
      if (humano) j.uid = a.uid;
      return j;
    });
    let tam = 2;
    if (S.meta.modo === "equipes") {
      // equipes montadas na sala; o jogo sorteia a ordem (alternando as equipes)
      const ef = equipesEfetivas();
      tam = tamanhoEquipe();
      const grupos = [];
      for (let e = 0; e < ef.nEq; e++) grupos.push(embaralharLocal(jogadores.filter(function (j) { return ef.eq[j.lugar] === e; })));
      const ordemEq = embaralharLocal(grupos);
      jogadores = [];
      for (let k = 0; k < tam; k++) ordemEq.forEach(function (g) { jogadores.push(g[k]); });
    } else if (!grande) {
      jogadores = embaralharLocal(jogadores); // a ordem da mesa é sorteada
    }
    const config = { modo: S.meta.modo, tamEquipe: tam, semente: novaSemente(), jogadores: jogadores };
    const b = overlay().querySelector("#salaComecar");
    if (b) b.disabled = true;
    REDE.comecarPartida(S.codigo, config).catch(function (e) { if (b) b.disabled = false; falhou(e); });
  }

  /* ---------------- partida ---------------- */
  // Refaz a partida inteira a partir da configuração + lista de jogadas.
  function montarEstado(config, acoes) {
    const jog = config.jogadores.map(function (j) { return { nome: limparNome(j.nome) || "Jogador", tipo: j.tipo, cor: j.cor }; });
    const e = criarPartida(jog, { modo: config.modo, tamanhoEquipe: config.tamEquipe, semente: config.semente, equipesProntas: true });
    acoes.forEach(function (a) { if (a.t !== "revanche") aplicarAcao(e, a); });
    return e;
  }

  async function comecarJogo() {
    S.fase = "jogo";
    try {
      const s = await REDE.lerSala(S.codigo);
      if (!s || !s.config) throw new Error("A partida não foi encontrada.");
      S.config = s.config;
      S.meuId = S.config.jogadores.findIndex(function (j) { return j.uid === REDE.uid; });
      if (S.meuId < 0) throw new Error("Você não está nessa partida.");
      REDE.marcarPresenca(S.codigo, S.config.jogadores[S.meuId].lugar);
      S.log = await REDE.lerAcoes(S.codigo);
      const rev = S.log.filter(function (a) { return a.t === "revanche"; })[0];
      if (rev) { irParaRevanche(rev.sala); return; } // a revanche já foi chamada: vai direto para a sala nova
      S.marco = Date.now(); S.vistoN = S.log.length;
      S.config.jogadores.forEach(function (j, id) { if (j.tipo === "humano") { S.onlineAntes[id] = estaOnline(id); if (!S.onlineAntes[id]) S.caiuEm[id] = Date.now(); } });
      T().abrirPartidaOnline(montarEstado(S.config, S.log), S.meuId);
      REDE.escutarAcoes(S.codigo, S.log.length, chegouAcao, recarregar);
      REDE.escutarAtividade(S.codigo, function (v) {
        const agora = Date.now();
        Object.keys(v).forEach(function (id) {
          if (S.sinalBruto && S.sinalBruto[id] !== v[id]) S.sinalVisto[id] = agora;
        });
        S.sinalBruto = v;
      });
      S.timer = setInterval(juiz, 500);
    } catch (e) {
      desligar(); guardar(CHAVE_SALA, null);
      T().mostrarInicio();
      toast(mensagem(e));
    }
  }

  // Chegou a jogada número n da nuvem.
  function chegouAcao(n, acao) {
    if (S.fase !== "jogo" || n < S.log.length) return;
    if (n > S.log.length) { recarregar(); return; } // pulou alguma (não deveria): refaz tudo
    if (acao.t === "revanche") { irParaRevanche(acao.sala); return; }
    S.log.push(acao);
    if (S.fila.length && S.fila[0].id === acao.id) { // a minha jogada, já aplicada aqui
      S.fila.shift();
      bombear();
      return;
    }
    if (S.fila.length) { // alguém gravou antes da minha: refaz a partida pela lista
      S.fila = []; S.geracao++;
      T().reconstruir(montarEstado(S.config, S.log));
      return;
    }
    const r = T().receber(acao);
    if (r && r.ok && acao.h && !S.avisouSinc && resumo(T().estado()) !== acao.h) {
      S.avisouSinc = true;
      console.error("Partida fora de sincronia na jogada", n, JSON.stringify(acao), resumo(T().estado()));
      toast("A partida ficou diferente neste aparelho. Saia e entre de novo pelo convite.");
    }
  }

  function recarregar() {
    REDE.lerAcoes(S.codigo).then(function (acoes) {
      S.log = acoes; S.fila = []; S.geracao++;
      T().reconstruir(montarEstado(S.config, S.log));
    }).catch(falhou);
  }

  // Resumo do estado (para conferir que todo mundo está igual).
  function resumo(e) {
    const txt = JSON.stringify([e.rng, e.vez, e.fase, e.territorios]);
    let h = 5381;
    for (let i = 0; i < txt.length; i++) h = ((h * 33) ^ txt.charCodeAt(i)) >>> 0;
    return h;
  }

  // A tela já aplicou a minha jogada aqui; manda para a nuvem (em ordem).
  function enviar(acao) {
    const a = {};
    Object.keys(acao).forEach(function (k) { if (acao[k] !== undefined) a[k] = acao[k]; });
    a.id = idAleatorio();
    a.h = resumo(T().estado());
    S.fila.push(a);
    S.marco = Date.now();
    bombear();
  }

  function bombear() {
    if (S.enviando) return;
    const i = S.fila.findIndex(function (a) { return !a._enviada; });
    if (i < 0) return;
    const ac = S.fila[i], n = S.log.length + i, ger = S.geracao;
    const limpa = {};
    Object.keys(ac).forEach(function (k) { if (k !== "_enviada") limpa[k] = ac[k]; });
    S.enviando = true;
    REDE.gravarAcao(S.codigo, n, limpa).then(function (gravou) {
      S.enviando = false;
      if (ger !== S.geracao) return;
      if (gravou) { ac._enviada = true; bombear(); }
      // se não gravou, alguém chegou antes: a jogada dele vai chegar e a partida é refeita
    }).catch(function (e) {
      S.enviando = false;
      if (ger !== S.geracao) return;
      falhou(e);
      recarregar();
    });
  }

  function estaOnline(id) {
    const j = S.config.jogadores[id];
    if (!j || j.tipo !== "humano") return true;
    const a = S.assentos && S.assentos[j.lugar];
    return !!(a && a.online && a.uid === j.uid);
  }

  // Juiz: a pessoa conectada de menor número na mesa (todos calculam igual).
  function juizId() {
    for (let id = 0; id < S.config.jogadores.length; id++) {
      if (S.config.jogadores[id].tipo === "humano" && estaOnline(id)) return id;
    }
    return -1;
  }
  // Chefe (vê o botão do parado): quem criou a sala; se estiver fora, o juiz.
  function chefeId() {
    const h = S.config.jogadores.findIndex(function (j) { return j.uid === (S.meta && S.meta.host); });
    return h >= 0 && estaOnline(h) ? h : juizId();
  }

  function juiz() {
    const e = T() && T().estado();
    if (S.fase !== "jogo" || !e) return;
    const agora = Date.now();
    let parado = null;
    if (e.vencedor === null) {
      const v = e.vez, j = S.config.jogadores[v], n = S.log.length;
      if (S.vistoN !== n) { S.vistoN = n; S.marco = agora; }
      const euJuiz = juizId() === S.meuId;
      if (j.tipo === "bot") {
        if (euJuiz && agora - S.marco >= DELAY_BOT) pedirBot(v, n);
      } else if (!estaOnline(v)) {
        if (euJuiz && agora - Math.max(S.marco, S.caiuEm[v] || 0) >= ESPERA_CAIU) pedirBot(v, n);
      } else if (v !== S.meuId && chefeId() === S.meuId) {
        if (agora - Math.max(S.marco, S.sinalVisto[v] || 0) >= ESPERA_PARADO) parado = v;
      }
    }
    if (parado !== S.parado) { S.parado = parado; T().render(); }
    atualizarRevanche();
  }

  // Grava "o bot joga este turno de v" como a jogada número n.
  function pedirBot(v, n) {
    if (S.pedidoEm === n || S.fila.length) return;
    S.pedidoEm = n;
    REDE.gravarAcao(S.codigo, n, { t: "bot", a: v, id: idAleatorio() }).catch(function () { S.pedidoEm = null; });
  }

  // Toque na tela na minha vez = "estou aqui" (vai para a nuvem de tempos em tempos).
  function sinal() {
    const e = T() && T().estado();
    if (S.fase !== "jogo" || !e || e.vez !== S.meuId || e.vencedor !== null) return;
    const agora = Date.now();
    if (agora - S.ultimoSinal < INTERVALO_SINAL) return;
    S.ultimoSinal = agora;
    REDE.sinalDeVida(S.codigo, S.meuId);
  }

  // Caixa do online no painel: sala + (para quem criou) o botão do jogador parado.
  function painelHtml() {
    if (S.fase !== "jogo") return "";
    let html = '<div class="onSala">Online · sala <b>' + esc(S.codigo) + "</b></div>";
    if (S.parado !== null) {
      const nome = esc(S.config.jogadores[S.parado].nome);
      html += '<div class="onParado">' + nome + " está parado há mais de 1 minuto." +
        '<button class="primary" id="onBotParado">Bot joga por ' + nome + "</button></div>";
    }
    return html;
  }
  function ligarPainel(box) {
    const b = box.querySelector("#onBotParado");
    if (b) b.addEventListener("click", function () {
      const e = T().estado();
      if (S.parado === null || e.vez !== S.parado) return;
      b.disabled = true;
      pedirBot(S.parado, S.log.length);
    });
  }

  /* ---------------- revanche ---------------- */
  // Parte online da janela de vitória: o botão "Jogar de novo" para quem chama
  // a revanche (quem criou a sala; se estiver fora, o juiz), e o aviso para os outros.
  function htmlRevanche() {
    const chefe = chefeId();
    if (chefe === S.meuId) {
      return '<button class="primary" id="onRevanche" style="width:100%"' + (S.chamando ? " disabled" : "") + ">" +
        (S.chamando ? "Abrindo a sala…" : "Jogar de novo") + "</button>" +
        '<p class="onRevNota">Todos voltam para a sala, com os mesmos lugares e cores.</p>';
    }
    const nome = chefe >= 0 ? esc(S.config.jogadores[chefe].nome) : "alguém";
    return '<p class="onRevNota">Esperando ' + nome + " chamar a revanche…</p>";
  }
  function atualizarRevanche() {
    const box = document.querySelector("#overlay.on #onRevancheBox");
    if (!box || S.fase !== "jogo") return;
    const html = htmlRevanche();
    if (html === S.revancheHtml && box.innerHTML) return;
    S.revancheHtml = html;
    box.innerHTML = html;
    const b = box.querySelector("#onRevanche");
    if (b) b.addEventListener("click", chamarRevanche);
  }

  // Cria a sala nova (mesmo modo, mesmos lugares) e avisa a todos pela lista de jogadas.
  async function chamarRevanche() {
    const e = T().estado();
    if (S.chamando || S.fase !== "jogo" || !e || e.vencedor === null) return;
    S.chamando = true; atualizarRevanche();
    try {
      const eu = S.config.jogadores[S.meuId], meu = S.assentos[eu.lugar] || {};
      const cor = Number.isInteger(meu.cor) ? meu.cor : Number(lerGuardado(CHAVE_COR)) || 0;
      const nova = await REDE.criarSala(limparNome(eu.nome) || "Jogador", cor,
        { modo: S.config.modo, tamEquipe: S.meta.tamEquipe || S.config.tamEquipe, assentos: S.assentos, lugar: eu.lugar });
      const gravou = await REDE.gravarAcao(S.codigo, S.log.length, { t: "revanche", a: S.meuId, sala: nova, id: idAleatorio() });
      if (!gravou) { // alguém chamou antes: fica a sala dele (a jogada dele está chegando)
        REDE.sairDoLobby(nova).catch(function () {});
      }
    } catch (x) {
      S.chamando = false; atualizarRevanche();
      falhou(x);
    }
  }

  // Todos (e quem chegar depois pelo convite antigo) vão para a sala da revanche,
  // de volta ao seu lugar.
  function irParaRevanche(codigo) {
    const eu = S.config && S.config.jogadores[S.meuId];
    const lugar = eu ? eu.lugar : null;
    const cor = eu && S.assentos && S.assentos[lugar] ? S.assentos[lugar].cor : null;
    desligar();
    if (T()) T().fimOnline();
    entrar(codigo, lugar, cor).catch(function (x) {
      guardar(CHAVE_SALA, null);
      abrirEntrada({ erro: mensagem(x) });
    });
  }

  function desligar() {
    if (S.timer) clearInterval(S.timer);
    try { REDE.desligar(); } catch (e) { /* nada carregado */ }
    S = novoS();
  }

  // Sair da partida online (o bot joga no seu lugar enquanto você estiver fora).
  // Com manterSala, a tela de início oferece "Voltar para a partida online".
  function sair(opcoes) {
    desligar();
    if (!(opcoes && opcoes.manterSala)) guardar(CHAVE_SALA, null);
    else guardar(CHAVE_SAIU, "1");
    if (T()) T().fimOnline();
  }

  // Tela de início: botão de jogar online (e de voltar para a partida em andamento).
  function preencherInicio(el) {
    const salva = lerGuardado(CHAVE_SALA);
    el.innerHTML = (salva ? '<button class="primary" id="onVoltarPartida">Voltar para a partida online (sala ' + esc(salva) + ")</button>" : "") +
      '<button class="' + (salva ? "ghost" : "") + '" id="onJogarOnline">Jogar online com amigos</button>';
    el.querySelector("#onJogarOnline").addEventListener("click", function () { abrirEntrada(); });
    const v = el.querySelector("#onVoltarPartida");
    if (v) v.addEventListener("click", function () {
      v.disabled = true; v.textContent = "Voltando…";
      entrar(salva).catch(function (e) {
        guardar(CHAVE_SALA, null);
        abrirEntrada({ erro: mensagem(e) });
      });
    });
  }

  // Ao abrir o jogo: link de convite (?sala=CODIGO) leva direto para a sala;
  // e quem fechou o app no meio da partida (sem sair) volta direto para ela.
  function aoAbrir() {
    const codigo = REDE.codigoNaURL();
    const salva = lerGuardado(CHAVE_SALA);
    if (!codigo && salva && !lerGuardado(CHAVE_SAIU)) {
      const b = overlay().querySelector("#onVoltarPartida");
      if (b) b.click();
      return;
    }
    if (!codigo) return;
    try { history.replaceState(null, "", location.pathname); } catch (e) { /* tudo bem */ }
    if (lerGuardado(CHAVE_NOME)) {
      abrirEntrada({ codigo: codigo });
      const ov = overlay();
      ov.querySelector("#onErro").textContent = "Entrando…";
      entrar(codigo).catch(function (e) { abrirEntrada({ codigo: codigo, erro: mensagem(e) }); });
    } else abrirEntrada({ codigo: codigo });
  }

  window.ONLINE = {
    get ativo() { return S.fase === "jogo"; },
    get meuId() { return S.meuId; },
    abrirEntrada: abrirEntrada, preencherInicio: preencherInicio, aoAbrir: aoAbrir,
    enviar: enviar, sinal: sinal, sair: sair, atualizarRevanche: atualizarRevanche,
    estaOnline: function (id) { return S.fase !== "jogo" || estaOnline(id); },
    painelHtml: painelHtml, ligarPainel: ligarPainel,
    montarEstado: montarEstado, limparNome: limparNome,
    get _depurar() { return { log: S.log, fila: S.fila, config: S.config }; },
  };
})();
