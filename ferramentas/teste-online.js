/* ============================================================
   DOMINATION: BRITANNIA — ferramentas/teste-online.js
   Teste do ONLINE com vários "aparelhos" (janelas separadas do
   Chromium) jogando na mesma sala, contra uma cópia local do
   Firebase (emulador oficial) com as regras de segurança de
   ferramentas/regras-firebase.json.

   Uso (na raiz do repositório):
       npm i --no-save --prefix ferramentas firebase@12.11.0 firebase-tools@15   (uma vez)
       node ferramentas/teste-online.js
       node ferramentas/teste-online.js --prints   (salva prints em ferramentas/prints/)

   Precisa de Java (o emulador do banco é um .jar que o firebase-tools
   baixa na primeira vez). O script sobe o emulador sozinho (ou usa um
   que já esteja rodando na porta 9000) e um servidorzinho local para o jogo.
   O Firebase que o jogo baixaria da internet é servido da pasta
   ferramentas/node_modules/firebase. Termina com código 1 se algo falhar.

   Confere: criar sala, entrar pelo convite, cor, modo, começar com bots
   completando; todos os aparelhos com a MESMA partida a cada jogada;
   bots jogando sozinhos; dados à prova de trapaça (regras recusam jogada
   em nome de outro); quem cai vira bot e volta; botão do jogador parado;
   duas jogadas ao mesmo tempo; Equipes montadas na sala; Grande Exército
   com reino escolhido; e a partida sozinho continua sem internet.
   ============================================================ */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const RAIZ = path.join(__dirname, "..");
const MODS = path.join(__dirname, "node_modules");
const PRINTS = process.argv.includes("--prints");
const PASTA_PRINTS = path.join(__dirname, "prints");
const EMU = { host: "127.0.0.1", db: 9000, auth: 9099 };
const ESPERAS = { caiu: 2500, parado: 3000 }; // no jogo: 10 s e 60 s
const TIPOS = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png",
  ".webmanifest": "application/manifest+json", ".webp": "image/webp" };

let falhas = 0;
function checar(nome, ok, detalhe) {
  console.log((ok ? "  ok   " : "  FALHOU ") + nome + (detalhe !== undefined ? "  (" + detalhe + ")" : ""));
  if (!ok) falhas++;
}
const dormir = function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };

// ---------- emulador do Firebase ----------
function portaResponde(porta) {
  return new Promise(function (ok) {
    const r = http.get({ host: EMU.host, port: porta, path: "/" }, function (res) { res.resume(); ok(true); });
    r.on("error", function () { ok(false); });
    r.setTimeout(1500, function () { r.destroy(); ok(false); });
  });
}
// Publica as regras de segurança no emulador (como colar no console do Firebase).
function publicarRegras() {
  const corpo = fs.readFileSync(path.join(__dirname, "regras-firebase.json"));
  return new Promise(function (ok, falha) {
    const r = http.request({ host: EMU.host, port: EMU.db, method: "PUT", path: "/.settings/rules.json?ns=domination-britannia-default-rtdb",
      headers: { Authorization: "Bearer owner", "Content-Type": "application/json" } }, function (res) {
      let txt = ""; res.on("data", function (d) { txt += d; });
      res.on("end", function () { if (res.statusCode === 200) ok(); else falha(new Error("Regras recusadas: " + txt)); });
    });
    r.on("error", falha);
    r.end(corpo);
  });
}

async function subirEmulador() {
  if (await portaResponde(EMU.db) && await portaResponde(EMU.auth)) return null; // já rodando
  const bin = path.join(MODS, ".bin", "firebase");
  if (!fs.existsSync(bin)) throw new Error("Falta instalar: npm i --no-save --prefix ferramentas firebase@12.11.0 firebase-tools@15");
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "britannia-emu-"));
  fs.writeFileSync(path.join(pasta, "firebase.json"), JSON.stringify({
    emulators: { database: { host: EMU.host, port: EMU.db }, auth: { host: EMU.host, port: EMU.auth }, ui: { enabled: false } },
  }));
  // o emulador conversa consigo mesmo por 127.0.0.1: sem passar por proxy
  const env = Object.assign({}, process.env, { NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost", GLOBAL_AGENT_NO_PROXY: "127.0.0.1,localhost" });
  const proc = spawn(bin, ["emulators:start", "--only", "database,auth", "--project", "domination-britannia"], { cwd: pasta, env: env, stdio: ["ignore", "pipe", "pipe"] });
  let saida = "";
  proc.stdout.on("data", function (d) { saida += d; });
  proc.stderr.on("data", function (d) { saida += d; });
  for (let i = 0; i < 120; i++) {
    if (/All emulators ready/.test(saida)) return proc;
    if (proc.exitCode !== null) break;
    await dormir(1000);
  }
  proc.kill();
  throw new Error("O emulador não subiu:\n" + saida.slice(-2000));
}

// ---------- servidor do jogo (com ganchos de teste no telas.js) ----------
const servidor = http.createServer(function (req, res) {
  let arq = decodeURIComponent(req.url.split("?")[0]);
  if (arq === "/") arq = "/index.html";
  const f = path.join(RAIZ, arq);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  let corpo = fs.readFileSync(f);
  if (arq === "/telas.js") {
    corpo = corpo.toString().replace("  instalarDefsCartas();",
      "  window.__e = function () { return estado; }; window.__jogar = function (a) { const r = jogar(a); render(); return r; };\n" +
      "  window.__humano = function () { return HUMANO; };\n  instalarDefsCartas();");
  }
  res.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" });
  res.end(corpo);
});

// Um "aparelho": contexto separado (login anônimo próprio), com o Firebase servido localmente.
async function aparelho(browser, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1300, height: 900 }, serviceWorkers: "block" });
  await ctx.addInitScript(function (cfg) { window.__FIREBASE_EMULADOR = cfg.emu; window.__ESPERAS = cfg.esperas; }, { emu: EMU, esperas: ESPERAS });
  await ctx.route("**/fonts.googleapis.com/**", function (r) { return r.abort(); });
  await ctx.route("https://www.gstatic.com/firebasejs/**", function (r) {
    const nome = r.request().url().split("/").pop();
    const f = path.join(MODS, "firebase", nome);
    if (!fs.existsSync(f)) return r.abort();
    return r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(f) });
  });
  ctx.erros = [];
  ctx.abrir = async function (sufixo) {
    const p = await ctx.newPage();
    p.on("pageerror", function (e) { ctx.erros.push(e.message); });
    ctx.consoleTudo = [];
    p.on("console", function (m) { ctx.consoleTudo.push(m.type() + ": " + m.text().slice(0, 200)); });
    p.on("crash", function () { console.log("   [página travou]"); });
    p.on("framedetached", function () {});
    let cargas = 0;
    p.on("load", function () { if (++cargas > 1) ctx.erros.push("a página recarregou sozinha: " + p.url()); });
    p.on("request", function (r) { if (r.isNavigationRequest() && cargas > 0) console.log("   [navegação]", r.url(), r.frame() === p.mainFrame() ? "(página)" : "(quadro)"); });
    p.on("console", function (m) { if (m.type() === "error" && !/net::ERR|WebSocket|permission_denied|PERMISSION_DENIED/i.test(m.text())) ctx.erros.push(m.text()); });
    await p.goto("http://localhost:" + servidor.address().port + "/" + (sufixo || ""));
    await p.waitForTimeout(300);
    ctx.pagina = p;
    return p;
  };
  return ctx;
}

// espera uma condição na página (função sem argumentos avaliada lá)
async function esperar(p, fn, arg, ms) {
  try { await p.waitForFunction(fn, arg, { timeout: ms || 15000 }); return true; } catch (e) { return false; }
}
function assinatura(p) {
  return p.evaluate(function () {
    const e = window.__e();
    if (!e) return null;
    return JSON.stringify([e.rng, e.vez, e.fase, e.turno, e.vencedor, e.territorios, e.jogadores.map(function (j) { return [j.cartas, j.vivo, j.objetivo, j.equipe, j.cor]; }), e.baralho.length]);
  });
}
async function mesmaPartida(pags) {
  const a = await Promise.all(pags.map(assinatura));
  return a.every(function (x) { return x && x === a[0]; });
}
// espera todos os aparelhos ficarem com a mesma partida
async function sincronizar(pags, ms) {
  const fim = Date.now() + (ms || 15000);
  while (Date.now() < fim) {
    if (await mesmaPartida(pags)) return true;
    await dormir(200);
  }
  return false;
}
// (esconde a faixa "emulator mode" que o Firebase põe no rodapé durante o teste)
const print = async function (p, nome) {
  if (!PRINTS) return;
  await p.addStyleTag({ content: ".firebase-emulator-warning{display:none !important}" });
  await p.screenshot({ path: path.join(PASTA_PRINTS, nome + ".png") });
};

// Joga a vez de quem é o humano deste aparelho: reforço (pela tela), 1 ataque se der, passa.
async function jogarMinhaVez(p) {
  return p.evaluate(function () {
    const e = window.__e(), eu = window.__humano();
    if (e.vez !== eu || e.vencedor !== null) return false;
    // troca obrigatória
    while (e.fase === "reforco" && e.jogadores[eu].cartas.length >= 5) {
      const t = acharTroca(e, eu); if (!t) break;
      window.__jogar({ t: "troca", c: t });
    }
    let guarda = 0;
    while (e.fase === "reforco" && e.reforcosPendentes > 0 && guarda++ < 200) {
      const rf = e.reforco;
      const reg = (rf.ordem || []).filter(function (r) { return (rf.porRegiao[r] || 0) > 0; })[0];
      const meus = territoriosDe(e, eu).filter(function (t) {
        return reg ? regiaoDe(t) === reg : rf.mar > 0 ? TERRITORIOS[t].litoral : true;
      });
      window.__jogar({ t: "ref", x: meus[0] });
    }
    if (e.fase === "reforco") window.__jogar({ t: "fimRef" });
    if (e.fase === "ataque") {
      const orig = territoriosDe(e, eu).filter(function (t) { return e.territorios[t].exercitos >= 2 && inimigosVizinhos(e, t).length; })[0];
      if (orig) {
        const r = window.__jogar({ t: "atq", o: orig, d: inimigosVizinhos(e, orig)[0] });
        if (r.ok && e.conquista) window.__jogar({ t: "conq", n: 1 });
      }
    }
    if (e.vencedor === null) window.__jogar({ t: "passar" });
    return true;
  });
}

// Faz a partida andar até a vez chegar em algum humano de "pags" (bots jogam sozinhos).
async function ateVezDeHumano(pags, ms) {
  const fim = Date.now() + (ms || 30000);
  while (Date.now() < fim) {
    for (const p of pags) {
      const minha = await p.evaluate(function () { const e = window.__e(); return !!e && e.vencedor === null && e.vez === window.__humano(); });
      if (minha) return p;
    }
    await dormir(250);
  }
  return null;
}

async function criarSala(ctx, nome) {
  const p = await ctx.abrir();
  await p.click("#onJogarOnline");
  await p.fill("#onNome", nome);
  await p.click("#onCriar");
  await esperar(p, function () { return !!document.querySelector(".salaCodigo"); });
  return { p: p, codigo: await p.$eval(".salaCodigo", function (e) { return e.textContent; }) };
}
async function entrarPeloConvite(ctx, codigo, nome) {
  const p = await ctx.abrir("?sala=" + codigo);
  await p.fill("#onNome", nome);
  await p.click("#onEntrarBtn");
  await esperar(p, function () { return !!document.querySelector(".salaCodigo"); });
  return p;
}
async function nLugaresHumanos(p) {
  return p.$$eval(".salaLugar", function (x) { return x.filter(function (e) { return e.querySelector(".salaNome").textContent.indexOf("Lugar aberto") === -1 && !e.classList.contains("vazio") && e.querySelector(".salaSentar") === null; }).length; });
}

(async function () {
  if (PRINTS) fs.mkdirSync(PASTA_PRINTS, { recursive: true });
  let emu = null, browser = null;
  var A_ = null, B_ = null;
  try {
    emu = await subirEmulador();
    await publicarRegras();
    await new Promise(function (ok) { servidor.listen(0, ok); });
    const exe = ["/opt/pw-browsers/chromium"].find(function (c) { return fs.existsSync(c); });
    browser = await chromium.launch(exe ? { executablePath: exe } : {});

    // ---------- sala ----------
    console.log("\nSala: criar, convidar, escolher cor e modo");
    const A = await aparelho(browser), B = await aparelho(browser), C = await aparelho(browser);
    A_ = A; B_ = B;
    const sa = await criarSala(A, "Ana");
    checar("sala criada com código de 5 letras", /^[A-Z2-9]{5}$/.test(sa.codigo), sa.codigo);
    const pa = sa.p;
    const pb = await entrarPeloConvite(B, sa.codigo, "Beto");
    checar("convite leva direto para a sala", (await pb.$eval(".salaCodigo", function (e) { return e.textContent; })) === sa.codigo);
    checar("link do convite some da barra de endereço", (await pb.evaluate(function () { return location.search; })) === "");
    await esperar(pa, function () { return document.querySelectorAll(".salaLugar .salaNome").length && document.body.innerText.indexOf("Beto") >= 0; });
    checar("quem criou vê quem entrou", (await pa.evaluate(function () { return document.body.innerText.indexOf("Beto") >= 0; })));
    // cor: a do Ana (vermelho, 0) fica bloqueada para o Beto; Beto escolhe turquesa (5)
    checar("cor de outra pessoa fica bloqueada", await pb.$eval('.salaCor[data-cor="0"]', function (b) { return b.disabled; }));
    await pb.click('.salaCor[data-cor="5"]');
    await esperar(pa, function () { return document.querySelector('.salaCor[data-cor="5"]').disabled; });
    checar("cor escolhida aparece para os outros", await pa.$eval('.salaCor[data-cor="5"]', function (b) { return b.disabled; }));
    checar("só quem criou escolhe o modo", (await pb.$$(".modoOpcao")).length === 0 && (await pa.$$(".modoOpcao")).length === 6);
    await pa.click('.modoOpcao[data-modo="classico"]');
    checar("quem entrou não tem botão de começar", (await pb.$$("#salaComecar")).length === 0);
    await print(pa, "online-sala");

    // segurança: quem não está na sala não grava jogada nem mexe nos lugares
    const pc = await C.abrir();
    const recusas = await pc.evaluate(async function (codigo) {
      await REDE.init();
      const db = firebase.database();
      const tenta = function (p) { return p.then(function () { return "gravou"; }, function (e) { return /permission/i.test(e.message) ? "recusou" : e.message; }); };
      return {
        assentos: await tenta(db.ref("salas/" + codigo + "/assentos/2").set({ tipo: "humano", uid: firebase.auth().currentUser.uid, nome: "Intruso" })),
        meta: await tenta(db.ref("salas/" + codigo + "/meta/status").set("jogando")),
      };
    }, sa.codigo);
    checar("regras: estranho não senta nem começa a partida", recusas.assentos === "recusou" && recusas.meta === "recusou", JSON.stringify(recusas));

    // começa: Ana + Beto + 2 lugares abertos (viram bots)
    await pa.click("#salaComecar");
    const comecou = await esperar(pa, function () { return !!window.__e && !!window.__e() && document.getElementById("overlay").classList.contains("on") === false || !!document.querySelector(".modalCartas"); })
      && await esperar(pb, function () { return !!window.__e && !!window.__e(); });
    checar("partida começa nos dois aparelhos", comecou);
    const info = await pa.evaluate(function () { const e = window.__e(); return { n: e.jogadores.length, tipos: e.jogadores.map(function (j) { return j.tipo; }).join(","), cores: e.jogadores.map(function (j) { return j.cor; }), modo: e.modo }; });
    checar("4 jogadores: 2 pessoas + 2 bots (lugares abertos viram bot)", info.n === 4 && info.tipos.split(",").filter(function (t) { return t === "bot"; }).length === 2, info.tipos);
    const corBeto = await pb.evaluate(function () { return window.__e().jogadores[window.__humano()].cor; });
    checar("Beto ficou com a cor que escolheu (turquesa)", corBeto === "#16a085", corBeto);
    checar("mesma partida nos dois aparelhos (mesmos territórios e objetivos)", await sincronizar([pa, pb]));
    const objetivos = await pa.evaluate(function () {
      const e = window.__e();
      return e.jogadores.filter(function (j) { return j.objetivo.tipo === "destruir"; }).map(function (j) { return j.objetivo.alvo; });
    });
    checar("Rixa de Sangue só mira cores que estão na mesa", objetivos.every(function (a) { return info.cores.indexOf(["#c0392b", "#2c6fbb", "#27ae60", "#e0a200", "#8e44ad", "#16a085"][a]) >= 0; }), objetivos.join(","));
    checar("painel mostra a sala", (await pa.$eval("#onlineBox", function (e) { return e.innerText; })).indexOf(sa.codigo) >= 0);

    // ---------- jogando ----------
    console.log("\nPartida: jogadas, bots e dados conferidos por todos");
    let turnosHumanos = 0, sempreIguais = true;
    for (let k = 0; k < 6; k++) {
      const p = await ateVezDeHumano([pa, pb]);
      if (!p) { sempreIguais = false; break; }
      if (!(await sincronizar([pa, pb]))) sempreIguais = false;
      await jogarMinhaVez(p);
      turnosHumanos++;
      if (!(await sincronizar([pa, pb]))) sempreIguais = false;
      if (await pa.evaluate(function () { return window.__e().vencedor !== null; })) break;
    }
    checar("6 turnos de pessoas com bots entre eles, tudo igual nos dois aparelhos", turnosHumanos >= 4 && sempreIguais, turnosHumanos + " turnos");
    const nAcoes = await pa.evaluate(function () { return window.__e().log.length; });
    checar("dados e bots vieram da lista de jogadas (crônica igual)", nAcoes > 0 && await mesmaPartida([pa, pb]));
    // trapaça: gravar jogada em nome do outro é recusado pelas regras
    // (feita de um terceiro aparelho que entrou na sala pelo código, fingindo ser a Ana)
    const idAna = await pa.evaluate(function () { return window.__humano(); });
    const trapaca = await pc.evaluate(async function (dados) {
      const codigo = dados.codigo, outro = dados.alvo;
      const db = firebase.database();
      await db.ref("salas/" + codigo + "/membros/" + firebase.auth().currentUser.uid).set(true);
      const snap = await db.ref("salas/" + codigo + "/acoes").get();
      const n = String(snap.numChildren()).padStart(7, "0");
      return db.ref("salas/" + codigo + "/acoes/" + n).set({ t: "passar", a: outro }).then(function () { return "gravou"; }, function (x) { return /permission/i.test(x.message) ? "recusou" : x.message; });
    }, { codigo: sa.codigo, alvo: idAna });
    checar("regras: ninguém joga em nome de outra pessoa", trapaca === "recusou", trapaca);
    checar("depois da jogada recusada, os dois aparelhos seguem iguais", await sincronizar([pa, pb]) &&
      (await pa.evaluate(function () { return window.ONLINE._depurar.log.length; })) === (await pb.evaluate(function () { return window.ONLINE._depurar.log.length; })));
    await print(pb, "online-partida");

    // ---------- botão do jogador parado ----------
    console.log("\nJogador parado e jogadas ao mesmo tempo");
    // espera a vez do Beto; Beto não toca em nada -> Ana (quem criou) vê o botão
    let vezBeto = false;
    for (let k = 0; k < 20 && !vezBeto; k++) {
      const p = await ateVezDeHumano([pa, pb]);
      if (!p) { console.log("   (a vez não chegou em ninguém)", await pa.evaluate(function () { const e = window.__e(); return JSON.stringify({ vez: e.vez, venc: e.vencedor, fase: e.fase }); })); break; }
      if (p === pb) { vezBeto = true; break; }
      await jogarMinhaVez(p);
    }
    const viuBotao = vezBeto && await esperar(pa, function () { return !!document.querySelector("#onBotParado"); }, null, ESPERAS.parado + 8000);
    checar("parado há um tempo: quem criou a sala vê 'Bot joga por Beto'", viuBotao);
    checar("o botão não aparece para o próprio parado", (await pb.$$("#onBotParado")).length === 0);
    if (viuBotao) {
      // Beto joga um reforço exatamente quando Ana toca no botão: a nuvem decide quem veio antes
      const antes = await pb.evaluate(function () { return window.__e().turno; });
      await Promise.all([
        pa.click("#onBotParado"),
        pb.evaluate(function () {
          const e = window.__e(), eu = window.__humano();
          const t = territoriosDe(e, eu).filter(function (x) {
            const rf = e.reforco, reg = (rf.ordem || []).filter(function (r) { return (rf.porRegiao[r] || 0) > 0; })[0];
            return reg ? regiaoDe(x) === reg : true;
          })[0];
          return window.__jogar({ t: "ref", x: t });
        }),
      ]);
      const iguais = await sincronizar([pa, pb], 20000);
      if (process.env.DEPURAR) {
        await dormir(1500);
        const d = await Promise.all([pa, pb].map(function (p) { return p.evaluate(function () {
          const x = window.ONLINE._depurar, e = window.__e();
          const re = window.ONLINE.montarEstado(x.config, x.log);
          const sig = function (q) { return JSON.stringify([q.rng, q.vez, q.fase, q.territorios, q.reforcosPendentes, q.reforco]); };
          return { n: x.log.length, log: JSON.stringify(x.log), vivoIgualRefeito: sig(e) === sig(re), vivo: sig(e) };
        }); }));
        console.log("   logs iguais:", d[0].log === d[1].log, " n:", d[0].n, d[1].n, " vivo=refeito:", d[0].vivoIgualRefeito, d[1].vivoIgualRefeito, " vivos iguais:", d[0].vivo === d[1].vivo);
        if (d[0].log !== d[1].log) console.log(d[0].log.slice(-600), "\n", d[1].log.slice(-600));
      }
      if (!iguais) {
        const d = await Promise.all([pa, pb].map(function (p) { return p.evaluate(function () { const x = window.ONLINE._depurar; return JSON.stringify({ n: x.log.length, ult: x.log.slice(-4), fila: x.fila }); }); }));
        console.log("   Ana:", d[0], "\n   Beto:", d[1]);
      }
      checar("jogada e botão ao mesmo tempo: os dois aparelhos acabam iguais", iguais);
      // quem chegou primeiro na nuvem vale: ou o bot fez o turno, ou Beto jogou (e deixou de estar parado)
      const depois = await pb.evaluate(function () { const e = window.__e(); return { vez: e.vez, eu: window.__humano(), turno: e.turno }; });
      const semBotao = await esperar(pa, function () { return !document.querySelector("#onBotParado"); }, null, 1500);
      checar("vale o que chegou primeiro (bot fez o turno, ou Beto jogou e o botão sumiu)", depois.vez !== depois.eu || depois.turno > antes || semBotao, JSON.stringify(depois));
    }

    // ---------- quem cai ----------
    console.log("\nQuem cai vira bot e volta");
    await pb.close(); // Beto fecha o app
    await esperar(pa, function () { return document.body.innerText.indexOf("desconectado") >= 0; }, null, 15000);
    checar("os outros veem que Beto caiu", (await pa.$eval("#players", function (e) { return e.innerText; })).indexOf("desconectado") >= 0);
    // a partida anda sozinha: na vez do Beto, o bot joga depois da espera
    const turnoAntes = await pa.evaluate(function () { return window.__e().turno; });
    let andou = false;
    for (let k = 0; k < 6 && !andou; k++) {
      const p = await ateVezDeHumano([pa], 40000);
      if (!p) break;
      await jogarMinhaVez(pa);
      andou = await esperar(pa, function (t) { return window.__e().turno > t + 1 || window.__e().vencedor !== null; }, turnoAntes, 1000);
    }
    checar("com Beto fora, o bot joga por ele e a partida segue", andou || await pa.evaluate(function (t) { return window.__e().turno > t; }, turnoAntes));
    // Beto abre o app de novo: volta sozinho para a partida
    const pb2 = await B.abrir();
    checar("Beto volta e fica com a mesma partida", await esperar(pb2, function () { return !!window.__e && !!window.__e(); }) && await sincronizar([pa, pb2], 20000));
    await esperar(pa, function () { return document.getElementById("players").innerText.indexOf("desconectado") === -1; }, null, 10000);
    checar("Beto aparece conectado de novo", (await pa.$eval("#players", function (e) { return e.innerText; })).indexOf("desconectado") === -1);
    const pVez = await ateVezDeHumano([pa, pb2]);
    if (pVez) await jogarMinhaVez(pVez);
    checar("depois de voltar, as jogadas seguem iguais", await sincronizar([pa, pb2]));
    // Beto sai de propósito (Novo jogo → Sair): não volta sozinho, mas a tela de início oferece voltar
    if (await pb2.evaluate(function () { return window.__e().vencedor === null; })) {
      await pb2.evaluate(function () { document.getElementById("newGame").click(); });
      await pb2.click("#saidaSair");
      await pb2.close();
      const pb3 = await B.abrir();
      const temVoltar = !!(await pb3.$("#onVoltarPartida"));
      checar("quem saiu de propósito vê 'Voltar para a partida online' no início", temVoltar && !(await pb3.evaluate(function () { return !!window.__e(); })));
      if (temVoltar) await pb3.click("#onVoltarPartida");
      checar("e volta para a mesma partida", await esperar(pb3, function () { return !!window.__e && !!window.__e(); }) && await sincronizar([pa, pb3], 20000));
    } else console.log("   (a partida já acabou: pulando o teste de sair e voltar)");
    checar("nenhum erro no console (partida online)", A.erros.length === 0 && B.erros.length === 0, A.erros.concat(B.erros).join(" | "));

    // ---------- Equipes montadas na sala ----------
    console.log("\nEquipes montadas na sala");
    const E1 = await aparelho(browser), E2 = await aparelho(browser);
    const se = await criarSala(E1, "Caio");
    const pe1 = se.p, pe2 = await entrarPeloConvite(E2, se.codigo, "Duda");
    await pe1.click('.modoOpcao[data-modo="equipes"]');
    await esperar(pe1, function () { return document.querySelectorAll(".salaEq").length === 4; });
    checar("Equipes com 4 lugares: letras de equipe para quem criou", (await pe1.$$(".salaEq")).length === 4);
    // Caio (lugar 0) e Duda (lugar 1) na mesma equipe A; bots nos lugares 2 e 3 na B
    const letras = async function () { return pe1.$$eval(".salaEq", function (x) { return x.map(function (b) { return b.textContent; }).join(""); }); };
    for (let g = 0; g < 6 && (await letras()) !== "AABB"; g++) {
      const l = await letras();
      const alvo = ["A", "A", "B", "B"];
      const i = l.split("").findIndex(function (c, k) { return c !== alvo[k]; });
      await pe1.click('.salaEq[data-i="' + i + '"]');
      await pe1.waitForTimeout(300);
    }
    checar("quem criou monta as equipes tocando nas letras", (await letras()) === "AABB", await letras());
    await pe1.click("#salaComecar");
    await esperar(pe2, function () { return !!window.__e && !!window.__e(); });
    const eqs = await pe2.evaluate(function () {
      const e = window.__e();
      const eq = function (nome) { return e.jogadores.filter(function (j) { return j.nome === nome; })[0].equipe; };
      return { caio: eq("Caio"), duda: eq("Duda"), alterna: e.jogadores.map(function (j) { return j.equipe; }).join("") };
    });
    checar("Caio e Duda juntos, vezes alternando as equipes", eqs.caio === eqs.duda && (eqs.alterna === "0101"), JSON.stringify(eqs));
    checar("Equipes: mesma partida nos dois aparelhos", await sincronizar([pe1, pe2]));

    // ---------- Grande Exército: escolher o reino ----------
    console.log("\nGrande Exército com reino escolhido");
    const G1 = await aparelho(browser), G2 = await aparelho(browser);
    const sg = await criarSala(G1, "Egil");
    const pg1 = sg.p, pg2 = await entrarPeloConvite(G2, sg.codigo, "Fion");
    await pg1.click('.modoOpcao[data-modo="grande"]');
    await esperar(pg1, function () { return document.querySelectorAll(".salaLugar").length === 9; });
    checar("Grande Exército mostra os 9 reinos", (await pg1.$$(".salaLugar")).length === 9);
    await esperar(pg2, function () { return document.querySelectorAll(".salaSentar").length >= 7; });
    await pg2.click('.salaSentar[data-i="8"]'); // Fion senta em Ériu
    await esperar(pg1, function () { return document.querySelectorAll(".salaLugar")[8].innerText.indexOf("Fion") >= 0; });
    await pg1.click("#salaComecar");
    await esperar(pg2, function () { return !!window.__e && !!window.__e(); });
    const gi = await pg2.evaluate(function () { const e = window.__e(), j = e.jogadores[window.__humano()]; return { reino: j.reino, n: e.jogadores.length, nome: j.nome }; });
    checar("Fion joga com Ériu (9 lugares)", gi.reino === "Ériu" && gi.n === 9 && gi.nome === "Fion", JSON.stringify(gi));
    // Egil (Vikings) joga; os 7 reinos-bots jogam sozinhos até a vez do Fion
    const pv = await ateVezDeHumano([pg1]);
    if (pv) await jogarMinhaVez(pv);
    const chegouFion = await esperar(pg2, function () { const e = window.__e(); return e.vez === window.__humano() || e.vencedor !== null; }, null, 40000);
    checar("bots dos reinos jogam e a vez chega em Ériu", chegouFion);
    checar("Grande Exército: mesma partida nos dois aparelhos", await sincronizar([pg1, pg2]));
    await print(pg2, "online-grande");
    checar("nenhum erro no console (Equipes e Grande Exército)", E1.erros.concat(E2.erros, G1.erros, G2.erros).length === 0, E1.erros.concat(E2.erros, G1.erros, G2.erros).join(" | "));

    // ---------- celular deitado: a sala cabe ----------
    const M = await aparelho(browser, { width: 844, height: 390 });
    const salaM = await M.abrir();
    await salaM.click("#onJogarOnline");
    checar("entrada do online cabe no celular deitado", await salaM.evaluate(function () {
      const m = document.querySelector(".modalOnline"); return document.documentElement.scrollWidth <= innerWidth && m.getBoundingClientRect().height <= innerHeight;
    }));
  } catch (e) {
    console.log("ERRO:", e && e.stack || e);
    if (process.env.DEPURAR) [A_, B_].forEach(function (c, i) { if (c) console.log("   console", i, c.consoleTudo.slice(-15).join("\n   ")); });
    falhas++;
  } finally {
    if (browser) await browser.close();
    servidor.close();
    if (emu) emu.kill("SIGINT");
  }
  console.log(falhas ? "\n" + falhas + " FALHA(S)." : "\nRESULTADO: tudo certo.");
  process.exit(falhas ? 1 : 0);
})();
