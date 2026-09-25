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

   Confere, a cada turno: total de 66 cartas (baralho + descarte + mãos)
   e todo território com pelo menos 1 exército.
   No Clássico: objetivos diferentes para cada jogador e o vencedor
   realmente cumpriu o objetivo (ou é o último de pé).
   Na Partida Rápida: acaba até a 15ª rodada e vence quem tem mais pontos.
   No Grande Exército: 9 lugares, começo certo (vikings 5×7, East Engle 2×3,
   Northhymbre 6×2, resto 1), vitória viking com as 4 regiões ou vitória do
   reino vivo com mais pontos quando os vikings caem.
   No Equipes (4 jogadores 2×2; 6 jogadores 3×3 ou 2×2×2): vezes alternadas,
   ninguém mira o parceiro e a equipe vencedora tem 5 regiões (ou sobrou só ela).
   Sorte combinada (online): a cada 10 partidas, uma "gêmea" com a mesma
   semente é jogada pela lista de jogadas (aplicarAcao) e tem de terminar
   idêntica — é o que garante que todos os aparelhos veem a mesma partida.
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
  objetivoCumprido, descreverObjetivo, MODOS, pontosRapida, regioesDaEquipe, inimigosVizinhos,
  saoAliados, territoriosDe, ehViking, regioesDominadas, RODADAS_RAPIDA, META_VIKINGS, INICIO_VIKINGS, aplicarAcao, atacar, botAlvos, vizinhosDe })`, ctx);

const PARTIDAS = Number(process.argv[2]) || 3000;
const MODOS = process.argv[3] ? [process.argv[3]] : Object.keys(J.MODOS);
const LIMITE_TURNOS = 8000;
const TOTAL_CARTAS = 66;
let problemas = 0;

// Grande Exército: reino atacado por outro reino revida (e só contra quem o atacou).
if (MODOS.indexOf("grande") !== -1) {
  const e = J.criarPartida([], { modo: "grande" });
  const mierce = e.jogadores.filter(function (j) { return j.reino === "Mierce"; })[0].id;
  const wes = e.jogadores.filter(function (j) { return j.reino === "Westseaxe"; })[0].id;
  const cym = e.jogadores.filter(function (j) { return j.reino === "Cymru"; })[0].id;
  // um território de Westseaxe vizinho de Mierce ataca
  const par = Object.keys(e.territorios).map(function (t) {
    return e.territorios[t].dono === wes ? [t, J.vizinhosDe(t).filter(function (v) { return e.territorios[v].dono === mierce; })[0]] : null;
  }).filter(function (x) { return x && x[1]; })[0];
  const antes = Object.keys(e.territorios).some(function (t) { return e.territorios[t].dono === mierce && J.botAlvos(e, mierce, t).some(function (v) { return e.territorios[v].dono === wes; }); });
  e.vez = wes; e.fase = "ataque"; e.territorios[par[0]].exercitos = 30;
  J.atacar(e, par[0], par[1], {});
  const depois = Object.keys(e.territorios).some(function (t) { return e.territorios[t].dono === mierce && J.botAlvos(e, mierce, t).some(function (v) { return e.territorios[v].dono === wes; }); });
  const outro = Object.keys(e.territorios).some(function (t) { return e.territorios[t].dono === mierce && J.botAlvos(e, mierce, t).some(function (v) { return e.territorios[v].dono === cym; }); });
  const ok = !antes && depois && !outro && e.jogadores[mierce].revide.join() === String(wes);
  console.log("\n[Grande Exército] revide: " + (ok ? "ok (Mierce atacado por Westseaxe revida só contra Westseaxe)" : "QUEBRA"));
  if (!ok) problemas++;
}

for (const modo of MODOS) {
  let ok = 0, falhas = 0, turnos = 0, maxT = 0, quebras = 0, ultimoDePe = 0, gemeas = 0;
  const porObjetivo = {}, porVencedor = {};
  const quebra = function (msg) { quebras++; if (quebras <= 5) console.log("QUEBRA [" + modo + "]:", msg); };
  for (let g = 0; g < PARTIDAS; g++) {
    // 2 a 6 jogadores; Grande Exército sempre 9; Equipes: 2×2, 3×3 ou 2×2×2
    const n = modo === "grande" ? 9 : modo === "equipes" ? [4, 6, 6][g % 3] : 2 + (g % 5);
    const tam = modo === "equipes" && g % 3 === 1 ? 3 : 2;
    const jogadores = [];
    for (let i = 0; i < n; i++) jogadores.push({ nome: "Bot " + i, tipo: "bot" });
    const e = J.criarPartida(jogadores, { modo: modo, tamanhoEquipe: tam });
    if (e.modo !== modo || e.jogadores.length !== n) quebra("modo ou nº de jogadores errado");
    if (modo === "grande") {
      const conta = {};
      Object.keys(e.territorios).forEach(function (t) {
        const d = e.territorios[t], k = e.jogadores[d.dono].reino + "×" + d.exercitos;
        conta[k] = (conta[k] || 0) + 1;
      });
      if (conta["Vikings×7"] !== 5 || conta["East Engle×3"] !== 2 || conta["Northhymbre×2"] !== 6 ||
          conta["Mierce×1"] !== 9 || conta["Ériu×1"] !== 14 || e.reforcosPendentes !== 6)
        quebra("começo do Grande Exército: " + JSON.stringify(conta));
    }
    if (modo === "equipes") {
      const nEq = n / tam;
      if (e.jogadores.some(function (j) { return j.equipe !== j.id % nEq; })) quebra("equipes não alternam");
    }
    if (modo === "classico" && new Set(e.jogadores.map(function (j) { return j.objetivo.id; })).size !== n) quebra("objetivos repetidos");
    // Rixa de Sangue só contra cor presente na partida.
    if (modo === "classico" && e.jogadores.some(function (j) {
      return j.objetivo.tipo === "destruir" && j.objetivo.alvo >= n;
    })) quebra("Rixa contra cor ausente");
    // gêmea: mesma semente, jogada como lista de jogadas (como no online)
    const gemea = g % 10 === 0 ? J.criarPartida(jogadores, { modo: modo, tamanhoEquipe: tam, semente: e.semente }) : null;
    if (gemea && JSON.stringify(gemea) !== JSON.stringify(e)) quebra("mesma semente, começo diferente");
    let t = 0;
    try {
      while (e.vencedor === null && t < LIMITE_TURNOS) {
        J.jogarTurnoBot(e); t++;
        if (gemea) J.aplicarAcao(gemea, { t: "bot", a: gemea.vez });
        const cartas = e.baralho.length + e.descarte.length + e.jogadores.reduce(function (s, j) { return s + j.cartas.length; }, 0);
        if (cartas !== TOTAL_CARTAS) quebra("cartas: " + cartas);
        if (Object.keys(e.territorios).some(function (x) { return e.territorios[x].exercitos < 1; })) quebra("território vazio");
        if (modo === "equipes" && Object.keys(e.territorios).some(function (x) {
          return J.inimigosVizinhos(e, x).some(function (v) { return J.saoAliados(e, e.territorios[x].dono, e.territorios[v].dono); });
        })) quebra("parceiro aparece como inimigo");
        if (modo === "rapida" && e.turno > J.RODADAS_RAPIDA) quebra("passou de 15 rodadas");
      }
    } catch (err) {
      falhas++;
      if (falhas <= 3) console.log("ERRO:", err.stack);
      continue;
    }
    if (e.vencedor === null) { falhas++; continue; }
    if (gemea) { gemeas++; if (JSON.stringify(gemea) !== JSON.stringify(e)) quebra("mesma semente e mesmas jogadas, partida diferente"); }
    ok++; turnos += t; maxT = Math.max(maxT, t);
    const sozinho = J.jogadoresVivos(e).length === 1;
    const motivo = e.resultado && e.resultado.motivo;
    if (motivo === "ultimo") ultimoDePe++;
    if (motivo === "ultimo" && !J.jogadoresVivos(e).every(function (j) {
      return j.id === e.vencedor || J.saoAliados(e, j.id, e.vencedor);
    })) quebra("último de pé com adversário vivo");
    if (modo === "rapida" && motivo !== "ultimo") {
      const vivos = J.jogadoresVivos(e);
      const max = Math.max.apply(null, vivos.map(function (j) { return J.pontosRapida(e, j.id); }));
      if (motivo !== "rapida" || J.pontosRapida(e, e.vencedor) !== max) quebra("vencedor da Partida Rápida sem mais pontos");
    }
    if (modo === "grande") {
      const v = e.jogadores[e.vencedor];
      const k = v.reino === "Vikings" ? "Vikings" : "reino (" + (motivo === "reinos" ? "pontos" : motivo) + ")";
      porVencedor[k] = (porVencedor[k] || 0) + 1;
      if (motivo === "vikings") {
        const dom = J.regioesDominadas(e, e.vencedor);
        if (!J.ehViking(e, e.vencedor) || !J.META_VIKINGS.every(function (r) { return dom.indexOf(r) !== -1; })) quebra("vitória viking sem as 4 regiões");
      } else if (motivo === "reinos") {
        const vk = e.jogadores.filter(function (j) { return j.reino === "Vikings"; })[0];
        const vivos = J.jogadoresVivos(e);
        const max = Math.max.apply(null, vivos.map(function (j) { return j.pontos; }));
        if (vk.vivo || !v.vivo || J.ehViking(e, e.vencedor) || v.pontos !== max) quebra("vitória dos reinos errada");
      } else if (motivo !== "ultimo") quebra("motivo estranho: " + motivo);
    }
    if (modo === "equipes" && motivo !== "ultimo") {
      if (motivo !== "equipeRegioes" || J.regioesDaEquipe(e, e.jogadores[e.vencedor].equipe).length < 5) quebra("equipe venceu sem 5 regiões");
    }
    if (modo === "classico") {
      if (!sozinho && !J.objetivoCumprido(e, e.vencedor)) quebra("vencedor sem objetivo");
      const d = J.descreverObjetivo(e, e.vencedor);
      const k = d.reserva ? "(reserva) Bretwalda" : e.jogadores[e.vencedor].objetivo.nome;
      porObjetivo[k] = (porObjetivo[k] || 0) + 1;
    }
  }
  problemas += falhas + quebras;
  console.log("\n[" + J.MODOS[modo].nome + "] " + ok + "/" + PARTIDAS + " partidas ok · falhas: " + falhas +
    " · quebras de regra: " + quebras + " · média " + (turnos / Math.max(ok, 1)).toFixed(1) +
    " turnos (máx " + maxT + ") · vitórias por último de pé: " + ultimoDePe + " · gêmeas idênticas: " + gemeas);
  if (modo === "classico") {
    console.log("vitórias por objetivo:", Object.entries(porObjetivo).sort(function (a, b) { return b[1] - a[1]; })
      .map(function (p) { return p[0] + " " + p[1]; }).join(" · "));
  }
  if (modo === "grande") {
    console.log("vencedores:", Object.entries(porVencedor).sort(function (a, b) { return b[1] - a[1]; })
      .map(function (p) { return p[0] + " " + p[1]; }).join(" · "));
  }
}
console.log(problemas ? "\nRESULTADO: HÁ PROBLEMAS (" + problemas + ")" : "\nRESULTADO: tudo certo, zero falhas.");
process.exit(problemas ? 1 : 0);
