/* ============================================================
   DOMINATION: BRITANNIA — ferramentas/teste-tela.js
   Teste da TELA num navegador de verdade (Chromium, via Playwright).
   Abre o jogo, joga um pouco e confere as partes principais.
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
const TIPOS = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png" };

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
    const modos = await p.$$eval(".modoOpcao b", function (x) { return x.map(function (e) { return e.textContent; }); });
    checar("tela de início mostra os 3 modos", modos.length === 3, modos.join(", "));
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

    // ---------- celular ----------
    console.log("\nCelular (390 x 844)");
    const c = await abrir(browser, { width: 390, height: 844 });
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
    checar("nenhum erro no console (celular)", c.erros.length === 0, c.erros.join(" | "));
  } finally {
    await browser.close();
    servidor.close();
  }
  console.log(falhas ? "\nRESULTADO: " + falhas + " checagem(ns) falharam." : "\nRESULTADO: tudo certo.");
  process.exit(falhas ? 1 : 0);
})().catch(function (err) { console.error(err); process.exit(1); });
