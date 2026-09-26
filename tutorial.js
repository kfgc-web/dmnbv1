/* ============================================================
   DOMINATION: BRITANNIA — tutorial.js (modo Tutorial)
   Carregar depois de motor.js e ANTES de telas.js (a tela chama
   window.TUTORIAL; aqui só usamos o que a tela entrega em comecar).

   Como funciona (definido com Kauã, 25.9.2026):
   - Você contra 3 bots mais fracos (bots.js: botFraco). Começo e dados
     sorteados, como numa partida normal. Vence quem fechar 3 regiões.
   - 1º TURNO GUIADO: um balão por passo (boas-vindas, mapa, reforço,
     ataque, dados, terminar o ataque, remanejar) e só dá para fazer o
     que o balão pede. Balão que só explica tem o botão "Entendi".
   - DEPOIS, LIVRE: um balão na PRIMEIRA vez de cada novidade (conquista,
     carta, vez dos adversários, região fechada, 1ª troca possível,
     troca obrigatória, território perdido, adversário fechou região).
   - COMPLETO: na 1ª troca de cartas aparece "Parabéns…" com Continuar
     jogando / Voltar à tela inicial. Botões "Dicas" e "Pular tutorial"
     ficam no painel.
   ============================================================ */
(function () {
  "use strict";

  // Textos dos balões (aprovados por Kauã). "titulo" aparece nas Dicas.
  const TEXTOS = {
    boas: { titulo: "Boas-vindas", texto: "Bem-vindo à Britânia de 866! Vikings, saxões e celtas disputam a ilha. Você é o <b>vermelho</b>. Sua missão: dominar <b>3 regiões inteiras</b>, à sua escolha." },
    mapa: { titulo: "O mapa", texto: "O mapa tem 8 regiões, cada uma de uma cor. Quem tem uma região inteira ganha exércitos extras todo turno: é o número ao lado do nome. As peças mostram de quem é o território e quantos exércitos tem ali." },
    reforco: { titulo: "Reforço", texto: "Todo turno começa com reforços: 1 exército a cada 3 territórios seus, no mínimo 3. Toque nos seus territórios destacados para colocá-los. Dica: reforce de onde você vai atacar." },
    ataque: { titulo: "Ataque", texto: "Hora de atacar! Toque num território seu com 2 ou mais exércitos e depois num vizinho inimigo." },
    dados: { titulo: "Os dados", texto: "Cada lado rola dados de 8 faces: quem ataca, até 4 (sempre fica 1 em casa); quem defende, até 3. Os maiores se enfrentam, um contra um. <b>Empate é da defesa.</b> Quem perde a disputa perde 1 exército." },
    conquista: { titulo: "Conquista", texto: "Conquistou! Escolha quantos exércitos entram: 1, 2 ou 3. Mais exércitos protegem o território novo, mas deixam o de trás mais fraco." },
    terminar: { titulo: "Terminar o ataque", texto: "Você pode atacar quantas vezes quiser. Quando cansar, toque em <b>Terminar ataque</b>." },
    remanejar: { titulo: "Remanejar", texto: "Agora reorganize: leve exércitos de um território seu para um vizinho seu, de preferência para a fronteira. Cada exército só anda uma vez por turno. Depois, toque em <b>Passar vez</b>." },
    carta: { titulo: "Cartas", texto: "Por ter conquistado neste turno, você ganhou uma <b>carta</b>! Com 3 cartas iguais ou 3 diferentes, você troca por exércitos." },
    vezAdv: { titulo: "Vez dos adversários", texto: "Agora os adversários jogam. Fique de olho: eles também atacam!" },
    regiao: { titulo: "Região fechada", texto: "Quando você fecha uma região, ganha o bônus dela todo turno. Esses extras só podem ir para dentro dela." },
    troca: { titulo: "Troca de cartas", texto: "Você já pode trocar cartas! Toque em <b>Trocar cartas</b>. Cada troca vale mais que a anterior (4, 6, 8, 10…), e carta de território seu dá +2 exércitos nele." },
    obrigatoria: { titulo: "Troca obrigatória", texto: "Com 5 cartas a troca é obrigatória." },
    perdeu: { titulo: "Território perdido", texto: "Quando tomam um território seu, reforce as fronteiras." },
    advRegiao: { titulo: "Região do adversário", texto: "Quando um adversário fecha uma região, ele ganha o bônus dela. Tomar um único território de lá já quebra o bônus dele." },
  };
  // Resumo de uma linha de cada modo (tela final).
  const RESUMO_MODOS = [
    ["Clássico", "cada um recebe um objetivo secreto."],
    ["Domínio", "vence quem dominar 5 das 8 regiões."],
    ["Conquista Total", "só vence o último de pé."],
    ["Partida Rápida", "15 rodadas, vence quem fizer mais pontos."],
    ["Grande Exército", "os vikings invadem e cada reino é um jogador."],
    ["Equipes", "duplas ou trios, sem atacar o parceiro."],
  ];
  const GUIADO = ["boas", "mapa", "reforco", "ataque", "dados", "terminar", "remanejar"];
  const SO_LER = { boas: true, mapa: true, dados: true };            // passos com "Entendi" (travam o mapa)

  let api = null;          // o que a tela entrega (estado, render, toast…)
  let passo = null;        // passo do 1º turno guiado (null = livre)
  let fila = [];           // balões livres esperando: { id, texto }
  let vistos = {};         // novidades já explicadas
  let completo = false;    // já fez a 1ª troca
  let conhecido = null;    // para perceber novidades: meus territórios, regiões de cada um
  let el = null;           // o balão na tela
  let recolhido = false;   // balão recolhido numa etiqueta (volta ao tocar, ou quando muda o balão)

  function ativo() { return !!api; }
  function E() { return api.estado(); }
  function eu() { return api.humano(); }
  function minhaVez() { const e = E(); return e.vez === eu() && e.vencedor === null && !api.ocupado(); }

  /* ---------------- balão ---------------- */
  function balao() {
    if (el) return el;
    el = document.createElement("div");
    el.id = "balao";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
    window.addEventListener("resize", posicionar);
    return el;
  }
  // No canto de baixo à esquerda do mapa (costuma ser mar).
  function posicionar() {
    if (!el || el.hidden) return;
    const r = document.getElementById("boardScroll").getBoundingClientRect();
    el.style.left = (r.left + 10) + "px";
    el.style.maxWidth = Math.max(200, Math.min(innerHeight <= 540 ? 300 : 420, r.width - 20)) + "px"; // celular deitado: mais estreito
    el.style.top = Math.max(r.top + 10, r.bottom - el.offsetHeight - 10) + "px";
  }
  function atual() {
    if (fila.length) return fila[0];
    if (passo) return { id: passo, texto: TEXTOS[passo].texto, entendi: !!SO_LER[passo], guiado: true };
    return null;
  }
  function mostrar() {
    const b = balao(), a = api ? atual() : null;
    limparPulsos();
    if (!a) { b.hidden = true; return; }
    const conteudo = a.id + "|" + a.texto;
    if (b.dataset.conteudo !== conteudo) { b.dataset.conteudo = conteudo; recolhido = false; } // balão novo: aberto
    const chave = conteudo + "|" + recolhido;
    if (b.dataset.chave !== chave) {
      b.dataset.chave = chave;
      b.classList.toggle("recolhido", recolhido);
      b.innerHTML = recolhido ? '<button class="ghost mini" id="balaoAbrir">Tutorial ▴</button>' :
        '<div class="balaoTopo">' + (a.guiado ? '<span class="balaoPasso">Passo ' + (GUIADO.indexOf(a.id) + 1) + " de " + GUIADO.length + "</span>" : '<span class="balaoPasso">Dica</span>') +
        '<button class="ghost mini" id="balaoRecolher" title="Recolher o balão">▾</button></div>' +
        '<p class="balaoTexto">' + a.texto + "</p>" +
        (a.entendi || !a.guiado ? '<button class="primary mini" id="balaoOk">Entendi</button>' : "");
      const ok = b.querySelector("#balaoOk");
      if (ok) ok.addEventListener("click", entendi);
      const rc = b.querySelector("#balaoRecolher");
      if (rc) rc.addEventListener("click", function () { recolhido = true; mostrar(); });
      const ab = b.querySelector("#balaoAbrir");
      if (ab) ab.addEventListener("click", function () { recolhido = false; mostrar(); });
    }
    b.hidden = false;
    pulsar(a.id);
    posicionar();
  }
  function entendi() {
    if (fila.length) fila.shift();
    else if (passo && SO_LER[passo]) avancar();
    api.render(); // os botões do painel mudam com o passo (e o render redesenha o balão)
  }
  function avisar(id, texto) {
    if (vistos[id]) return;
    vistos[id] = true;
    fila.push({ id: id, texto: texto || TEXTOS[id].texto });
  }

  // Destaque pulsando no que o balão pede para tocar.
  function limparPulsos() { document.querySelectorAll(".tutPulso").forEach(function (x) { x.classList.remove("tutPulso"); }); }
  function pulsar(id) {
    const botao = function (txt) {
      return Array.prototype.filter.call(document.querySelectorAll("#actions button"), function (b) { return b.textContent === txt; })[0];
    };
    let alvos = [];
    if (id === "mapa") alvos = Array.prototype.slice.call(document.querySelectorAll(".rotuloRegiao"));
    else if (id === "reforco") alvos = [document.getElementById("reinf")];
    else if (id === "terminar") alvos = [botao("Terminar ataque")];
    else if (id === "remanejar") alvos = [botao("Passar vez")];
    else if (id === "troca") alvos = [document.getElementById("cartasBtn")];
    alvos.forEach(function (x) { if (x) x.classList.add("tutPulso"); });
  }

  /* ---------------- 1º turno guiado ---------------- */
  function avancar() {
    const i = GUIADO.indexOf(passo);
    passo = i >= 0 && i + 1 < GUIADO.length ? GUIADO[i + 1] : null;
    if (passo === "ataque" && !podeAtacar()) passo = "terminar"; // sem ataque possível: pula
  }
  function podeAtacar() {
    const e = E();
    return territoriosDe(e, eu()).some(function (t) { return e.territorios[t].exercitos >= 2 && inimigosVizinhos(e, t).length > 0; });
  }

  // O que cada passo deixa fazer ("conq" sempre: a janela da conquista não pode travar).
  const PERMITIDO = {
    boas: [], mapa: [], dados: [],
    reforco: ["ref", "fimRef", "troca"],
    ataque: ["atq"],
    terminar: ["atq", "fimAtq"],
    remanejar: ["rem", "passar"],
  };
  // Pode fazer a jogada? Devolve null (pode) ou o aviso para o jogador.
  function permite(acao) {
    if (!passo || acao.t === "conq") return null;
    if (PERMITIDO[passo].indexOf(acao.t) !== -1) return null;
    if (SO_LER[passo]) return "Leia o balão e toque em Entendi.";
    if (passo === "ataque") return "Primeiro, faça um ataque: toque num território seu e depois num vizinho inimigo.";
    if (passo === "terminar") return "Toque em Terminar ataque quando quiser seguir.";
    return "Siga o balão do tutorial.";
  }
  // Toque no mapa: só trava nos balões de ler.
  function podeTocar() {
    return passo && SO_LER[passo] && !fila.length ? "Leia o balão e toque em Entendi." : null;
  }
  // Botões do ataque durante o turno guiado.
  function botoes() {
    const antes = passo === "ataque" || passo === "dados";
    return { fimAtq: !antes, passar: !antes && passo !== "terminar" };
  }

  // Depois de uma jogada minha que valeu.
  function depois(acao, r) {
    if (passo === "reforco" && E().fase === "ataque") avancar();
    else if (passo === "ataque" && acao.t === "atq") avancar();
    else if (passo === "terminar" && acao.t === "fimAtq") avancar();
    else if (passo === "remanejar" && acao.t === "passar") passo = null;
    if (acao.t === "passar") {
      if (r.carta) avisar("carta");
      avisar("vezAdv");
      guardarConhecido();
    }
    if (acao.t === "troca") fila = fila.filter(function (b) { return b.id !== "troca"; }); // já trocou: o balão da troca sai
    if (acao.t === "troca" && !completo) {
      completo = true;
      parabensQuandoLivre();
    }
    mostrar();
  }

  /* ---------------- novidades (a cada render) ---------------- */
  function guardarConhecido() {
    const e = E();
    conhecido = {
      meus: territoriosDe(e, eu()),
      regioes: e.jogadores.map(function (j) { return regioesDominadas(e, j.id); }),
    };
  }
  function aoRender() {
    if (!api) return;
    const e = E();
    if (!conhecido) guardarConhecido();
    // o reforço fechou (auto-avanço): segue para o ataque
    if (passo === "reforco" && e.vez === eu() && e.fase === "ataque") avancar();
    // regiões fechadas (por mim e pelos adversários)
    e.jogadores.forEach(function (j) {
      const agora = regioesDominadas(e, j.id);
      agora.forEach(function (r) {
        if (conhecido.regioes[j.id].indexOf(r) !== -1) return;
        if (j.id === eu()) avisar("regiao", "Você fechou <b>" + r + "</b>! Agora ganha +" + bonusDaRegiao(r) + " exércitos todo turno. Esses extras só podem ir para dentro dela.");
        else avisar("advRegiao", 'Cuidado: <span class="balaoCor" style="background:' + j.cor + '"></span><b>' + j.nome + "</b> fechou <b>" + r +
          "</b> e ganha bônus. Tomar um único território de lá já quebra o bônus dele.");
      });
    });
    // território perdido na vez dos outros (o render do último bot já vem com a
    // vez em mim, mas ainda "ocupado" com a animação dos bots)
    const meus = territoriosDe(e, eu());
    const perdidos = conhecido.meus.filter(function (t) { return e.territorios[t].dono !== eu(); });
    if (perdidos.length && e.vencedor === null && (e.vez !== eu() || api.ocupado())) avisar("perdeu", "Tomaram <b>" + perdidos[0] + "</b>! Reforce as fronteiras.");
    if (e.fase !== "reforco") fila = fila.filter(function (b) { return b.id !== "troca"; }); // passou a hora de trocar
    // 1ª troca possível (no meu reforço)
    if (minhaVez() && e.fase === "reforco" && !trocaObrigatoria(e) && acharTroca(e, eu()) !== null && !completo) avisar("troca");
    conhecido = { meus: meus, regioes: e.jogadores.map(function (j) { return regioesDominadas(e, j.id); }) };
    mostrar();
  }

  // Nota do tutorial dentro das janelas (conquista e troca obrigatória), na 1ª vez.
  function nota(tipo) {
    if (!api || vistos[tipo]) return "";
    vistos[tipo] = true;
    return '<p class="tutNota">' + TEXTOS[tipo].texto + "</p>";
  }

  /* ---------------- telas do tutorial ---------------- */
  function listaModos() {
    return '<ul class="tutModos">' + RESUMO_MODOS.map(function (m) { return "<li><b>" + m[0] + "</b>: " + m[1] + "</li>"; }).join("") + "</ul>";
  }
  function parabensQuandoLivre() {
    const tentar = function () {
      if (!api) return;
      const ov = document.getElementById("overlay");
      if (ov.classList.contains("on") || api.ocupado() || E().vencedor !== null) return setTimeout(tentar, 500);
      parabens();
    };
    setTimeout(tentar, 700);
  }
  function parabens() {
    const ov = document.getElementById("overlay");
    ov.innerHTML =
      '<div class="modal modalTutorial">' +
        "<h2>Parabéns!</h2>" +
        '<p class="lead">Você completou o tutorial e está pronto para combater os Vikings!</p>' +
        '<p class="tutSub">Reforço, ataque, conquista, remanejamento e cartas: você já viu tudo. Quando quiser, experimente os outros modos:</p>' +
        listaModos() +
        '<div class="trocaAcoes"><button class="primary" id="tutContinuar">Continuar jogando</button><button class="ghost" id="tutInicio">Voltar à tela inicial</button></div>' +
      "</div>";
    ov.classList.add("on");
    ov.querySelector("#tutContinuar").addEventListener("click", function () { ov.classList.remove("on"); api.render(); });
    ov.querySelector("#tutInicio").addEventListener("click", function () { api.mostrarInicio(); });
  }
  // Fim da partida do tutorial (vitória com 3 regiões ou derrota).
  function htmlFim(venceu) {
    return venceu
      ? { titulo: "Vitória!", texto: "Você fechou 3 regiões. Parabéns, você completou o tutorial e está pronto para combater os Vikings!",
          extra: '<p class="tutSub">Agora experimente os outros modos:</p>' + listaModos() }
      : { titulo: "Não foi desta vez", texto: "Os Vikings levaram a melhor desta vez! Quer tentar de novo?", extra: "" };
  }
  // Dicas: todos os balões, para rever.
  function dicas() {
    const ov = document.getElementById("overlay");
    const ids = ["boas", "mapa", "reforco", "ataque", "dados", "conquista", "terminar", "remanejar", "carta", "vezAdv",
      "regiao", "troca", "obrigatoria", "perdeu", "advRegiao"];
    ov.innerHTML =
      '<div class="modal modalTutorial modalDicas">' +
        "<h2>Dicas</h2>" +
        '<dl class="tutDicas">' + ids.map(function (id) { return "<dt>" + TEXTOS[id].titulo + "</dt><dd>" + TEXTOS[id].texto + "</dd>"; }).join("") + "</dl>" +
        '<button class="primary" id="dicasFechar" style="width:100%">Fechar</button>' +
      "</div>";
    ov.classList.add("on");
    ov.querySelector("#dicasFechar").addEventListener("click", function () { ov.classList.remove("on"); });
  }

  /* ---------------- ligar / desligar ---------------- */
  // api = { estado(), humano(), ocupado(), render(), mostrarInicio() }
  function comecar(novaApi) {
    api = novaApi;
    passo = GUIADO[0];
    fila = []; vistos = {}; completo = false; conhecido = null;
    const b = balao(); b.dataset.chave = ""; b.dataset.conteudo = "";
    mostrar();
  }
  function parar() {
    api = null; passo = null; fila = [];
    limparPulsos();
    if (el) el.hidden = true;
  }

  window.TUTORIAL = {
    get ativo() { return ativo(); },
    get completo() { return completo; },
    comecar: comecar, parar: parar,
    permite: permite, podeTocar: podeTocar, botoes: botoes, depois: depois,
    aoRender: aoRender, nota: nota, dicas: dicas, htmlFim: htmlFim,
  };
})();
