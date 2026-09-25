/* ============================================================
   DOMINATION: BRITANNIA — ferramentas/teste-tela.js
   Teste da TELA num navegador de verdade (Chromium, via Playwright).
   Abre o jogo, joga um pouco e confere as partes principais — inclusive
   os modos Grande Exército, Equipes e Partida Rápida.
   Rodar antes de entregar qualquer mudança na tela.

   Uso (na raiz do repositório):
       npm i playwright            (uma vez; no ambiente do Claude o Chromium
                                    já vem em /opt/pw-browsers)
       node ferramentas/teste-tela.js
       node ferramentas/teste-tela.js --prints   (salva prints em ferramentas/prints/)

   O script sobe um servidorzinho local só para o teste. Para testar,
   ele expõe o estado da partida (window.__e) numa cópia do telas.js
   servida só durante o teste — o arquivo real não é alterado.
   Termina com código 1 se alguma checagem falhar.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");

const RAIZ = path.join(__dirname, "..");
const PRINTS = process.argv.includes("--prints");
const PASTA_PRINTS = path.join(__dirname, "prints");
const TIPOS = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png",
  ".webmanifest": "application/manifest+json", ".webp": "image/webp" };
let versaoSW = null; // para simular uma versão nova do app no teste de atualização

let falhas = 0;
function checar(nome, ok, detalhe) {
  console.log((ok ? "  ok   " : "  FALHOU ") + nome + (detalhe !== undefined ? "  (" + detalhe + ")" : ""));
  if (!ok) falhas++;
}

// servidor local simples (o jogo usa ?v=N nos arquivos)
const servidor = http.createServer(function (req, res) {
  let arq = decodeURIComponent(req.url.split("?")[0]);
  if (arq === "/") arq = "/index.html";
  const f = path.join(RAIZ, arq);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  let corpo = fs.readFileSync(f);
  if (arq === "/sw.js" && versaoSW !== null) corpo = corpo.toString().replace(/const VERSAO = \d+;/, "const VERSAO = " + versaoSW + ";");
  if (arq === "/telas.js") {
    corpo = corpo.toString().replace("  instalarDefsCartas();",
      "  window.__e = function () { return estado; }; window.__render = function () { render(); };\n  instalarDefsCartas();");
  }
  res.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" });
  res.end(corpo);
});

async function abrir(browser, viewport) {
  const p = await browser.newPage({ viewport: viewport });
  p.erros = [];
  p.on("pageerror", function (e) { p.erros.push(e.message); });
  await p.route("**/fonts.googleapis.com/**", function (r) { return r.abort(); }); // sem internet no teste
  await p.goto("http://localhost:" + servidor.address().port + "/");
  await p.waitForTimeout(300);
  return p;
}
const disco2 = async function (pg, nome) {
  const nomes = await pg.$$eval(".node .terr", function (ts) { return ts.map(function (t) { return t.textContent; }); });
  return (await pg.$$(".node .disc"))[nomes.indexOf(nome)];
};
const print = async function (p, nome) { if (PRINTS) await p.screenshot({ path: path.join(PASTA_PRINTS, nome + ".png") }); };

(async function () {
  if (PRINTS) fs.mkdirSync(PASTA_PRINTS, { recursive: true });
  await new Promise(function (ok) { servidor.listen(0, ok); });
  const exe = ["/opt/pw-browsers/chromium"].find(function (c) { return fs.existsSync(c); });
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  try {
    // ---------- computador ----------
    console.log("\nComputador (1400 x 1000)");
    const p = await abrir(browser, { width: 1400, height: 1000 });
    const modosVisiveis = function (pg) {
      return pg.$$eval(".modoOpcao", function (x) { return x.filter(function (e) { return e.offsetParent !== null; }).map(function (e) { return e.dataset.modo; }); });
    };
    const modos = await modosVisiveis(p);
    checar("tela de início mostra os 6 modos (com 4 jogadores)", modos.length === 6, modos.join(", "));
    checar("aviso de © na tela de início", await p.$eval(".inicioCopy", function (e) {
      return e.offsetParent !== null && e.textContent.indexOf("© 2026 Kauã Felipe Gielow Camargo") === 0;
    }));
    await p.click("#advPlus");
    checar("com 5 jogadores o modo Equipes some", (await modosVisiveis(p)).indexOf("equipes") === -1);
    await p.click("#advPlus");
    await p.click('.modoOpcao[data-modo="equipes"]');
    const fmts = await p.$$eval(".formatoOpcao", function (b) { return b.map(function (x) { return x.textContent; }); });
    checar("com 6 jogadores, Equipes oferece 3×3 e 2×2×2", fmts.length === 2, fmts.join(" / "));
    await p.click("#advMinus"); await p.click("#advMinus");
    await p.click('.modoOpcao[data-modo="classico"]');
    await print(p, "01-inicio");
    await p.click("#startBtn"); await p.waitForTimeout(400);
    const e0 = await p.evaluate(function () { const e = window.__e(); return { modo: e.modo, obj: e.jogadores[0].objetivo && e.jogadores[0].objetivo.nome }; });
    checar("partida no Clássico com objetivo", e0.modo === "classico" && !!e0.obj, e0.obj);
    checar("objetivo aparece no painel", (await p.$eval("#objetivoBox", function (e) { return e.innerText; })).indexOf(e0.obj) >= 0);

    const nomes = await p.$$eval(".node .terr", function (ts) { return ts.map(function (t) { return t.textContent; }); });
    const disco = async function (n) { return (await p.$$(".node .disc"))[nomes.indexOf(n)]; };
    const fase = function () { return p.$eval("#phaseTag", function (e) { return e.textContent; }); };

    // reforço: toca na peça dos territórios destacados até abrir o ataque
    for (let k = 0; k < 80 && (await fase()) === "Reforço"; k++) {
      const dest = await p.$$eval("path.territorio", function (ps) { return ps.map(function (x, i) { return x.classList.contains("dest") ? i : -1; }).filter(function (i) { return i >= 0; }); });
      if (!dest.length) { await p.waitForTimeout(300); continue; }
      await (await p.$$(".node .disc"))[dest[0]].click({ force: true });
      await p.waitForTimeout(40);
    }
    await p.waitForTimeout(500);
    checar("reforço termina e abre o ataque", (await fase()) === "Ataque");
    await print(p, "02-ataque");

    // ataque com conquista garantida -> janela 1/2/3
    await p.evaluate(function () {
      const e = window.__e();
      e.territorios.Lundenburg.dono = 0; e.territorios.Lundenburg.exercitos = 15;
      e.territorios.Cent.dono = 1; e.territorios.Cent.exercitos = 1;
      window.__render();
    });
    await (await disco("Lundenburg")).click({ force: true }); await p.waitForTimeout(80);
    for (let i = 0; i < 12; i++) {
      await (await disco("Cent")).click({ force: true }); await p.waitForTimeout(900);
      if (await p.$eval("#overlay", function (e) { return e.classList.contains("on"); })) break;
    }
    const dadosVisiveis = await p.evaluate(function () {
      const d = document.getElementById("dice").getBoundingClientRect(), s = document.getElementById("boardScroll").getBoundingClientRect();
      return d.width > 0 && d.top >= s.top && d.bottom <= s.bottom;
    });
    const opcoes = await p.$$eval(".conqOpcao", function (b) { return b.map(function (x) { return x.textContent; }); });
    checar("janela da conquista oferece 1, 2 e 3", opcoes.join(",") === "1,2,3", opcoes.join(","));
    await print(p, "03-conquista");
    await p.click('.conqOpcao[data-n="2"]'); await p.waitForTimeout(200);
    checar("escolher 2 põe 2 exércitos no conquistado", (await p.evaluate(function () { return window.__e().territorios.Cent.exercitos; })) === 2);
    checar("dados apareceram dentro da área visível", dadosVisiveis);

    // troca obrigatória de cartas
    await p.evaluate(function () {
      const e = window.__e(); const meus = Object.keys(e.territorios).filter(function (t) { return e.territorios[t].dono === 0; });
      e.fase = "reforco"; e.reforcosPendentes = 3; e.reforco = { base: 3, porRegiao: {}, ordem: [] };
      e.jogadores[0].cartas = [{ t: meus[0], s: "espada" }, { t: meus[1], s: "escudo" }, { t: meus[2], s: "navio" }, { t: meus[3], s: "espada" }, { t: null, s: "coringa" }];
      window.__render();
    });
    const dest2 = await p.$$eval("path.territorio", function (ps) { return ps.map(function (x, i) { return x.classList.contains("dest") ? i : -1; }).filter(function (i) { return i >= 0; }); });
    await (await p.$$(".node .disc"))[dest2[0]].click({ force: true }); await p.waitForTimeout(300);
    checar("com 5 cartas abre a troca obrigatória", (await p.$eval(".modal h2", function (e) { return e.textContent; })) === "Troca obrigatória");
    await print(p, "04-troca");
    await p.click("#trocaMelhor"); await p.click("#trocaOk"); await p.waitForTimeout(300);
    const aposTroca = await p.evaluate(function () { const e = window.__e(); return { mao: e.jogadores[0].cartas.length, trocas: e.trocasFeitas }; });
    checar("troca feita (mão com 2, 1ª troca da mesa)", aposTroca.mao === 2 && aposTroca.trocas === 1, JSON.stringify(aposTroca));

    // zoom e painel
    const largura = function () { return p.evaluate(function () { return Math.round(document.getElementById("board").getBoundingClientRect().width); }); };
    const l0 = await largura(); await p.click("#zoomIn"); await p.click("#zoomIn"); const l1 = await largura();
    await p.click("#zoomOut"); await p.click("#zoomOut");
    checar("botões de zoom aumentam o mapa", l1 > l0, l0 + " -> " + l1);
    await p.click("#painelBtn"); await p.waitForTimeout(150);
    checar("botão Painel recolhe o painel", await p.$eval("#objetivoBox", function (e) { return getComputedStyle(e).display === "none"; }));
    await p.click("#painelBtn");

    // vitória no Clássico (forçada) mostra a janela com os objetivos
    await p.evaluate(function () { const e = window.__e(); e.vez = 1; declararVitoria(e, 1); window.__render(); });
    await p.waitForTimeout(1300);
    checar("janela de vitória revela os objetivos", (await p.$$(".objRev")).length === (await p.evaluate(function () { return window.__e().jogadores.length; })));
    await print(p, "05-vitoria");
    checar("nenhum erro no console (computador)", p.erros.length === 0, p.erros.join(" | "));

    // ---------- partida de verdade com bots (Domínio) ----------
    console.log("\nAlguns turnos contra bots (Domínio)");
    const q = await abrir(browser, { width: 1400, height: 1000 });
    await q.click('.modoOpcao[data-modo="dominio"]'); await q.click("#startBtn"); await q.waitForTimeout(300);
    for (let rodada = 0; rodada < 2; rodada++) {
      await q.evaluate(function () { const e = window.__e(); e.reforcosPendentes = 0; e.reforco = { base: 0, porRegiao: {}, ordem: [] }; e.fase = "ataque"; window.__render(); });
      const bt = await q.$('#actions button:has-text("Passar vez")'); if (bt) await bt.click();
      for (let w = 0; w < 80 && (await q.$eval("#turnWho", function (e) { return e.textContent; })) !== "Você"; w++) await q.waitForTimeout(250);
    }
    checar("bots jogam e a vez volta para você", (await q.$eval("#turnWho", function (e) { return e.textContent; })) === "Você");
    checar("nenhum erro no console (partida)", q.erros.length === 0, q.erros.join(" | "));

    // ---------- Grande Exército ----------
    console.log("\nGrande Exército");
    const g = await abrir(browser, { width: 1400, height: 1000 });
    await g.click('.modoOpcao[data-modo="grande"]');
    checar("no Grande Exército some o nº de adversários", await g.$eval("#advField", function (e) { return e.style.display === "none"; }));
    checar("escolha de lado com 9 opções", (await g.$$(".ladoOpcao")).length === 9);
    await g.click('.ladoOpcao[data-lado="Vikings"]');
    await print(g, "07-inicio-grande");
    await g.click("#startBtn"); await g.waitForTimeout(400);
    const eg = await g.evaluate(function () {
      const e = window.__e();
      return { n: e.jogadores.length, humano: e.jogadores[0].tipo, reino: e.jogadores[0].reino, pend: e.reforcosPendentes, mar: e.reforco.mar,
        eof: e.territorios.Eoforwic.exercitos, grant: e.territorios.Grantebrycge.exercitos, beb: e.territorios.Bebbanburg.exercitos };
    });
    checar("9 lugares, você nos Vikings, começo 7/3/2", eg.n === 9 && eg.humano === "humano" && eg.reino === "Vikings" && eg.eof === 7 && eg.grant === 3 && eg.beb === 2, JSON.stringify(eg));
    checar("reforço viking = 3 + 3 do mar", eg.pend === 6 && eg.mar === 3);
    checar("painel mostra o lado", (await g.$eval("#objetivoBox", function (e) { return e.innerText; })).indexOf("Vikings") >= 0);
    // posiciona até chegar no bolsão do mar e confere que só o litoral acende
    let viuMar = false, marSoLitoral = true;
    for (let k = 0; k < 20 && (await g.$eval("#phaseTag", function (e) { return e.textContent; })) === "Reforço"; k++) {
      const info = await g.evaluate(function () {
        const r = document.getElementById("reinf").textContent;
        const nomes = Array.from(document.querySelectorAll(".node .terr")).map(function (t) { return t.textContent; });
        const dest = Array.from(document.querySelectorAll("path.territorio")).map(function (x, i) { return x.classList.contains("dest") ? i : -1; }).filter(function (i) { return i >= 0; });
        return { mar: r.indexOf("mar") >= 0, dest: dest, litoral: dest.every(function (i) { return TERRITORIOS[nomes[i]].litoral; }) };
      });
      if (info.mar) { viuMar = true; if (!info.litoral) marSoLitoral = false; }
      if (!info.dest.length) { await g.waitForTimeout(300); continue; }
      await (await g.$$(".node .disc"))[info.dest[0]].click({ force: true });
      await g.waitForTimeout(40);
    }
    checar("bolsão do mar aparece e acende só o litoral", viuMar && marSoLitoral);
    await print(g, "08-grande");
    // vikings caem -> placar dos reinos
    await g.evaluate(function () {
      const e = window.__e();
      e.jogadores[3].pontos = 12; e.jogadores[4].pontos = 12; e.ultimoGolpe = 4;
      Object.keys(e.territorios).forEach(function (t) { if (e.territorios[t].dono === 0) e.territorios[t].dono = 3; });
      e.jogadores[0].vivo = false; finalizarGrande(e); window.__render();
    });
    await g.waitForTimeout(1300);
    const fimG = await g.evaluate(function () { return { linhas: document.querySelectorAll(".placar tr").length, txt: document.querySelector(".modal").innerText, venc: window.__e().vencedor }; });
    checar("vikings expulsos: placar dos 8 reinos e desempate pelo último golpe", fimG.linhas === 9 && fimG.venc === 4 && fimG.txt.indexOf("último território viking") >= 0, fimG.linhas + " linhas, vencedor " + fimG.venc);
    await print(g, "09-grande-fim");
    checar("nenhum erro no console (Grande Exército)", g.erros.length === 0, g.erros.join(" | "));

    // jogando com um reino: os bots (Vikings primeiro) jogam e a vez chega em você
    const g2 = await abrir(browser, { width: 1400, height: 1000 });
    await g2.click('.modoOpcao[data-modo="grande"]'); await g2.click('.ladoOpcao[data-lado="Mierce"]'); await g2.click("#startBtn");
    for (let w = 0; w < 80 && (await g2.$eval("#turnWho", function (e) { return e.textContent; })) !== "Você · Mierce"; w++) await g2.waitForTimeout(250);
    checar("como Mierce, a vez chega depois dos Vikings, East Engle e Northhymbre", (await g2.$eval("#turnWho", function (e) { return e.textContent; })) === "Você · Mierce" &&
      (await g2.evaluate(function () { return window.__e().vez; })) === 3);
    checar("placar de pontos na lista de jogadores", (await g2.$$eval(".prow .rg", function (x) { return x.filter(function (e) { return e.textContent.indexOf("pts") >= 0; }).length; })) === 8);
    checar("nenhum erro no console (Grande Exército com bots)", g2.erros.length === 0, g2.erros.join(" | "));

    // ---------- Equipes ----------
    console.log("\nEquipes");
    const eqp = await abrir(browser, { width: 1400, height: 1000 });
    await eqp.click('.modoOpcao[data-modo="equipes"]'); await eqp.click("#startBtn");
    for (let w = 0; w < 80 && (await eqp.$eval("#turnWho", function (e) { return e.textContent; })) !== "Você"; w++) await eqp.waitForTimeout(250);
    const ee = await eqp.evaluate(function () {
      const e = window.__e();
      const eu = e.jogadores.findIndex(function (j) { return j.tipo === "humano"; });
      const badges = Array.from(document.querySelectorAll(".eqBadge")).filter(function (b) { return b.style.display !== "none"; }).length;
      return { eu: eu, equipes: e.jogadores.map(function (j) { return j.equipe; }).join(""), badges: badges };
    });
    checar("2×2 com equipes alternadas (A, B, A, B)", ee.equipes === "0101", ee.equipes);
    checar("marquinha da equipe em todas as peças", ee.badges === 64, ee.badges);
    await print(eqp, "10-equipes");
    // atacar o parceiro é bloqueado
    const parceiro = await eqp.evaluate(function () {
      const e = window.__e(); const eu = e.jogadores.findIndex(function (j) { return j.tipo === "humano"; });
      const par = e.jogadores.findIndex(function (j) { return j.equipe === e.jogadores[eu].equipe && j.id !== eu; });
      e.fase = "ataque"; e.reforcosPendentes = 0; e.reforco = { base: 0, porRegiao: {}, ordem: [], mar: 0 };
      e.territorios.Lundenburg.dono = eu; e.territorios.Lundenburg.exercitos = 9;
      e.territorios.Cent.dono = par; e.territorios.Cent.exercitos = 1;
      window.__render(); return par;
    });
    await (await disco2(eqp, "Lundenburg")).click({ force: true }); await eqp.waitForTimeout(80);
    await (await disco2(eqp, "Cent")).click({ force: true }); await eqp.waitForTimeout(200);
    const aposParceiro = await eqp.evaluate(function () { return { dono: window.__e().territorios.Cent.dono, toast: document.getElementById("toast").textContent }; });
    checar("não dá para atacar o parceiro", aposParceiro.dono === parceiro && aposParceiro.toast.indexOf("parceiro") >= 0, aposParceiro.toast);
    await eqp.evaluate(function () { const e = window.__e(); declararVitoria(e, e.vez, { motivo: "equipeRegioes" }); window.__render(); });
    await eqp.waitForTimeout(1300);
    checar("vitória mostra a equipe", /Equipe [AB]|sua equipe/.test(await eqp.$eval(".modal", function (e) { return e.innerText; })));
    checar("nenhum erro no console (Equipes)", eqp.erros.length === 0, eqp.erros.join(" | "));

    // ---------- Partida Rápida ----------
    console.log("\nPartida Rápida");
    const r = await abrir(browser, { width: 1400, height: 1000 });
    await r.click('.modoOpcao[data-modo="rapida"]'); await r.click("#startBtn"); await r.waitForTimeout(300);
    checar("fase mostra a rodada (1 de 15)", (await r.$eval("#phaseTag", function (e) { return e.textContent; })).indexOf("Rodada 1 de 15") >= 0);
    checar("painel mostra seus pontos", (await r.$eval("#objetivoBox", function (e) { return e.innerText; })).indexOf("Seus pontos") >= 0);
    await r.evaluate(function () { finalizarRapida(window.__e()); window.__render(); });
    await r.waitForTimeout(1300);
    checar("fim das rodadas mostra o placar", (await r.$$(".placar tr")).length === 5);
    await print(r, "11-rapida-fim");
    checar("nenhum erro no console (Partida Rápida)", r.erros.length === 0, r.erros.join(" | "));

    // ---------- celular em pé: aviso de girar ----------
    console.log("\nCelular em pé (390 x 844)");
    const cp = await abrir(browser, { width: 390, height: 844 });
    checar("aviso 'Gire o celular' cobre a tela", await cp.evaluate(function () {
      const a = document.getElementById("gireAviso"), r = a.getBoundingClientRect();
      return getComputedStyle(a).display !== "none" && r.width >= innerWidth && r.height >= innerHeight;
    }));
    await print(cp, "13-celular-em-pe");

    // ---------- celular deitado ----------
    console.log("\nCelular deitado (844 x 390)");
    const cd = await abrir(browser, { width: 844, height: 390 });
    checar("sem aviso de girar quando deitado", await cd.$eval("#gireAviso", function (a) { return getComputedStyle(a).display === "none"; }));
    checar("janela de início rola e cabe na altura", await cd.evaluate(function () {
      const m = document.querySelector(".modalInicio"), r = m.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight + 1 && m.scrollHeight > m.clientHeight;
    }));
    await print(cd, "14-deitado-inicio");
    await cd.click("#startBtn"); await cd.waitForTimeout(400);
    const dl = await cd.evaluate(function () {
      const pn = document.getElementById("panel"), bs = document.getElementById("boardScroll"), h = document.querySelector("header");
      const rp = pn.getBoundingClientRect(), rb = bs.getBoundingClientRect();
      const internas = Array.from(pn.children).filter(function (x) { const o = getComputedStyle(x).overflowY; return o === "auto" || o === "scroll"; }).length;
      return { lado: rp.left >= rb.right - 1 && rb.width > rp.width * 1.8, cab: h.scrollWidth <= h.clientWidth && h.getBoundingClientRect().height <= 44,
        pagina: document.documentElement.scrollWidth <= innerWidth, internas: internas, rola: getComputedStyle(pn).overflowY === "auto" };
    });
    checar("mapa à esquerda, painel à direita", dl.lado);
    checar("cabeçalho baixo e cabe na largura", dl.cab);
    checar("página não rola para o lado (deitado)", dl.pagina);
    checar("painel rola como uma página só (deitado)", dl.rola && dl.internas === 0, dl.internas + " rolagens internas");
    await print(cd, "15-deitado-jogo");
    checar("nenhum erro no console (deitado)", cd.erros.length === 0, cd.erros.join(" | "));

    // ---------- tablet em pé (layout de coluna, como antes) ----------
    console.log("\nTablet em pé (768 x 1024)");
    const c = await abrir(browser, { width: 768, height: 1024 });
    await c.click("#startBtn"); await c.waitForTimeout(400);
    const cel = await c.evaluate(function () {
      const pn = document.getElementById("panel"), h = document.querySelector("header");
      const internas = Array.from(pn.children).filter(function (x) { const o = getComputedStyle(x).overflowY; return o === "auto" || o === "scroll"; }).length;
      return { cab: h.scrollWidth <= h.clientWidth, meio: Math.abs(pn.getBoundingClientRect().height - innerHeight / 2) <= 2, internas: internas, pagina: document.documentElement.scrollWidth <= innerWidth };
    });
    checar("cabeçalho cabe na largura", cel.cab);
    checar("página não rola para o lado", cel.pagina);
    checar("painel aberto ocupa metade da tela", cel.meio);
    checar("painel rola como uma página só", cel.internas === 0, cel.internas + " rolagens internas");
    await print(c, "06-celular");
    checar("nenhum erro no console (tablet)", c.erros.length === 0, c.erros.join(" | "));
    const c2 = await abrir(browser, { width: 844, height: 390 });
    await c2.click('.modoOpcao[data-modo="grande"]');
    checar("início do Grande Exército cabe no celular deitado", await c2.evaluate(function () { return document.documentElement.scrollWidth <= innerWidth; }));
    await print(c2, "12-celular-grande");

    // ---------- app: instalável, sem internet e atualização ----------
    console.log("\nApp (PWA)");
    const vIndex = Number((fs.readFileSync(path.join(RAIZ, "index.html"), "utf8").match(/\?v=(\d+)/) || [])[1]);
    const vSW = Number((fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8").match(/const VERSAO = (\d+);/) || [])[1]);
    checar("VERSAO do sw.js igual ao ?v= do index.html", vIndex > 0 && vIndex === vSW, vIndex + " / " + vSW);
    const man = JSON.parse(fs.readFileSync(path.join(RAIZ, "manifest.webmanifest"), "utf8"));
    checar("manifesto: deitado, tela cheia e ícones que existem", man.orientation === "landscape" && man.display === "fullscreen" &&
      man.icons.length >= 4 && man.icons.every(function (i) { return fs.existsSync(path.join(RAIZ, i.src)); }));
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
    const a = await ctx.newPage(); a.erros = [];
    a.on("pageerror", function (e) { a.erros.push(e.message); });
    await a.route("**/fonts.googleapis.com/**", function (r) { return r.abort(); });
    const base = "http://localhost:" + servidor.address().port + "/";
    await a.goto(base);
    await a.evaluate(function () { return navigator.serviceWorker.ready; });
    await a.reload(); await a.waitForTimeout(500);
    const guardados = await a.evaluate(async function () {
      const nomes = await caches.keys(); const c = await caches.open(nomes[0]);
      return { nomes: nomes, n: (await c.keys()).length, controla: !!navigator.serviceWorker.controller };
    });
    checar("service worker guarda os arquivos do jogo", guardados.controla && guardados.n >= 17, JSON.stringify(guardados));
    await ctx.setOffline(true);
    await a.reload(); await a.waitForTimeout(500);
    checar("sem internet o jogo abre", (await a.$$(".modoOpcao")).length === 6);
    await a.click("#startBtn"); await a.waitForTimeout(300);
    checar("sem internet dá para começar partida", (await a.$eval("#phaseTag", function (e) { return e.textContent; })) === "Reforço");
    await ctx.setOffline(false);
    // simula uma versão nova publicada: o aviso aparece e, ao tocar, atualiza
    versaoSW = vSW + 1;
    await a.evaluate(function () { return navigator.serviceWorker.getRegistration().then(function (r) { return r.update(); }); });
    for (let w = 0; w < 40 && (await a.$eval("#atualizaBanner", function (b) { return b.hidden; })); w++) await a.waitForTimeout(150);
    const txt = await a.$eval("#atualizaBanner", function (b) { return b.hidden ? "" : b.innerText; });
    checar("aviso 'Nova versão disponível' aparece", txt.indexOf("Nova versão disponível") >= 0 && txt.indexOf("recomeça") >= 0, txt.replace(/\n/g, " "));
    await print(a, "16-aviso-versao");
    await Promise.all([a.waitForEvent("load"), a.click("#atualizaBanner")]);
    await a.waitForTimeout(400);
    const depois = await a.evaluate(function () { return caches.keys(); });
    checar("tocar no aviso atualiza (só a versão nova guardada)", depois.length === 1 && depois[0] === "britannia-v" + versaoSW, depois.join(","));
    checar("nenhum erro no console (app)", a.erros.length === 0, a.erros.join(" | "));
    versaoSW = null;
    await ctx.close();
  } finally {
    await browser.close();
    servidor.close();
  }
  console.log(falhas ? "\nRESULTADO: " + falhas + " checagem(ns) falharam." : "\nRESULTADO: tudo certo.");
  process.exit(falhas ? 1 : 0);
})().catch(function (err) { console.error(err); process.exit(1); });
