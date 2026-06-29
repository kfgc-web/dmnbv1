/* ============================================================
   DOMINATION: BRITÂNIA — telas.js (interface)
   Carregar DEPOIS de mapa.js + motor.js + bots.js.
   Contém: POSICOES (coordenadas conferidas) + a IIFE da tela.
   ============================================================ */
const POSICOES = {
  "Cornualha": [722,1164],
  "Devon": [722,1092],
  "Somerset": [727,996],
  "Gloucester": [786,989],
  "Hampshire": [796,1037],
  "Sussex": [867,1044],
  "Kent": [912,1018],
  "Essex": [919,959],
  "London": [863,986],
  "Norfolk": [903,863],
  "Suffolk": [940,907],
  "Cambridge": [886,897],
  "Peterborough": [823,838],
  "Northampton": [821,908],
  "Birmingham": [740,922],
  "Hereford": [652,902],
  "Chester": [617,799],
  "Derby": [697,846],
  "South York": [679,787],
  "Nottingham": [738,786],
  "Lincoln": [779,763],
  "Leicester": [768,860],
  "Gwynedd": [476,806],
  "Powys": [553,886],
  "Deheubarth": [539,942],
  "Gwent": [584,929],
  "Blackpool": [632,701],
  "Manchester": [670,722],
  "East York": [714,701],
  "North York": [642,609],
  "Newcastle": [623,490],
  "Alston": [615,525],
  "Edimburg": [604,389],
  "Lancashire": [576,522],
  "Hawick": [575,455],
  "Wigtown": [495,474],
  "Glascow": [555,372],
  "Derry": [291,548],
  "Omagh": [283,594],
  "Belfast": [363,546],
  "Ilha de Mann": [334,488],
  "Dundee": [627,315],
  "Stirling": [593,302],
  "Kilchomann": [570,267],
  "Glencoe": [581,184],
  "Inverness": [597,215],
  "Aberdeen": [624,259],
  "Gairloch": [600,126],
  "Stornoway": [629,66],
  "Kirkwall": [587,60],
  "Letterkenny": [240,573],
  "Sligo": [235,629],
  "Boyle": [268,680],
  "Dundalk": [324,651],
  "Dublin": [317,752],
  "Portlaoise": [202,798],
  "Kilkenny": [142,852],
  "Waterford": [89,873],
  "Cork": [60,849],
  "Limerick": [119,830],
  "Killarney": [85,814],
  "Ennis": [151,791],
  "Athlone": [228,745],
  "Castlebar": [217,685],
};
const VIEW_W=1000, VIEW_H=1300;
/* ============================================================
   WAR BRITÂNICO — TELAS (interface) — v1 tabuleiro esquemático
   Roda sobre mapa.js + motor.js + bots.js (já carregados acima)
   e sobre POSICOES (coordenadas verificadas).
   ============================================================ */
(function () {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const HUMANO = 0;             // assento 0 = jogador humano ("Você")
  const DELAY_BOT = 780;        // pausa entre turnos de bots (ms), p/ dar de ver
  const R_DISC = 17;            // raio do disco do território

  let estado = null;
  let selecao = null;           // território de origem selecionado
  let destinoSel = null;        // destino escolhido (remanejamento)
  let qtdMover = 1;
  let animando = false;         // true enquanto bots jogam (trava cliques)
  let zoom = 1;

  // refs de elementos SVG por território
  const elDisc = {}, elArmy = {}, elRing = {};

  // -------- util --------
  function E(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function corDe(t) { return estado.jogadores[estado.territorios[t].dono].cor; }
  function texto(t) { return estado.territorios[t]; }

  // texto preto ou branco conforme a cor de fundo
  function corTexto(hex) {
    const c = hex.replace("#", "");
    const r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b);
    return lum > 150 ? "#15110a" : "#ffffff";
  }

  // arestas únicas a partir do mapa
  function arestas() {
    const out = [], seen = {};
    Object.keys(TERRITORIOS).forEach(function (t) {
      vizinhosDe(t).forEach(function (v) {
        const key = [t, v].sort().join("|");
        if (!seen[key]) { seen[key] = 1; out.push([t, v]); }
      });
    });
    return out;
  }

  // convex hull (Andrew) + expansão a partir do centróide
  function hull(points) {
    const pts = points.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    if (pts.length < 3) return pts;
    const cross = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
    const lower = [];
    for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }
  function expandir(poly, pad) {
    const cx = poly.reduce(function (s, p) { return s + p[0]; }, 0) / poly.length;
    const cy = poly.reduce(function (s, p) { return s + p[1]; }, 0) / poly.length;
    return poly.map(function (p) {
      const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1;
      return [p[0] + dx / d * pad, p[1] + dy / d * pad];
    });
  }

  // -------- construção do tabuleiro (uma vez) --------
  function construir() {
    const svg = document.getElementById("board");
    svg.setAttribute("viewBox", "0 0 " + VIEW_W + " " + VIEW_H);
    svg.innerHTML = "";
    const gHull = E("g"), gEdge = E("g"), gNode = E("g");
    svg.appendChild(gHull); svg.appendChild(gEdge); svg.appendChild(gNode);

    // hulls das regiões + rótulo
    Object.keys(REGIOES).forEach(function (r) {
      const pts = territoriosDaRegiao(r).map(function (t) { return POSICOES[t]; });
      const poly = expandir(hull(pts), 30);
      if (poly.length >= 3) {
        const pl = E("polygon", { points: poly.map(function (p) { return p[0] + "," + p[1]; }).join(" "), class: "hull" });
        gHull.appendChild(pl);
      }
      const cx = pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length;
      const ys = pts.map(function (p) { return p[1]; });
      const topY = Math.min.apply(null, ys);
      const lab = E("text", { x: cx, y: topY - 30, class: "hullLabel" });
      lab.textContent = r + "  +" + bonusDaRegiao(r);
      gHull.appendChild(lab);
    });

    // arestas (terra/mar)
    arestas().forEach(function (e) {
      const a = POSICOES[e[0]], b = POSICOES[e[1]];
      const cls = ehLigacaoMaritima(e[0], e[1]) ? "edge sea" : "edge";
      gEdge.appendChild(E("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls }));
    });

    // nós
    Object.keys(TERRITORIOS).forEach(function (t) {
      const p = POSICOES[t];
      const g = E("g", { class: "node" });
      g.appendChild(E("circle", { class: "hit", cx: p[0], cy: p[1], r: R_DISC + 9 }));
      const ring = E("circle", { class: "ring", cx: p[0], cy: p[1], r: R_DISC + 5 });
      const disc = E("circle", { class: "disc", cx: p[0], cy: p[1], r: R_DISC });
      const army = E("text", { class: "army", x: p[0], y: p[1] });
      const terr = E("text", { class: "terr", x: p[0], y: p[1] + R_DISC + 11 });
      terr.textContent = t;
      g.appendChild(ring); g.appendChild(disc); g.appendChild(army); g.appendChild(terr);
      g.addEventListener("click", function () { onClick(t); });
      gNode.appendChild(g);
      elDisc[t] = disc; elArmy[t] = army; elRing[t] = ring;
    });
  }

  // -------- render (atualiza cores, números, destaques, painel) --------
  function render() {
    if (!estado) return;
    // nós
    Object.keys(TERRITORIOS).forEach(function (t) {
      const cor = corDe(t);
      elDisc[t].setAttribute("fill", cor);
      elArmy[t].setAttribute("fill", corTexto(cor));
      elArmy[t].textContent = texto(t).exercitos;
      elRing[t].setAttribute("class", "ring"); // limpa
    });
    // destaques
    if (selecao) {
      elRing[selecao].setAttribute("class", "ring origin");
      if (estado.fase === "ataque") {
        inimigosVizinhos(estado, selecao).forEach(function (v) { elRing[v].setAttribute("class", "ring target"); });
      } else if (estado.fase === "remanejamento") {
        vizinhosDe(selecao).forEach(function (v) {
          if (estado.territorios[v].dono === HUMANO) elRing[v].setAttribute("class", "ring dest");
        });
      }
    }
    renderPainel();
  }

  function renderPainel() {
    const j = estado.jogadores[estado.vez];
    document.getElementById("turnDot").style.background = j.cor;
    document.getElementById("turnWho").textContent = animando ? (j.nome + " está jogando…") : j.nome;

    const fases = { reforco: "Reforço", ataque: "Ataque", remanejamento: "Remanejamento", fim: "Fim de jogo" };
    document.getElementById("phaseTag").textContent = estado.vencedor !== null ? "Fim de jogo" : fases[estado.fase];

    const reinf = document.getElementById("reinf");
    const instr = document.getElementById("instr");
    const minhaVez = (estado.vez === HUMANO && !animando && estado.vencedor === null);

    reinf.innerHTML = "";
    if (minhaVez && estado.fase === "reforco") {
      reinf.innerHTML = "Reforços a posicionar: <b>" + estado.reforcosPendentes + "</b>";
    }

    if (estado.vencedor !== null) {
      instr.textContent = "";
    } else if (!minhaVez) {
      instr.textContent = "Aguarde — os outros comandantes estão movendo seus exércitos.";
    } else if (estado.fase === "reforco") {
      instr.textContent = "Toque nos seus territórios para distribuir os reforços.";
    } else if (estado.fase === "ataque") {
      instr.textContent = selecao
        ? "Atacando de " + selecao + ". Toque num vizinho inimigo destacado — ou toque " + selecao + " de novo para cancelar."
        : "Toque num território seu (2+ exércitos) que faça fronteira com inimigo para atacar a partir dele.";
    } else if (estado.fase === "remanejamento") {
      instr.textContent = selecao
        ? "Toque num vizinho SEU para onde mover a tropa."
        : "Opcional: toque num território seu (2+ exércitos) para mover tropa de lá para um vizinho seu.";
    }

    renderAcoes(minhaVez);
    renderMover(minhaVez);
    renderPlayers();
    renderLog();
  }

  function botao(label, cls, fn, disabled) {
    const b = document.createElement("button");
    b.textContent = label; if (cls) b.className = cls;
    if (disabled) b.disabled = true; else b.addEventListener("click", fn);
    return b;
  }

  function renderAcoes(minhaVez) {
    const box = document.getElementById("actions");
    box.innerHTML = "";
    if (!minhaVez) return;
    if (estado.fase === "reforco") {
      box.appendChild(botao("Terminar reforço", "primary", acaoTerminarReforco, estado.reforcosPendentes > 0));
    } else if (estado.fase === "ataque") {
      box.appendChild(botao("Terminar ataque", "", acaoTerminarAtaque));
      box.appendChild(botao("Passar vez", "ghost", acaoPassar));
    } else if (estado.fase === "remanejamento") {
      box.appendChild(botao("Passar vez", "primary", acaoPassar));
    }
  }

  function renderMover(minhaVez) {
    const box = document.getElementById("mover");
    if (minhaVez && estado.fase === "remanejamento" && selecao && destinoSel) {
      box.classList.add("on");
      document.getElementById("moverLbl").innerHTML =
        "Mover de <b>" + selecao + "</b> para <b>" + destinoSel + "</b>";
      document.getElementById("moverQty").textContent = qtdMover;
    } else {
      box.classList.remove("on");
    }
  }

  function renderPlayers() {
    const box = document.getElementById("players");
    box.innerHTML = "";
    resumoJogadores(estado).forEach(function (r) {
      const row = document.createElement("div");
      row.className = "prow" + (r.id === estado.vez && estado.vencedor === null ? " turn" : "") + (r.vivo ? "" : " dead");
      const dot = document.createElement("span"); dot.className = "dot"; dot.style.background = r.cor;
      const name = document.createElement("span"); name.className = "pname"; name.textContent = r.nome;
      const stat = document.createElement("span"); stat.className = "stat";
      stat.textContent = r.territorios + "⬡ · " + r.exercitos + "⚔";
      row.appendChild(dot); row.appendChild(name);
      if (r.regioes.length) {
        const rg = document.createElement("span"); rg.className = "rg"; rg.textContent = r.regioes.length + "/5";
        row.appendChild(rg);
      }
      row.appendChild(stat);
      box.appendChild(row);
    });
  }

  function renderLog() {
    const box = document.getElementById("log");
    box.innerHTML = "";
    estado.log.slice(-10).reverse().forEach(function (linha) {
      const d = document.createElement("div"); d.className = "logline"; d.textContent = linha;
      box.appendChild(d);
    });
  }

  // -------- cliques no território --------
  function onClick(t) {
    if (animando || estado.vencedor !== null) return;
    if (estado.jogadores[estado.vez].tipo !== "humano") return;
    if (estado.fase === "reforco") cliqueReforco(t);
    else if (estado.fase === "ataque") cliqueAtaque(t);
    else if (estado.fase === "remanejamento") cliqueRemanejo(t);
  }

  function cliqueReforco(t) {
    if (estado.territorios[t].dono !== HUMANO) return toast("Esse território não é seu.");
    const r = posicionarReforco(estado, t, 1);
    if (!r.ok) return toast(r.erro);
    render();
  }

  function cliqueAtaque(t) {
    const d = estado.territorios[t];
    if (selecao === null) {
      if (d.dono !== HUMANO) return toast("Escolha primeiro um território seu.");
      if (d.exercitos < 2) return toast("Precisa de 2+ exércitos para atacar.");
      if (inimigosVizinhos(estado, t).length === 0) return toast("Esse território não faz fronteira com inimigo.");
      selecao = t; render(); return;
    }
    if (t === selecao) { selecao = null; render(); return; }
    if (d.dono === HUMANO) {
      if (d.exercitos >= 2 && inimigosVizinhos(estado, t).length > 0) { selecao = t; render(); }
      else toast("Esse território não pode atacar agora.");
      return;
    }
    // inimigo
    if (vizinhosDe(selecao).indexOf(t) === -1) return toast("Não é vizinho de " + selecao + ".");
    executarAtaque(selecao, t);
  }

  function executarAtaque(origem, destino) {
    const r = atacar(estado, origem, destino);
    if (!r.ok) return toast(r.erro);
    mostrarDados(r, origem, destino);
    if (estado.vencedor !== null) { render(); setTimeout(mostrarVitoria, 900); return; }
    // mantém atacando da origem, se ainda der
    if (estado.territorios[origem].dono !== HUMANO || estado.territorios[origem].exercitos < 2) selecao = null;
    else selecao = origem;
    render();
  }

  function cliqueRemanejo(t) {
    const d = estado.territorios[t];
    if (estado.remanejouNesteTurno) return toast("Você já remanejou neste turno.");
    if (selecao === null) {
      if (d.dono !== HUMANO) return toast("Escolha um território seu de origem.");
      if (d.exercitos < 2) return toast("Sem tropa de sobra (precisa de 2+).");
      const temViz = vizinhosDe(t).some(function (v) { return estado.territorios[v].dono === HUMANO; });
      if (!temViz) return toast("Esse território não tem vizinho seu para receber tropa.");
      selecao = t; destinoSel = null; render(); return;
    }
    if (t === selecao) { selecao = null; destinoSel = null; render(); return; }
    if (d.dono !== HUMANO) return toast("Escolha um vizinho SEU.");
    if (vizinhosDe(selecao).indexOf(t) === -1) return toast("Não é vizinho de " + selecao + ".");
    destinoSel = t;
    qtdMover = estado.territorios[selecao].exercitos - 1; // padrão: leva tudo menos 1
    render();
  }

  // -------- botões de ação --------
  function acaoTerminarReforco() { const r = terminarReforco(estado); if (!r.ok) return toast(r.erro); selecao = null; render(); }
  function acaoTerminarAtaque() { const r = terminarAtaque(estado); if (!r.ok) return toast(r.erro); selecao = null; render(); }
  function acaoPassar() {
    selecao = null; destinoSel = null;
    const r = passarVez(estado); if (!r.ok) return toast(r.erro);
    depoisDoTurno();
  }

  // stepper do remanejamento
  function moverAjuste(delta) {
    const max = estado.territorios[selecao].exercitos - 1;
    qtdMover = Math.max(1, Math.min(max, qtdMover + delta));
    render();
  }
  function moverConfirmar() {
    const r = remanejar(estado, selecao, destinoSel, qtdMover);
    if (!r.ok) return toast(r.erro);
    selecao = null; destinoSel = null; render();
  }
  function moverCancelar() { destinoSel = null; render(); }

  // -------- fim de turno / bots --------
  function depoisDoTurno() {
    render();
    if (estado.vencedor !== null) { setTimeout(mostrarVitoria, 700); return; }
    if (estado.jogadores[estado.vez].tipo === "bot") rodarBots();
  }

  function snapshot() { const m = {}; Object.keys(estado.territorios).forEach(function (t) { m[t] = estado.territorios[t].dono; }); return m; }
  function flash(antes) {
    Object.keys(antes).forEach(function (t) {
      if (estado.territorios[t].dono !== antes[t]) {
        const disc = elDisc[t];
        try {
          disc.classList.remove("flash");
          void disc.getBBox(); // força reinício da animação
          disc.classList.add("flash");
          setTimeout(function () { disc.classList.remove("flash"); }, 700);
        } catch (e) { /* animação é só enfeite; nunca trava o jogo */ }
      }
    });
  }

  function rodarBots() {
    animando = true; selecao = null; destinoSel = null; render();
    function passo() {
      if (estado.vencedor !== null) { animando = false; render(); setTimeout(mostrarVitoria, 400); return; }
      if (estado.jogadores[estado.vez].tipo === "bot") {
        const antes = snapshot();
        jogarTurnoBot(estado);
        flash(antes);
        render();
        setTimeout(passo, DELAY_BOT);
      } else {
        animando = false; render(); // voltou pra você
      }
    }
    setTimeout(passo, 480);
  }

  // -------- dados (octógonos d8) --------
  function mostrarDados(r, origem, destino) {
    const box = document.getElementById("dice");
    const corA = estado.jogadores[estado.vez].cor;
    const corD = "#8a95a1";
    let html = '<div class="dside"><span class="cap">Ataque</span><div class="dice-row">';
    r.dadosAtaque.forEach(function (v, i) {
      html += '<span class="die' + (i > 2 ? " dim" : "") + '" style="background:' + corA + ';color:' + corTexto(corA) + '">' + v + "</span>";
    });
    html += '</div></div><span class="dvs">×</span><div class="dside"><span class="cap">Defesa</span><div class="dice-row">';
    r.dadosDefesa.forEach(function (v) {
      html += '<span class="die" style="background:' + corD + ';color:#15110a">' + v + "</span>";
    });
    html += "</div></div>";
    let res = "Você perdeu " + r.perdasAtacante + " · inimigo perdeu " + r.perdasDefensor;
    if (r.conquistou) res = '<span class="win">Conquistou ' + destino + "!</span>";
    html += '<div class="dres">' + res + "</div>";
    box.innerHTML = html;
    box.classList.add("on");
    clearTimeout(mostrarDados._t);
    mostrarDados._t = setTimeout(function () { box.classList.remove("on"); }, r.conquistou ? 1900 : 1500);
  }

  // -------- modais --------
  function mostrarInicio() {
    const ov = document.getElementById("overlay");
    ov.innerHTML =
      '<div class="modal">' +
        "<h2>War Britânico</h2>" +
        '<p class="lead">Conquiste a ilha. Cada território começa com 1 exército; no seu turno você recebe reforços, ataca e (se quiser) remaneja, depois passa a vez.</p>' +
        '<div class="rules">' +
          "Vença dominando <b>5 das 8 regiões</b> inteiras (ou sobrando o último de pé).<br>" +
          "Combate em <b>d8</b>: o ataque rola até <b>4</b> dados, a defesa até <b>3</b>; comparam-se os maiores e o <b>empate é da defesa</b>.<br>" +
          "Só ataca quem tem <b>2+</b> exércitos." +
        "</div>" +
        '<div class="field"><span class="flabel">Adversários (bots)</span>' +
          '<div class="stepper"><button class="iconbtn" id="advMinus">−</button>' +
          '<span class="qty" id="advQty">3</span>' +
          '<button class="iconbtn" id="advPlus">+</button></div>' +
        "</div>" +
        '<button class="primary" id="startBtn" style="width:100%">Começar</button>' +
      "</div>";
    ov.classList.add("on");
    let adv = 3;
    const q = ov.querySelector("#advQty");
    ov.querySelector("#advMinus").addEventListener("click", function () { adv = Math.max(1, adv - 1); q.textContent = adv; });
    ov.querySelector("#advPlus").addEventListener("click", function () { adv = Math.min(5, adv + 1); q.textContent = adv; });
    ov.querySelector("#startBtn").addEventListener("click", function () { novoJogo(adv); });
  }

  function mostrarVitoria() {
    const ov = document.getElementById("overlay");
    const v = estado.jogadores[estado.vencedor];
    const regs = regioesDominadas(estado, estado.vencedor);
    const chips = Object.keys(REGIOES).map(function (r) {
      const tem = regs.indexOf(r) !== -1;
      return '<span class="chip" style="' + (tem ? "" : "opacity:.35") + '">' + r + "</span>";
    }).join("");
    const venceu = estado.vencedor === HUMANO;
    ov.innerHTML =
      '<div class="modal">' +
        "<h2>" + (venceu ? "Vitória!" : v.nome + " venceu") + "</h2>" +
        '<p class="lead">' + (venceu
          ? "A ilha é sua, comandante. " : "Seu reino caiu. ") +
          v.nome + " controla " + territoriosDe(estado, estado.vencedor).length + " territórios e " +
          regs.length + " regiões inteiras.</p>" +
        '<div id="winRegions">' + chips + "</div>" +
        '<button class="primary" id="againBtn" style="width:100%">Jogar de novo</button>' +
      "</div>";
    ov.classList.add("on");
    ov.querySelector("#againBtn").addEventListener("click", mostrarInicio);
  }

  function novoJogo(nBots) {
    const jogadores = [{ nome: "Você", tipo: "humano" }];
    for (let i = 1; i <= nBots; i++) jogadores.push({ nome: "Bot " + i, tipo: "bot" });
    estado = criarPartida(jogadores);
    selecao = null; destinoSel = null; animando = false;
    document.getElementById("overlay").classList.remove("on");
    render();
    if (estado.jogadores[estado.vez].tipo === "bot") rodarBots();
  }

  // -------- toast --------
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg; el.classList.add("on");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("on"); }, 2200);
  }

  // -------- zoom --------
  function aplicarZoom() {
    document.getElementById("board").style.width = (zoom * 100) + "%";
  }

  // -------- ligações de UI --------
  function ligarUI() {
    document.getElementById("newGame").addEventListener("click", mostrarInicio);
    document.getElementById("zoomIn").addEventListener("click", function () { zoom = Math.min(3, zoom + 0.25); aplicarZoom(); });
    document.getElementById("zoomOut").addEventListener("click", function () { zoom = Math.max(1, zoom - 0.25); aplicarZoom(); });
    document.getElementById("moverMinus").addEventListener("click", function () { moverAjuste(-1); });
    document.getElementById("moverPlus").addEventListener("click", function () { moverAjuste(1); });
    document.getElementById("moverGo").addEventListener("click", moverConfirmar);
    document.getElementById("moverCancel").addEventListener("click", moverCancelar);
  }

  // -------- start --------
  construir();
  ligarUI();
  mostrarInicio();
})();
