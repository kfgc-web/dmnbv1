/* ============================================================
   WAR BRITÂNICO — BOTS ("IA ok")
   ============================================================
   Estes são os jogadores controlados pelo computador. NÃO são
   uma IA que aprende: são REGRAS DE PRIORIDADE escritas à mão,
   construídas inteiramente EM CIMA do motor.js (só usam as
   ações e as consultas públicas do motor + os atalhos do mapa).
   Nada aqui altera o motor.

   Carregar SEMPRE nesta ordem (o de cima precisa estar pronto
   antes do de baixo):
       <script src="mapa.js"></script>
       <script src="motor.js"></script>
       <script src="bots.js"></script>

   ------------------------------------------------------------
   FUNÇÃO PRINCIPAL
       jogarTurnoBot(estado)
         -> joga o TURNO INTEIRO do jogador da vez:
            (1) reforço  (2) ataque  (3) remanejamento  (4) passa a vez.
         -> muda o "estado" no lugar (igual ao motor) e devolve um
            pequeno relatório do que fez.

   SUB-FUNÇÕES (também soltas, pra reaproveitar e depurar):
       botReforcar(estado)   — fase 1: posiciona reforços nas fronteiras
       botAtacar(estado)     — fase 2: ataca só com vantagem boa
       botRemanejar(estado)  — fase 3: leva tropa do fundo pro front

   AUXILIARES DE DECISÃO (a "cabeça" do bot):
       botAtaqueBom(exAtq, exDef) — a matemática dos dados (vale atacar?)
       botValorAlvo(estado, id, alvo) — quanto vale conquistar tal território
   ============================================================ */


/* ----------------------------------------------------------------
   BOTÕES DE AJUSTE — dá pra mexer sem medo (afinam o "tempero")
   ---------------------------------------------------------------- */

// Trava de segurança do loop de ataque. O loop JÁ termina sozinho
// (todo ataque tira pelo menos 1 exército do tabuleiro, e os exércitos
// do turno são finitos), mas este teto é um cinto de segurança.
const BOT_MAX_ATAQUES_POR_TURNO = 300;

// Folga ao reforçar uma fronteira: tento deixá-la com (exércitos do
// alvo + esta folga), pra abrir o ataque com vantagem confortável.
const BOT_FOLGA_REFORCO = 2;


/* ----------------------------------------------------------------
   A MATEMÁTICA DOS DADOS — "vale a pena atacar?"
   ----------------------------------------------------------------
   Lembrando a regra (d8): o atacante rola até 4 dados e fica com os
   3 MAIORES; o defensor rola até 3; compara maior×maior; EMPATE é
   vitória da defesa. Para rolar 4 dados o atacante precisa de 5+
   exércitos (4 atacam, 1 fica de ocupação).

   A regra (medida em 20.000 batalhas simuladas até o fim): o atacante
   só passa de ~60% de vitória quando tem PELO MENOS +2 exércitos de
   vantagem. Abaixo disso é cara-ou-coroa ou pior — jogar fora exército.
   Exemplos medidos:  3×1=78%  4×2=69%  5×3=63%  (folga +2, valem)
                      4×3=36%  5×4=50%  6×5=50%  (folga +1, NÃO valem)
                      5×5=37%  6×6=38%  8×8=44%  (paridade, NÃO valem)

   Então a regra é uma linha só: atacar quando exAtq >= exDef + 2.
   Isso já exclui o famigerado "2 contra 1" (2 < 1+2) e qualquer ataque
   de 1 dado, e bate com a folga que o bot usa ao reforçar.
   ---------------------------------------------------------------- */
function botAtaqueBom(exAtq, exDef) {
  return exAtq >= exDef + 2;
}


/* ----------------------------------------------------------------
   VALOR DE CONQUISTAR UM TERRITÓRIO INIMIGO
   ----------------------------------------------------------------
   Quanto MAIOR o número, mais o bot quer aquele território. A ordem
   de prioridade que isto codifica:
     1) FECHAR uma região (pegar a última peça que falta) -> dispara.
     2) Roer uma região que eu já tenho quase toda (peso pelo bônus).
     3) Expansão geral, preferindo o alvo mais fraco.
     4) Empurrãozinho pra dar o golpe em quem está quase eliminado.
   ---------------------------------------------------------------- */
function botValorAlvo(estado, id, alvo) {
  const r = regiaoDe(alvo);
  const terrs = territoriosDaRegiao(r);
  // Quantos territórios desta região AINDA não são meus (o "alvo" é um deles).
  let restantes = 0;
  for (let i = 0; i < terrs.length; i++) {
    if (estado.territorios[terrs[i]].dono !== id) restantes++;
  }

  let v = 10; // valor-base de simplesmente expandir

  if (restantes === 1) {
    // Este é o ÚLTIMO que falta da região -> conquistar FECHA a região.
    v += 1000 + bonusDaRegiao(r) * 20;
  } else {
    // Ainda falta mais de um, mas quanto mais eu já tenho da região
    // (e maior o bônus), mais vale ir roendo.
    const possuidos = terrs.length - restantes;
    v += bonusDaRegiao(r) * (possuidos + 1);
  }

  // Entre alvos parecidos, prefiro o mais fraco (menos exércitos).
  v -= estado.territorios[alvo].exercitos * 1.5;

  // Quem está com pouquíssimo território está perto de sair: vale o golpe.
  const donoAlvo = estado.territorios[alvo].dono;
  if (territoriosDe(estado, donoAlvo).length <= 2) v += 30;

  return v;
}


/* ----------------------------------------------------------------
   FASE 1 — REFORÇO
   ----------------------------------------------------------------
   Posiciona os reforços nas FRONTEIRAS (territórios que encostam em
   inimigo), nunca no interior calmo. Estratégia: "encho cada fronteira
   só o suficiente pra vencer o ataque que quero, começando pelas mais
   valiosas (as que fecham/avançam região), e o que sobrar empilho na
   melhor de todas (excesso = soco garantido)."
   ---------------------------------------------------------------- */
function botReforcar(estado) {
  const id = estado.vez;
  if (estado.fase !== "reforco") return { ok: false, erro: "Não é a fase de reforços." };
  if (estado.reforcosPendentes <= 0) return { ok: true, colocados: 0 };

  const meus = territoriosDe(estado, id);
  if (meus.length === 0) return { ok: true, colocados: 0 };

  const fronteiras = meus.filter(function (t) { return ehFronteira(estado, t); });

  // Caso raro: sem nenhuma fronteira (cercado só pelos próprios territórios).
  // Empilha tudo onde já tenho mais tropa e segue o jogo.
  if (fronteiras.length === 0) {
    let alvo = meus[0];
    for (let i = 1; i < meus.length; i++) {
      if (estado.territorios[meus[i]].exercitos > estado.territorios[alvo].exercitos) alvo = meus[i];
    }
    const total = estado.reforcosPendentes;
    posicionarReforco(estado, alvo, total);
    return { ok: true, colocados: total };
  }

  // Para cada fronteira: qual o melhor alvo dela e quantos exércitos ela tem.
  const infos = fronteiras.map(function (t) {
    const alvos = inimigosVizinhos(estado, t);
    let melhorV = -Infinity, exDefMelhor = 1;
    for (let i = 0; i < alvos.length; i++) {
      const vv = botValorAlvo(estado, id, alvos[i]);
      if (vv > melhorV) { melhorV = vv; exDefMelhor = estado.territorios[alvos[i]].exercitos; }
    }
    return { t: t, valor: melhorV, exDef: exDefMelhor, exAtual: estado.territorios[t].exercitos };
  });

  // Prioriza as fronteiras mais valiosas.
  infos.sort(function (a, b) { return b.valor - a.valor; });

  // "Water-filling": completa cada fronteira até (exDef + folga), na ordem de valor.
  let restante = estado.reforcosPendentes;
  const aloc = {};
  for (let i = 0; i < infos.length && restante > 0; i++) {
    const nivel = infos[i].exDef + BOT_FOLGA_REFORCO; // alvo de tropas pra atacar bem
    const falta = Math.max(0, nivel - infos[i].exAtual);
    const add = Math.min(falta, restante);
    if (add > 0) { aloc[infos[i].t] = (aloc[infos[i].t] || 0) + add; restante -= add; }
  }
  // Sobrou reforço? Empilha tudo na fronteira mais valiosa.
  if (restante > 0) { aloc[infos[0].t] = (aloc[infos[0].t] || 0) + restante; restante = 0; }

  // Aplica de fato no motor.
  let colocados = 0;
  Object.keys(aloc).forEach(function (t) {
    const r = posicionarReforco(estado, t, aloc[t]);
    if (r.ok) colocados += aloc[t];
  });

  return { ok: true, colocados: colocados };
}


/* ----------------------------------------------------------------
   FASE 2 — ATAQUE
   ----------------------------------------------------------------
   Em volta: acha o MELHOR ataque favorável agora (maior valor; em
   empate, maior vantagem de exércitos), executa UMA rolagem, e repete.
   Para quando não houver mais nenhum ataque bom. Como toda rolagem
   tira pelo menos 1 exército do tabuleiro, o loop sempre termina.
   ---------------------------------------------------------------- */
function botAtacar(estado) {
  const id = estado.vez;
  if (estado.fase !== "ataque") return { ok: false, erro: "Não é a fase de ataque." };

  let ataques = 0, conquistas = 0;

  while (ataques < BOT_MAX_ATAQUES_POR_TURNO) {
    if (estado.vencedor !== null) break;     // venceu por "último de pé" no meio do ataque

    // Procura o melhor (origem -> destino) favorável neste momento.
    let melhor = null; // { origem, destino, valor, vantagem }
    const meus = territoriosDe(estado, id);
    for (let i = 0; i < meus.length; i++) {
      const o = meus[i];
      const exA = estado.territorios[o].exercitos;
      if (exA < 3) continue;                 // fraco demais pra atacar bem
      const alvos = inimigosVizinhos(estado, o);
      for (let k = 0; k < alvos.length; k++) {
        const e = alvos[k];
        const exD = estado.territorios[e].exercitos;
        if (!botAtaqueBom(exA, exD)) continue;
        const valor = botValorAlvo(estado, id, e);
        const vantagem = exA - exD;
        if (melhor === null || valor > melhor.valor ||
            (valor === melhor.valor && vantagem > melhor.vantagem)) {
          melhor = { origem: o, destino: e, valor: valor, vantagem: vantagem };
        }
      }
    }

    if (melhor === null) break;              // nenhum ataque bom: encerra o ataque

    const r = atacar(estado, melhor.origem, melhor.destino);
    ataques++;
    if (!r.ok) break;                        // segurança: erro inesperado, para
    if (r.conquistou) conquistas++;
  }

  return { ok: true, ataques: ataques, conquistas: conquistas };
}


/* ----------------------------------------------------------------
   FASE 3 — REMANEJAMENTO (um movimento, opcional)
   ----------------------------------------------------------------
   Puxa a maior pilha de um território CALMO do interior para a linha
   de frente. Como na v1 é um único movimento (sem encadear), o destino
   precisa ser um vizinho meu; prefiro o que JÁ é fronteira, senão um
   que esteja a um passo dela. Se a tropa estiver no fundo sem caminho
   pro front neste turno, não mexo (turno que vem o front muda).
   ---------------------------------------------------------------- */
function botRemanejar(estado) {
  const id = estado.vez;
  if (estado.fase !== "remanejamento") return { ok: false, erro: "Não é a fase de remanejamento." };
  if (estado.remanejouNesteTurno) return { ok: true, moveu: 0 };

  const meus = territoriosDe(estado, id);

  // Origens possíveis: meus territórios NÃO-fronteira com tropa sobrando.
  const origens = meus.filter(function (t) {
    return !ehFronteira(estado, t) && estado.territorios[t].exercitos >= 2;
  });
  if (origens.length === 0) return { ok: true, moveu: 0 };

  // Acha o melhor par (origem -> destino meu vizinho), ranqueando o destino:
  //   2 = é fronteira (linha de frente)
  //   1 = tem um vizinho meu que é fronteira (um passo do front)
  //   0 = fundo seguro (ignora)
  let melhor = null; // { origem, destino, rank, sobra }
  origens.forEach(function (o) {
    const sobra = estado.territorios[o].exercitos - 1; // deixa 1 pra trás
    vizinhosDe(o).forEach(function (d) {
      if (estado.territorios[d].dono !== id) return;    // destino tem de ser meu
      let rank = 0;
      if (ehFronteira(estado, d)) {
        rank = 2;
      } else {
        const vizs = vizinhosDe(d);
        for (let i = 0; i < vizs.length; i++) {
          if (estado.territorios[vizs[i]].dono === id && ehFronteira(estado, vizs[i])) { rank = 1; break; }
        }
      }
      if (rank === 0) return;
      if (melhor === null || rank > melhor.rank ||
          (rank === melhor.rank && sobra > melhor.sobra)) {
        melhor = { origem: o, destino: d, rank: rank, sobra: sobra };
      }
    });
  });

  if (melhor === null) return { ok: true, moveu: 0 };

  const r = remanejar(estado, melhor.origem, melhor.destino, melhor.sobra);
  return { ok: r.ok, moveu: r.ok ? melhor.sobra : 0 };
}


/* ----------------------------------------------------------------
   TURNO COMPLETO DO BOT
   ----------------------------------------------------------------
   Joga o turno inteiro do jogador da vez e passa a vez. É resiliente:
   se for chamado no meio de um turno (fase != reforço), retoma da fase
   em que estiver — útil na fase online, quando um bot assume um assento.
   ---------------------------------------------------------------- */
function jogarTurnoBot(estado) {
  if (estado.vencedor !== null || estado.fase === "fim")
    return { ok: false, erro: "A partida já terminou." };

  const jogador = estado.vez;

  // Jogador sem território (não deveria receber a vez): apenas passa.
  if (territoriosDe(estado, jogador).length === 0) {
    passarVez(estado);
    return { ok: true, jogador: jogador, passouDireto: true };
  }

  const acoes = {};

  // (1) Reforço
  if (estado.fase === "reforco") {
    acoes.reforco = botReforcar(estado);
    // Rede de segurança: se sobrou reforço por qualquer motivo, despeja
    // em qualquer território meu pra poder fechar a fase.
    let trava = 0;
    while (estado.reforcosPendentes > 0 && trava < 200) {
      const meus = territoriosDe(estado, jogador);
      if (meus.length === 0) break;
      const rr = posicionarReforco(estado, meus[0], estado.reforcosPendentes);
      if (!rr.ok) break;
      trava++;
    }
    terminarReforco(estado); // abre o ataque
  }

  // (2) Ataque
  if (estado.fase === "ataque") {
    acoes.ataque = botAtacar(estado);
    if (estado.vencedor !== null) {           // venceu por "último de pé" durante o ataque
      return { ok: true, jogador: jogador, acoes: acoes, vencedor: estado.vencedor };
    }
    terminarAtaque(estado); // abre o remanejamento
  }

  // (3) Remanejamento
  if (estado.fase === "remanejamento") {
    acoes.remanejo = botRemanejar(estado);
  }

  // (4) Passa a vez (o motor checa vitória por 5 regiões aqui).
  const fim = passarVez(estado);

  return {
    ok: true,
    jogador: jogador,
    acoes: acoes,
    vencedor: (estado.vencedor !== null) ? estado.vencedor : null,
    vez: (fim && fim.vez != null) ? fim.vez : estado.vez,
  };
}
