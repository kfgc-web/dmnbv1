/* ============================================================
   DOMINATION: BRITANNIA — telas.js (interface)
   Carregar DEPOIS de mapa.js + motor.js + bots.js + desenho.js.
   Contém: POSICOES (lidas de desenho.js) + a IIFE da tela.
   ============================================================ */
// Onde fica a peça de cada território — calculado pelo gerador do mapa
// (ferramentas/gerar-mapa.js) e gravado em desenho.js.
const POSICOES = {};
Object.keys(DESENHO.territorios).forEach(function (t) {
  POSICOES[t] = [DESENHO.territorios[t].x, DESENHO.territorios[t].y];
});
const VIEW_W = DESENHO.largura, VIEW_H = DESENHO.altura;
/* ============================================================
   WAR BRITÂNICO — TELAS (interface) — v2 mapa desenhado (estilo WAR)
   Roda sobre mapa.js + motor.js + bots.js + desenho.js (já carregados)
   e sobre POSICOES (centro de cada território no desenho).
   ============================================================ */
(function () {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const HUMANO = 0;             // assento 0 = jogador humano ("Você")
  const DELAY_BOT = 780;        // pausa entre turnos de bots (ms), p/ dar de ver
  const R_DISC = 12;            // raio da peça (disco) do território

  let estado = null;
  let selecao = null;           // território de origem selecionado
  let destinoSel = null;        // destino escolhido (remanejamento)
  let qtdMover = 1;
  let animando = false;         // true enquanto bots jogam (trava cliques)
  let escolhendoConquista = false; // true entre a conquista e a janela de "quantos entram"
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

  // Bolsão de reforço ativo (Modo B): a primeira região da ordem que ainda tem
  // bônus a posicionar; se todas zeraram, o reforço-base GERAL; se acabou, null.
  function reforcoAtivo() {
    const rf = estado.reforco;
    if (!rf) return null;
    let regiao = null;
    (rf.ordem || []).some(function (r) {
      if ((rf.porRegiao[r] || 0) > 0) { regiao = r; return true; }
      return false;
    });
    if (regiao) return { modo: "regiao", regiao: regiao, qtd: rf.porRegiao[regiao] };
    if (rf.base > 0) return { modo: "geral", qtd: rf.base };
    return null;
  }

  // texto preto ou branco conforme a cor de fundo
  function corTexto(hex) {
    const c = hex.replace("#", "");
    const r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b);
    return lum > 150 ? "#15110a" : "#ffffff";
  }

  // Cor de cada região no tabuleiro (como os continentes do WAR).
  const COR_REGIAO = {
    "Ériu": "#46703f",
    "Dál Riata": "#2f6f6a",
    "Alba": "#5b5886",
    "Northhymbre": "#355f86",
    "Mierce": "#8a4f34",
    "East Engle": "#8a7a2e",
    "Westseaxe": "#9a6a2c",
    "Cymru": "#8a3d52",
  };
  const elTerr = {};            // polígono de cada território

  // -------- construção do tabuleiro (uma vez) --------
  function construir() {
    const svg = document.getElementById("board");
    svg.setAttribute("viewBox", "0 0 " + VIEW_W + " " + VIEW_H);
    svg.innerHTML = "";

    // recorte pelo litoral: tudo que é "terra" fica dentro dele
    const defs = E("defs");
    const clip = E("clipPath", { id: "recorteTerra" });
    clip.appendChild(E("path", { d: DESENHO.terra }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    // mar
    svg.appendChild(E("rect", { class: "mar", x: 0, y: 0, width: VIEW_W, height: VIEW_H }));
    // sombra da costa (dá relevo às ilhas)
    svg.appendChild(E("path", { class: "costaSombra", d: DESENHO.terra }));

    // territórios (pintados pela região) + divisas, tudo recortado pelo litoral
    const gTerra = E("g", { "clip-path": "url(#recorteTerra)" });
    gTerra.appendChild(E("path", { class: "chao", d: DESENHO.terra }));
    Object.keys(DESENHO.territorios).forEach(function (t) {
      const pl = E("path", { class: "territorio", d: DESENHO.territorios[t].d, fill: COR_REGIAO[regiaoDe(t)] });
      pl.addEventListener("click", function () { onClick(t); });
      gTerra.appendChild(pl);
      elTerr[t] = pl;
    });
    if (DESENHO.lagos) gTerra.appendChild(E("path", { class: "lago", d: DESENHO.lagos }));
    gTerra.appendChild(E("path", { class: "fronteira", d: DESENHO.fronteiras }));
    gTerra.appendChild(E("path", { class: "divisa", d: DESENHO.divisas }));
    svg.appendChild(gTerra);
    svg.appendChild(E("path", { class: "costa", d: DESENHO.terra }));

    // rotas marítimas (tracejadas, ligando as ilhas)
    const gRota = E("g");
    DESENHO.rotas.forEach(function (r) {
      const dx = r[4] - r[2], dy = r[5] - r[3], d = Math.hypot(dx, dy) || 1, ext = 10;
      gRota.appendChild(E("line", {
        class: "rota",
        x1: r[2] - dx / d * ext, y1: r[3] - dy / d * ext,
        x2: r[4] + dx / d * ext, y2: r[5] + dy / d * ext,
      }));
    });
    svg.appendChild(gRota);

    // nomes das regiões (no mar) + bônus
    Object.keys(REGIOES).forEach(function (r) {
      const p = DESENHO.rotulosRegiao[r];
      if (!p) return;
      const lab = E("text", { x: p[0], y: p[1], class: "rotuloRegiao" });
      lab.textContent = r;
      const bon = E("tspan", { class: "bonus", x: p[0], dy: 19 });
      bon.textContent = "+" + bonusDaRegiao(r) + " por turno";
      lab.appendChild(bon);
      svg.appendChild(lab);
    });

    // peças (exércitos) + nome do território
    const gNode = E("g");
    Object.keys(TERRITORIOS).forEach(function (t) {
      const p = POSICOES[t];
      const g = E("g", { class: "node" });
      g.appendChild(E("circle", { class: "hit", cx: p[0], cy: p[1], r: R_DISC + 9 }));
      const ring = E("circle", { class: "ring", cx: p[0], cy: p[1], r: R_DISC + 5 });
      const disc = E("circle", { class: "disc", cx: p[0], cy: p[1], r: R_DISC });
      const army = E("text", { class: "army", x: p[0], y: p[1] });
      const terr = E("text", { class: "terr", x: p[0], y: p[1] + R_DISC + 10 });
      terr.textContent = t;
      g.appendChild(ring); g.appendChild(disc); g.appendChild(army); g.appendChild(terr);
      g.addEventListener("click", function () { onClick(t); });
      gNode.appendChild(g);
      elDisc[t] = disc; elArmy[t] = army; elRing[t] = ring;
    });
    svg.appendChild(gNode);
    afastarNomes();
  }

  // Nome do território vai embaixo da peça; se bater em outro nome ou
  // noutra peça, sobe para cima dela.
  function afastarNomes() {
    const caixas = [];
    const F = 5; // folga entre caixas
    const bate = function (a, b) { return a.x - F < b.x + b.w && b.x - F < a.x + a.w && a.y - F < b.y + b.h && b.y - F < a.y + a.h; };
    Object.keys(POSICOES).forEach(function (t) {
      const p = POSICOES[t];
      caixas.push({ x: p[0] - R_DISC, y: p[1] - R_DISC, w: 2 * R_DISC, h: 2 * R_DISC, dono: t });
    });
    Object.keys(POSICOES).sort(function (a, b) { return POSICOES[a][1] - POSICOES[b][1]; }).forEach(function (t) {
      const el = elDisc[t].parentNode.querySelector(".terr");
      let bb;
      try { bb = el.getBBox(); } catch (e) { return; }
      if (!bb.width) return;
      const livre = function (c) { return !caixas.some(function (o) { return o.dono !== t && bate(c, o); }); };
      // tenta: embaixo, em cima, e as duas posições um pouco para os lados
      const yCima = POSICOES[t][1] - R_DISC - 6, dyCima = yCima - Number(el.getAttribute("y"));
      const opcoes = [[0, 0], [0, dyCima], [-12, 0], [12, 0], [-12, dyCima], [12, dyCima]];
      let c = null;
      for (let i = 0; i < opcoes.length && !c; i++) {
        const cand = { x: bb.x + opcoes[i][0], y: bb.y + opcoes[i][1], w: bb.width, h: bb.height, dono: t };
        if (livre(cand)) {
          c = cand;
          el.setAttribute("x", POSICOES[t][0] + opcoes[i][0]);
          el.setAttribute("y", Number(el.getAttribute("y")) + opcoes[i][1]);
        }
      }
      if (!c) c = { x: bb.x, y: bb.y, w: bb.width, h: bb.height, dono: t };
      caixas.push(c);
    });
  }

  // destaque de um território: anel na peça + brilho no desenho
  function marcar(t, estadoVisual) {
    elRing[t].setAttribute("class", estadoVisual ? "ring " + estadoVisual : "ring");
    elTerr[t].setAttribute("class", estadoVisual ? "territorio " + estadoVisual : "territorio");
  }

  // -------- render (atualiza cores, números, destaques, painel) --------
  function render() {
    if (!estado) return;
    const minhaVez = (estado.vez === HUMANO && !animando && estado.vencedor === null);
    // nós
    Object.keys(TERRITORIOS).forEach(function (t) {
      const cor = corDe(t);
      elDisc[t].setAttribute("fill", cor);
      elArmy[t].setAttribute("fill", corTexto(cor));
      elArmy[t].textContent = texto(t).exercitos;
      marcar(t, ""); // limpa
    });
    // destaque do reforço (Modo B): acende os territórios onde o bolsão ativo
    // pode entrar — só a região da vez, ou o mapa todo no reforço geral.
    if (minhaVez && estado.fase === "reforco") {
      const ativo = reforcoAtivo();
      if (ativo) {
        Object.keys(TERRITORIOS).forEach(function (t) {
          if (estado.territorios[t].dono !== HUMANO) return;
          if (ativo.modo === "geral" || regiaoDe(t) === ativo.regiao)
            marcar(t, "dest");
        });
      }
    }
    // destaques de seleção (ataque / remanejamento)
    if (selecao) {
      marcar(selecao, "origin");
      if (estado.fase === "ataque") {
        inimigosVizinhos(estado, selecao).forEach(function (v) { marcar(v, "target"); });
      } else if (estado.fase === "remanejamento") {
        vizinhosDe(selecao).forEach(function (v) {
          if (estado.territorios[v].dono === HUMANO) marcar(v, "dest");
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
      const ativo = reforcoAtivo();
      if (ativo && ativo.modo === "regiao")
        reinf.innerHTML = "Bônus de <b>" + ativo.regiao + "</b>: <b>" + ativo.qtd + "</b> a posicionar";
      else if (ativo && ativo.modo === "geral")
        reinf.innerHTML = "Reforço geral: <b>" + ativo.qtd + "</b> a posicionar";
    }

    if (estado.vencedor !== null) {
      instr.textContent = "";
    } else if (!minhaVez) {
      instr.textContent = "Aguarde — os outros comandantes estão movendo seus exércitos.";
    } else if (estado.fase === "reforco") {
      const ativo = reforcoAtivo();
      if (ativo && ativo.modo === "regiao")
        instr.textContent = "Bônus da região " + ativo.regiao + ": toque nos territórios dela (destacados) para posicionar.";
      else
        instr.textContent = "Reforço geral: toque em qualquer território seu (destacado) para posicionar.";
    } else if (estado.fase === "ataque") {
      instr.textContent = selecao
        ? "Atacando de " + selecao + ". Toque num vizinho inimigo destacado — ou toque " + selecao + " de novo para cancelar."
        : "Toque num território seu (2+ exércitos) que faça fronteira com inimigo para atacar a partir dele.";
    } else if (estado.fase === "remanejamento") {
      instr.textContent = selecao
        ? "Toque num vizinho SEU para mover a tropa (quem chega trava ali nesta fase)."
        : "Opcional — mova quantas vezes quiser: toque num território seu com tropa fresca (2+) para levá-la a um vizinho seu.";
    }

    renderAcoes(minhaVez);
    renderCartas(minhaVez);
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
    if (!minhaVez || escolhendoConquista) return;
    // Fase de reforço: sem botão — quando o total zera, a tela avança sozinha (3.4-bis).
    if (estado.fase === "ataque") {
      box.appendChild(botao("Terminar ataque", "", acaoTerminarAtaque));
      box.appendChild(botao("Passar vez", "ghost", acaoPassar));
    } else if (estado.fase === "remanejamento") {
      box.appendChild(botao("Passar vez", "primary", acaoPassar));
    }
  }

  // -------- conquista: quantos exércitos entram --------
  function abrirConquista(r, origem, destino) {
    const ov = document.getElementById("overlay");
    if (!estado.conquista) { escolhendoConquista = false; render(); return; }
    const max = r.podeFicarAte; // 2 ou 3 (com 1 só não há escolha)
    let botoes = "";
    for (let n = 1; n <= max; n++) botoes += '<button class="conqOpcao" data-n="' + n + '">' + n + "</button>";
    ov.innerHTML =
      '<div class="modal modalConquista">' +
        "<h2>" + destino + " é seu!</h2>" +
        '<p class="lead">Quantos exércitos entram vindos de <b>' + origem + "</b>?</p>" +
        '<div class="conqLinha">' + botoes + "</div>" +
        '<p class="conqResto">No máximo 3, sempre deixando 1 em ' + origem + ".</p>" +
      "</div>";
    ov.classList.add("on");
    ov.querySelectorAll(".conqOpcao").forEach(function (b) {
      b.addEventListener("click", function () {
        const m = moverNaConquista(estado, Number(b.dataset.n));
        if (!m.ok) return toast(m.erro);
        ov.classList.remove("on");
        escolhendoConquista = false;
        // segue atacando da origem, se ainda der
        const o = estado.territorios[origem];
        selecao = (o.exercitos >= 2 && inimigosVizinhos(estado, origem).length > 0) ? origem : null;
        render();
      });
    });
  }

  // -------- cartas (painel + janela de troca) --------
  function renderCartas(minhaVez) {
    const box = document.getElementById("cartasBox");
    const mao = estado.jogadores[HUMANO].cartas || [];
    const podeTrocar = minhaVez && estado.fase === "reforco" && acharTroca(estado, HUMANO) !== null;
    let html = '<div class="cartashead"><h3>Suas cartas</h3><span class="cartasinfo">Próxima troca: <b>+' +
      valorDaTroca(estado.trocasFeitas) + "</b></span></div>";
    if (!mao.length) html += '<p class="cartasvazio">Conquiste pelo menos 1 território no turno para ganhar uma carta.</p>';
    else {
      html += '<div class="maoChips">';
      mao.forEach(function (c) {
        html += '<span class="chipCarta">' + iconeSimbolo(c.s, 18) + "<span>" + (c.t || "Coringa") + "</span></span>";
      });
      html += "</div>";
    }
    box.innerHTML = html;
    if (mao.length) {
      const b = botao(podeTrocar ? "Trocar cartas" : "Ver cartas", podeTrocar ? "primary" : "", function () { abrirCartas(false); });
      b.id = "cartasBtn";
      box.appendChild(b);
    }
  }

  // Janela das cartas. "obrigatoria" = está com 5+ e precisa trocar agora.
  function abrirCartas(obrigatoria) {
    const ov = document.getElementById("overlay");
    const mao = estado.jogadores[HUMANO].cartas || [];
    const minhaVez = estado.vez === HUMANO && !animando && estado.vencedor === null;
    const podeTrocar = minhaVez && estado.fase === "reforco";
    const escolhidas = [];
    ov.innerHTML =
      '<div class="modal modalCartas">' +
        "<h2>" + (obrigatoria ? "Troca obrigatória" : "Suas cartas") + "</h2>" +
        '<p class="lead">' + (obrigatoria
          ? "Você está com " + mao.length + " cartas. Troque 3 antes de posicionar os reforços."
          : "Troque 3 símbolos iguais ou 3 diferentes (o coringa vale qualquer um). A próxima troca da mesa vale <b>+" +
            valorDaTroca(estado.trocasFeitas) + "</b>, e cada carta de território seu põe +2 nele.") + "</p>" +
        '<div class="mesaCartas" id="mesaCartas"></div>' +
        '<p class="trocaStatus" id="trocaStatus"></p>' +
        '<div class="trocaAcoes">' +
          (podeTrocar ? '<button class="ghost" id="trocaMelhor">Escolher a melhor</button><button class="primary" id="trocaOk" disabled>Trocar</button>' : "") +
          (obrigatoria ? "" : '<button class="ghost" id="trocaFechar">Fechar</button>') +
        "</div>" +
      "</div>";
    ov.classList.add("on");
    const mesa = ov.querySelector("#mesaCartas");
    mao.forEach(function (c, i) {
      const b = document.createElement("button");
      b.className = "cartaBtn";
      b.innerHTML = desenharCarta(c);
      b.setAttribute("aria-pressed", "false");
      if (podeTrocar) b.addEventListener("click", function () {
        const k = escolhidas.indexOf(i);
        if (k >= 0) escolhidas.splice(k, 1);
        else if (escolhidas.length < 3) escolhidas.push(i);
        atualizar();
      });
      else b.disabled = true;
      mesa.appendChild(b);
    });
    function atualizar() {
      mesa.querySelectorAll(".cartaBtn").forEach(function (b, i) {
        const on = escolhidas.indexOf(i) >= 0;
        b.classList.toggle("sel", on); b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      const st = ov.querySelector("#trocaStatus"), ok = ov.querySelector("#trocaOk");
      if (!podeTrocar) { st.textContent = "Dá para trocar na fase de reforço do seu turno."; return; }
      const trio = escolhidas.map(function (i) { return mao[i]; });
      let valida = false;
      if (escolhidas.length < 3) st.textContent = "Escolha 3 cartas (" + escolhidas.length + " de 3).";
      else if (!trocaValida(trio)) st.textContent = "Essas 3 não formam troca: precisa ser 3 iguais ou 3 diferentes.";
      else {
        valida = true;
        const meus = trio.filter(function (c) { return c.t && estado.territorios[c.t].dono === HUMANO; }).map(function (c) { return c.t; });
        st.innerHTML = "Troca válida: <b>+" + valorDaTroca(estado.trocasFeitas) + "</b> no reforço geral" +
          (meus.length ? ", e +2 em " + meus.join(", ") : "") + ".";
      }
      if (ok) ok.disabled = !valida;
    }
    if (podeTrocar) {
      ov.querySelector("#trocaMelhor").addEventListener("click", function () {
        const m = acharTroca(estado, HUMANO);
        escolhidas.length = 0;
        if (m) m.forEach(function (i) { escolhidas.push(i); });
        else toast("Nenhuma troca possível com essas cartas.");
        atualizar();
      });
      ov.querySelector("#trocaOk").addEventListener("click", function () {
        const r = trocarCartas(estado, escolhidas.slice());
        if (!r.ok) return toast(r.erro);
        toast("+" + r.valor + " exércitos no reforço geral" + (r.bonusEm.length ? " · +2 em " + r.bonusEm.join(", ") : ""));
        ov.classList.remove("on");
        render();
        if (trocaObrigatoria(estado)) abrirCartas(true);
      });
    }
    const fechar = ov.querySelector("#trocaFechar");
    if (fechar) fechar.addEventListener("click", function () { ov.classList.remove("on"); });
    atualizar();
  }

  // No começo do seu reforço: com 5+ cartas, a janela de troca abre sozinha.
  function checarTrocaObrigatoria() {
    if (estado.vez === HUMANO && estado.fase === "reforco" && estado.vencedor === null && trocaObrigatoria(estado))
      abrirCartas(true);
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
      stat.textContent = r.territorios + "⬡ · " + r.exercitos + "⚔ · " + r.cartas + "▯";
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
    if (animando || escolhendoConquista || estado.vencedor !== null) return;
    if (estado.jogadores[estado.vez].tipo !== "humano") return;
    if (estado.fase === "reforco") cliqueReforco(t);
    else if (estado.fase === "ataque") cliqueAtaque(t);
    else if (estado.fase === "remanejamento") cliqueRemanejo(t);
  }

  function cliqueReforco(t) {
    if (estado.territorios[t].dono !== HUMANO) return toast("Esse território não é seu.");
    const ativo = reforcoAtivo();
    if (!ativo) return; // nada a posicionar (o auto-avanço já cuida da transição)
    if (ativo.modo === "regiao" && regiaoDe(t) !== ativo.regiao)
      return toast("Agora é o bônus de " + ativo.regiao + " — toque num território dessa região.");
    if (trocaObrigatoria(estado)) return abrirCartas(true);
    const r = posicionarReforco(estado, t, 1);
    if (!r.ok) return toast(r.erro);
    render();
    if (estado.reforcosPendentes === 0) autoAvancarReforco();
  }

  // Auto-avanço (3.4-bis): quando o total de reforços zera, dá um respiro
  // (~0,3s) para o jogador ver o último soldado cair e então abre o ataque.
  function autoAvancarReforco() {
    render();
    setTimeout(function () {
      if (estado.fase !== "reforco" || estado.reforcosPendentes !== 0) return;
      const r = terminarReforco(estado);
      if (r.ok) { selecao = null; render(); }
    }, 300);
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
    const r = atacar(estado, origem, destino, { escolher: true });
    if (!r.ok) return toast(r.erro);
    mostrarDados(r, origem, destino);
    if (estado.vencedor !== null) { render(); setTimeout(mostrarVitoria, 900); return; }
    if (estado.conquista) {
      // conquistou e sobrou tropa na origem: o jogador escolhe quantos entram
      selecao = null; render();
      escolhendoConquista = true;
      setTimeout(function () { abrirConquista(r, origem, destino); }, 700);
      return;
    }
    // mantém atacando da origem, se ainda der
    if (estado.territorios[origem].dono !== HUMANO || estado.territorios[origem].exercitos < 2) selecao = null;
    else selecao = origem;
    render();
  }

  function cliqueRemanejo(t) {
    const d = estado.territorios[t];
    if (selecao === null) {
      if (d.dono !== HUMANO) return toast("Escolha um território seu de origem.");
      if (frescosEm(estado, t) < 1) return toast("Esses exércitos já se moveram nesta fase.");
      if (Math.min(frescosEm(estado, t), d.exercitos - 1) < 1) return toast("Sem tropa de sobra (precisa deixar 1).");
      const temViz = vizinhosDe(t).some(function (v) { return estado.territorios[v].dono === HUMANO; });
      if (!temViz) return toast("Esse território não tem vizinho seu para receber tropa.");
      selecao = t; destinoSel = null; render(); return;
    }
    if (t === selecao) { selecao = null; destinoSel = null; render(); return; }
    if (d.dono !== HUMANO) return toast("Escolha um vizinho SEU.");
    if (vizinhosDe(selecao).indexOf(t) === -1) return toast("Não é vizinho de " + selecao + ".");
    destinoSel = t;
    qtdMover = Math.min(frescosEm(estado, selecao), estado.territorios[selecao].exercitos - 1); // padrão: leva o máximo movível
    render();
  }

  // -------- botões de ação --------
  function acaoTerminarAtaque() { const r = terminarAtaque(estado); if (!r.ok) return toast(r.erro); selecao = null; render(); }
  function acaoPassar() {
    selecao = null; destinoSel = null;
    const r = passarVez(estado); if (!r.ok) return toast(r.erro);
    if (r.carta) toast("Você ganhou uma carta: " + (r.carta.t ? r.carta.t + " (" + NOME_SIMBOLO[r.carta.s] + ")" : "Coringa"));
    depoisDoTurno();
  }

  // stepper do remanejamento
  function moverAjuste(delta) {
    const max = Math.min(frescosEm(estado, selecao), estado.territorios[selecao].exercitos - 1);
    qtdMover = Math.max(1, Math.min(max, qtdMover + delta));
    render();
  }
  function moverConfirmar() {
    const r = remanejar(estado, selecao, destinoSel, qtdMover);
    if (!r.ok) return toast(r.erro);
    // Não encerra a fase: o jogador pode continuar remanejando (vários pulos).
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
        checarTrocaObrigatoria();
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
    box.classList.remove("on"); void box.offsetWidth; // reinicia a animação
    box.classList.add("on");
    posicionarDados(box, origem, destino);
    clearTimeout(mostrarDados._t);
    mostrarDados._t = setTimeout(function () { box.classList.remove("on"); }, 1500);
  }

  // Coloca a caixa dos dados logo acima da batalha (entre atacante e
  // defensor), sem deixar sair da parte do mapa que está visível na tela.
  function posicionarDados(box, origem, destino) {
    const sc = document.getElementById("boardScroll");
    const rs = sc.getBoundingClientRect();
    const ra = elDisc[origem].getBoundingClientRect(), rd = elDisc[destino].getBoundingClientRect();
    const cx = (ra.left + ra.right + rd.left + rd.right) / 4 - rs.left + sc.scrollLeft;
    const topo = Math.min(ra.top, rd.top) - rs.top + sc.scrollTop - 12;
    const w = box.offsetWidth, h = box.offsetHeight, m = 8;
    const x = Math.max(sc.scrollLeft + w / 2 + m, Math.min(sc.scrollLeft + sc.clientWidth - w / 2 - m, cx));
    let y = topo; // a caixa fica ACIMA deste ponto
    if (y - h < sc.scrollTop + m) y = Math.max(ra.bottom, rd.bottom) - rs.top + sc.scrollTop + 12 + h; // sem espaço em cima: vai para baixo
    y = Math.min(y, sc.scrollTop + sc.clientHeight - m);
    box.style.left = x + "px";
    box.style.top = y + "px";
  }

  // -------- modais --------
  function mostrarInicio() {
    const ov = document.getElementById("overlay");
    ov.innerHTML =
      '<div class="modal">' +
        "<h2>Domination: Britannia</h2>" +
        '<p class="lead">Conquiste a ilha. Cada território começa com 1 exército; no seu turno você recebe reforços, ataca e (se quiser) remaneja, depois passa a vez.</p>' +
        '<div class="rules">' +
          "Vença dominando <b>5 das 8 regiões</b> inteiras (ou sobrando o último de pé).<br>" +
          "Combate em <b>d8</b>: o ataque rola até <b>4</b> dados, a defesa até <b>3</b>; comparam-se os maiores e o <b>empate é da defesa</b>.<br>" +
          "Só ataca quem tem <b>2+</b> exércitos.<br>" +
          "Conquistou no turno? Ganha <b>1 carta</b>. Troque 3 iguais ou 3 diferentes por exércitos: <b>4, 6, 8, 10, 12, 15, 18, 20</b>, depois +5." +
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
    selecao = null; destinoSel = null; animando = false; escolhendoConquista = false;
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
  // Muda o tamanho do mapa mantendo no centro da tela o que já estava lá.
  function aplicarZoom() {
    const sc = document.getElementById("boardScroll");
    const fx = (sc.scrollLeft + sc.clientWidth / 2) / (sc.scrollWidth || 1);
    const fy = (sc.scrollTop + sc.clientHeight / 2) / (sc.scrollHeight || 1);
    document.getElementById("board").style.width = (zoom * 100) + "%";
    sc.scrollLeft = fx * sc.scrollWidth - sc.clientWidth / 2;
    sc.scrollTop = fy * sc.scrollHeight - sc.clientHeight / 2;
  }

  // -------- ligações de UI --------
  function ligarUI() {
    document.getElementById("newGame").addEventListener("click", mostrarInicio);
    document.getElementById("zoomIn").addEventListener("click", function () { zoom = Math.min(4, zoom + 0.25); aplicarZoom(); });
    document.getElementById("zoomOut").addEventListener("click", function () { zoom = Math.max(1, zoom - 0.25); aplicarZoom(); });
    document.getElementById("moverMinus").addEventListener("click", function () { moverAjuste(-1); });
    document.getElementById("moverPlus").addEventListener("click", function () { moverAjuste(1); });
    document.getElementById("moverGo").addEventListener("click", moverConfirmar);
    document.getElementById("moverCancel").addEventListener("click", moverCancelar);
  }

  // -------- start --------
  instalarDefsCartas();
  construir();
  ligarUI();
  mostrarInicio();
})();
