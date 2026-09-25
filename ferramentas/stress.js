/* ============================================================
   DOMINATION: BRITANNIA — ferramentas/stress.js
   Stress dos bots: joga milhares de partidas só de bots e confere
   que todas terminam, sem erro, e que as regras se mantêm.
   Rodar SEMPRE depois de mexer em motor.js, bots.js ou nas
   vizinhanças de mapa.js.

   Uso (na raiz do repositório):
       node ferramentas/stress.js                  (3.000 partidas em cada modo)
       node ferramentas/stress.js 500              (500 por modo)
       node ferramentas/stress.js 3000 classico    (só um modo)

   Confere, a cada turno: total de 66 cartas (baralho + descarte + mãos).
   No Clássico: objetivos diferentes para cada jogador e o vencedor
   realmente cumpriu o objetivo (ou é o último de pé).
   Termina com código 1 se houver qualquer falha (bom para automação).
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.join(__dirname, "..");
const ctx = vm.createContext({ console: console, Math: Math });
for (const f of ["mapa.js", "motor.js", "bots.js"]) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, f), "utf8"), ctx, { filename: f });
}
// funções/constantes do jogo, vistas daqui (const/let não viram globais no vm)
const J = vm.runInContext(`({ criarPartida, jogarTurnoBot, jogadoresVivos, verificarVitoria,
  objetivoCumprido, descreverObjetivo, MODOS })`, ctx);

const PARTIDAS = Number(process.argv[2]) || 3000;
const MODOS = process.argv[3] ? [process.argv[3]] : Object.keys(J.MODOS);
const LIMITE_TURNOS = 8000;
const TOTAL_CARTAS = 66;
let problemas = 0;

for (const modo of MODOS) {
  let ok = 0, falhas = 0, turnos = 0, maxT = 0, quebras = 0, ultimoDePe = 0;
  const porObjetivo = {};
  for (let g = 0; g < PARTIDAS; g++) {
    const n = 2 + (g % 5); // 2 a 6 jogadores
    const jogadores = [];
    for (let i = 0; i < n; i++) jogadores.push({ nome: "Bot " + i, tipo: "bot" });
    const e = J.criarPartida(jogadores, { modo: modo });
    if (modo === "classico" && new Set(e.jogadores.map(function (j) { return j.objetivo.id; })).size !== n) quebras++;
    let t = 0;
    try {
      while (e.vencedor === null && t < LIMITE_TURNOS) {
        J.jogarTurnoBot(e); t++;
        const cartas = e.baralho.length + e.descarte.length + e.jogadores.reduce(function (s, j) { return s + j.cartas.length; }, 0);
        if (cartas !== TOTAL_CARTAS) quebras++;
      }
    } catch (err) {
      falhas++;
      if (falhas <= 3) console.log("ERRO:", err.stack);
      continue;
    }
    if (e.vencedor === null) { falhas++; continue; }
    ok++; turnos += t; maxT = Math.max(maxT, t);
    const sozinho = J.jogadoresVivos(e).length === 1;
    if (sozinho && !J.verificarVitoria(e, e.vencedor)) ultimoDePe++;
    if (modo === "classico") {
      if (!sozinho && !J.objetivoCumprido(e, e.vencedor)) quebras++;
      const d = J.descreverObjetivo(e, e.vencedor);
      const k = d.reserva ? "(reserva) Bretwalda" : e.jogadores[e.vencedor].objetivo.nome;
      porObjetivo[k] = (porObjetivo[k] || 0) + 1;
    }
  }
  problemas += falhas + quebras;
  console.log("\n[" + J.MODOS[modo].nome + "] " + ok + "/" + PARTIDAS + " partidas ok · falhas: " + falhas +
    " · quebras de regra: " + quebras + " · média " + (turnos / Math.max(ok, 1)).toFixed(1) +
    " turnos (máx " + maxT + ") · vitórias por último de pé: " + ultimoDePe);
  if (modo === "classico") {
    console.log("vitórias por objetivo:", Object.entries(porObjetivo).sort(function (a, b) { return b[1] - a[1]; })
      .map(function (p) { return p[0] + " " + p[1]; }).join(" · "));
  }
}
console.log(problemas ? "\nRESULTADO: HÁ PROBLEMAS (" + problemas + ")" : "\nRESULTADO: tudo certo, zero falhas.");
process.exit(problemas ? 1 : 0);
