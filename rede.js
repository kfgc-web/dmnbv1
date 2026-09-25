/* ============================================================
   DOMINATION: BRITANNIA — rede.js (conversa com a nuvem)
   Carregar depois de motor.js e antes de online.js.
   Só guarda e busca dados no Firebase (Realtime Database):
   login invisível, salas, lugares, presença e a lista de jogadas.
   Quem decide o que fazer com isso é o online.js.

   PRINCÍPIO: o Firebase só é baixado quando alguém escolhe jogar
   ONLINE. Jogar sozinho nunca toca aqui (o jogo abre sem internet).
   Base: rede.js do Super Trunfo Egípcio (login anônimo, código de
   5 letras, convite), agora com a partida guardada na nuvem.

   Como a sala fica no banco (salas/CODIGO):
     criadaEm            quando foi criada (faxina das salas velhas)
     meta                { host, status: lobby|jogando, modo, tamEquipe }
     membros/UID         true (quem entrou na sala)
     assentos/0..8       { tipo: humano|aberto|bot|vazio, uid, nome, cor, equipe, online }
     partida/config      { modo, tamEquipe, semente, jogadores: [{ nome, tipo, cor, uid, lugar }] }
     acoes/0000000...    a lista de jogadas (motor.js: aplicarAcao), só se acrescenta
     atividade/ID        último sinal de vida do jogador ID na vez dele
   As regras de segurança do banco estão em ferramentas/regras-firebase.json.
   ============================================================ */
(function () {
  "use strict";

  // Configuração do projeto (a apiKey NÃO é segredo: quem protege o banco são as regras)
  const firebaseConfig = {
    apiKey: "AIzaSyBLOuYss0_nYUimgsRTrJs1vpIm_6PC3OA",
    authDomain: "domination-britannia.firebaseapp.com",
    databaseURL: "https://domination-britannia-default-rtdb.firebaseio.com",
    projectId: "domination-britannia",
    storageBucket: "domination-britannia.firebasestorage.app",
    messagingSenderId: "620439108731",
    appId: "1:620439108731:web:628fa23771cf6f1677b6de",
  };
  const FB_VERSAO = "12.11.0";
  const FB_BASE = "https://www.gstatic.com/firebasejs/" + FB_VERSAO + "/";
  const LUGARES = 9;                    // Grande Exército usa os 9; os outros modos, os 6 primeiros
  const DIAS_FAXINA = 3;                // salas com mais de 3 dias são apagadas

  let db = null, uid = null, iniciando = null;
  const escutas = [];                   // { ref, evento, fn } para desligar ao sair
  let presenca = null;                  // { codigo, lugar, fn } — lugar marcado como conectado

  function carregarScript(src) {
    return new Promise(function (ok, falha) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = function () { falha(new Error("Sem internet? Não deu para carregar o jogo online.")); };
      document.head.appendChild(s);
    });
  }

  // Carrega o Firebase (só na primeira vez) e faz o login invisível.
  function init() {
    if (uid) return Promise.resolve(uid);
    if (iniciando) return iniciando;
    iniciando = (async function () {
      if (typeof firebase === "undefined") {
        await carregarScript(FB_BASE + "firebase-app-compat.js");
        await carregarScript(FB_BASE + "firebase-auth-compat.js");
        await carregarScript(FB_BASE + "firebase-database-compat.js");
      }
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      db = firebase.database();
      const emu = window.__FIREBASE_EMULADOR; // só nos testes (ferramentas/teste-online.js)
      if (emu) {
        db.useEmulator(emu.host, emu.db);
        firebase.auth().useEmulator("http://" + emu.host + ":" + emu.auth);
      }
      const cred = await firebase.auth().signInAnonymously();
      uid = cred.user.uid;
      return uid;
    })();
    iniciando.catch(function () { iniciando = null; });
    return iniciando;
  }

  function ref(caminho) { return db.ref(caminho); }
  function sala(codigo) { return "salas/" + codigo; }
  function agora() { return firebase.database.ServerValue.TIMESTAMP; }
  function chaveAcao(n) { return String(n).padStart(7, "0"); } // 0000000, 0000001… (ordem certa)

  // Código curto sem letras que confundem (sem I, O, 0, 1).
  function gerarCodigo() {
    const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "";
    for (let i = 0; i < 5; i++) c += alfabeto[Math.floor(Math.random() * alfabeto.length)];
    return c;
  }

  // Apaga algumas salas velhas (sem servidor, a faxina é feita por quem cria sala).
  function faxina() {
    const limite = Date.now() - DIAS_FAXINA * 86400000;
    return ref("salas").orderByChild("criadaEm").endAt(limite).limitToFirst(10).get().then(function (snap) {
      const apagar = [];
      snap.forEach(function (s) { apagar.push(s.ref.remove().catch(function () { /* regra não deixou: tudo bem */ })); });
      return Promise.all(apagar);
    }).catch(function () { /* faxina é só capricho */ });
  }

  // Cria a sala: quem cria fica no lugar 0 e manda na sala.
  async function criarSala(nome, cor) {
    await init();
    let codigo = null;
    for (let t = 0; t < 6 && !codigo; t++) {
      const c = gerarCodigo();
      if (!(await ref(sala(c) + "/meta").get()).exists()) codigo = c;
    }
    if (!codigo) throw new Error("Não deu para criar a sala. Tente de novo.");
    const assentos = {};
    for (let i = 0; i < LUGARES; i++) assentos[i] = { tipo: i === 0 ? "humano" : i < 4 ? "aberto" : "vazio" };
    assentos[0] = { tipo: "humano", uid: uid, nome: nome, cor: cor, online: true };
    const dados = { criadaEm: agora(), meta: { host: uid, status: "lobby", modo: "classico", tamEquipe: 2 }, assentos: assentos };
    dados.membros = {}; dados.membros[uid] = true;
    await ref(sala(codigo)).set(dados);
    faxina();
    return codigo;
  }

  // Lê a sala inteira de uma vez (sem a lista de jogadas).
  async function lerSala(codigo) {
    await init();
    const [meta, assentos, config] = await Promise.all([
      ref(sala(codigo) + "/meta").get(), ref(sala(codigo) + "/assentos").get(), ref(sala(codigo) + "/partida/config").get(),
    ]);
    if (!meta.exists()) return null;
    return { meta: meta.val(), assentos: listaAssentos(assentos.val()), config: config.val() };
  }

  function listaAssentos(v) {
    const lista = [];
    for (let i = 0; i < LUGARES; i++) lista.push((v && v[i]) || { tipo: "vazio" });
    return lista;
  }

  // Entra na sala: se já tem lugar (voltou), fica nele; senão ocupa o 1º aberto.
  // Devolve { lugar } ou lança um erro com mensagem para o jogador.
  async function entrarSala(codigo, nome, corPreferida) {
    await init();
    const s = await lerSala(codigo);
    if (!s) throw new Error("Sala " + codigo + " não encontrada. Confira o código.");
    await ref(sala(codigo) + "/membros/" + uid).set(true);
    if (s.meta.status === "jogando") {
      const meu = (s.config && s.config.jogadores || []).filter(function (j) { return j.uid === uid; })[0];
      if (!meu) throw new Error("Essa partida já começou.");
      return { lugar: meu.lugar, jogando: true };
    }
    let lugar = null, erro = null;
    const r = await ref(sala(codigo) + "/assentos").transaction(function (v) {
      lugar = null; erro = null;
      // CUIDADO (bug do Super Trunfo): a 1ª chamada vem com o que o aparelho já
      // sabia, que pode ser nada. Devolver null faz o Firebase perguntar ao servidor.
      if (v === null) return null;
      const lista = listaAssentos(v);
      const meu = lista.findIndex(function (a) { return a.uid === uid; });
      if (meu >= 0) { lugar = meu; lista[meu].online = true; return lista; }
      const maxLugar = s.meta.modo === "grande" ? LUGARES : 6;
      const livre = lista.findIndex(function (a, i) { return i < maxLugar && a.tipo === "aberto"; });
      if (livre < 0) { erro = "Não há lugar livre nessa sala."; return; }
      const usadas = lista.filter(function (a) { return a.tipo === "humano"; }).map(function (a) { return a.cor; });
      let cor = corPreferida;
      if (cor == null || usadas.indexOf(cor) !== -1) cor = [0, 1, 2, 3, 4, 5].filter(function (c) { return usadas.indexOf(c) === -1; })[0];
      lista[livre] = { tipo: "humano", uid: uid, nome: nome, cor: cor, online: true };
      lugar = livre;
      return lista;
    });
    if (!r.committed || lugar === null) throw new Error(erro || "Não deu para entrar. Tente de novo.");
    return { lugar: lugar, jogando: false };
  }

  // Mexe nos lugares de uma vez só (troca de lugar, tipo, equipe…): fn recebe a
  // lista e devolve a lista nova (ou undefined para desistir).
  function mexerAssentos(codigo, fn) {
    return ref(sala(codigo) + "/assentos").transaction(function (v) { return v === null ? null : fn(listaAssentos(v)); });
  }
  function gravarMeta(codigo, campos) { return ref(sala(codigo) + "/meta").update(campos); }
  function gravarAssento(codigo, i, campos) { return ref(sala(codigo) + "/assentos/" + i).update(campos); }

  // Presença: o lugar fica "online" enquanto o aparelho estiver conectado
  // (e volta sozinho quando a internet volta).
  function marcarPresenca(codigo, lugar) {
    if (presenca && presenca.codigo === codigo && presenca.lugar === lugar) return;
    desligarPresenca();
    const conectado = ref(".info/connected");
    const meu = ref(sala(codigo) + "/assentos/" + lugar + "/online");
    const fn = conectado.on("value", function (snap) {
      if (snap.val() !== true) return;
      meu.onDisconnect().set(false).then(function () { return meu.set(true); }).catch(function () { /* saiu da sala */ });
    });
    presenca = { codigo: codigo, lugar: lugar, ref: conectado, fn: fn, meu: meu };
  }
  function desligarPresenca() {
    if (!presenca) return;
    presenca.ref.off("value", presenca.fn);
    presenca.meu.onDisconnect().cancel().catch(function () {});
    presenca = null;
  }

  function escutar(caminho, cb) {
    const r = ref(caminho);
    const fn = r.on("value", function (snap) { cb(snap.val()); });
    escutas.push({ ref: r, evento: "value", fn: fn });
  }
  function escutarMeta(codigo, cb) { escutar(sala(codigo) + "/meta", function (v) { cb(v); }); }
  function escutarAssentos(codigo, cb) { escutar(sala(codigo) + "/assentos", function (v) { cb(listaAssentos(v)); }); }
  function escutarAtividade(codigo, cb) { escutar(sala(codigo) + "/atividade", function (v) { cb(v || {}); }); }

  // Quem manda começa a partida: grava a configuração e muda o status.
  function comecarPartida(codigo, config) {
    const up = {};
    up["partida/config"] = config;
    up["meta/status"] = "jogando";
    return ref(sala(codigo)).update(up);
  }

  // Todas as jogadas já feitas, em ordem.
  async function lerAcoes(codigo) {
    const snap = await ref(sala(codigo) + "/acoes").orderByKey().get();
    const lista = [];
    snap.forEach(function (s) { lista.push(s.val()); });
    return lista;
  }

  // Jogadas novas (a partir da n-ésima), uma por vez, em ordem. "desfez" é
  // chamado se uma jogada sumir (o aparelho mostrou uma escrita que a nuvem recusou).
  function escutarAcoes(codigo, desde, cb, desfez) {
    let q = ref(sala(codigo) + "/acoes").orderByKey();
    if (desde > 0) q = q.startAt(chaveAcao(desde));
    const fn = q.on("child_added", function (snap) { cb(Number(snap.key), snap.val()); });
    const fn2 = q.on("child_removed", function () { desfez(); });
    escutas.push({ ref: q, evento: "child_added", fn: fn }, { ref: q, evento: "child_removed", fn: fn2 });
  }

  // Grava a jogada de número n — só se ninguém gravou esse número antes.
  // Devolve true (gravou) ou false (alguém chegou primeiro).
  async function gravarAcao(codigo, n, acao) {
    const r = await ref(sala(codigo) + "/acoes/" + chaveAcao(n)).transaction(function (atual) {
      if (atual !== null) return; // já tem jogada aqui: desiste
      return acao;
    }, undefined, false);
    return r.committed;
  }

  function sinalDeVida(codigo, id) {
    return ref(sala(codigo) + "/atividade/" + id).set(agora()).catch(function () {});
  }

  // Sai da sala no lobby: libera o lugar (e passa o comando, se era quem mandava).
  async function sairDoLobby(codigo) {
    const s = await lerSala(codigo);
    if (!s) return;
    const meu = s.assentos.findIndex(function (a) { return a.uid === uid; });
    if (s.meta.host === uid) {
      const outro = s.assentos.filter(function (a) { return a.tipo === "humano" && a.uid && a.uid !== uid; })[0];
      if (!outro) { desligarPresenca(); return ref(sala(codigo)).remove(); }
      await gravarMeta(codigo, { host: outro.uid });
    }
    desligarPresenca();
    if (meu >= 0) await ref(sala(codigo) + "/assentos/" + meu).set({ tipo: "aberto" });
  }

  // Desliga tudo o que está escutando (a sala continua na nuvem).
  function desligar() {
    escutas.forEach(function (e) { e.ref.off(e.evento, e.fn); });
    escutas.length = 0;
    desligarPresenca();
  }

  function linkConvite(codigo) { return location.origin + location.pathname + "?sala=" + codigo; }
  function codigoNaURL() {
    const c = new URLSearchParams(location.search).get("sala");
    return c ? c.toUpperCase().trim() : null;
  }

  window.REDE = {
    LUGARES: LUGARES,
    init: init, criarSala: criarSala, lerSala: lerSala, entrarSala: entrarSala,
    mexerAssentos: mexerAssentos, gravarMeta: gravarMeta, gravarAssento: gravarAssento,
    marcarPresenca: marcarPresenca, escutarMeta: escutarMeta, escutarAssentos: escutarAssentos,
    escutarAtividade: escutarAtividade, comecarPartida: comecarPartida,
    lerAcoes: lerAcoes, escutarAcoes: escutarAcoes, gravarAcao: gravarAcao, sinalDeVida: sinalDeVida,
    sairDoLobby: sairDoLobby, desligar: desligar, linkConvite: linkConvite, codigoNaURL: codigoNaURL,
    get uid() { return uid; },
  };
})();
