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
   Agora o reforço vem em bolsões (Modo B): um por região completa (preso
   à própria região) na ordem fixa + o reforço-base GERAL. O bot:
     (1) para cada bônus de região, concentra na melhor FRONTEIRA daquela
         região (bônus preso => concentrar abre um bom ataque ali);
     (2) espalha o geral nas fronteiras, "water-filling" como antes
         (enche cada fronteira até vencer o alvo, sobra na mais valiosa).
   ---------------------------------------------------------------- */
function botReforcar(estado) {
  const id = estado.vez;
  if (estado.fase !== "reforco") return { ok: false, erro: "Não é a fase de reforços." };
  if (estado.reforcosPendentes <= 0) return { ok: true, colocados: 0 };

  const meus = territoriosDe(estado, id);
  if (meus.length === 0) return { ok: true, colocados: 0 };

  const rf = estado.reforco || { base: estado.reforcosPendentes, porRegiao: {}, ordem: [] };
  let colocados = 0;

  // (1) BÔNUS DE REGIÃO — cada bolsão preso à sua própria região, na ordem fixa.
  (rf.ordem || []).forEach(function (r) {
    const qtd = (rf.porRegiao && rf.porRegiao[r]) || 0;
    if (qtd <= 0) return;
    const alvo = botMelhorTerritorioPraReforco(estado, id, territoriosDaRegiao(r));
    if (!alvo) return;
    const rr = posicionarReforco(estado, alvo, qtd);
    if (rr.ok) colocados += qtd;
  });

  // (2) REFORÇO-BASE (geral) — o que sobrou (== reforcosPendentes) nas fronteiras.
  if (estado.reforcosPendentes > 0) {
    colocados += botEspalharGeral(estado, id, estado.reforcosPendentes);
  }

  return { ok: true, colocados: colocados };
}

// Melhor território de uma LISTA para receber reforço (usado nos bônus de
// região): prefere as fronteiras (maior valor de alvo) e, se não houver
// fronteira na lista, o território com mais tropa. Só considera os meus.
function botMelhorTerritorioPraReforco(estado, id, lista) {
  const meus = lista.filter(function (t) { return estado.territorios[t].dono === id; });
  if (meus.length === 0) return null;
  const front = meus.filter(function (t) { return ehFronteira(estado, t); });
  const cand = front.length ? front : meus;
  let alvo = cand[0], melhorV = -Infinity;
  cand.forEach(function (t) {
    let v;
    const alvos = inimigosVizinhos(estado, t);
    if (alvos.length) {
      v = -Infinity;
      for (let i = 0; i < alvos.length; i++) {
        const vv = botValorAlvo(estado, id, alvos[i]);
        if (vv > v) v = vv;
      }
    } else {
      v = -1e6 + estado.territorios[t].exercitos; // sem inimigo à vista: baixa prioridade
    }
    if (v > melhorV) { melhorV = v; alvo = t; }
  });
  return alvo;
}

// Espalha "total" reforços GERAIS nas fronteiras (water-filling). Devolve
// quantos de fato colocou. Os bônus de região já foram posicionados antes,
// então aqui o estado já reflete essas tropas.
function botEspalharGeral(estado, id, total) {
  const meus = territoriosDe(estado, id);
  const fronteiras = meus.filter(function (t) { return ehFronteira(estado, t); });

  // Sem nenhuma fronteira: empilha onde já tenho mais tropa e segue o jogo.
  if (fronteiras.length === 0) {
    let alvo = meus[0];
    for (let i = 1; i < meus.length; i++) {
      if (estado.territorios[meus[i]].exercitos > estado.territorios[alvo].exercitos) alvo = meus[i];
    }
    const r = posicionarReforco(estado, alvo, total);
    return r.ok ? total : 0;
  }

  const infos = fronteiras.map(function (t) {
    const alvos = inimigosVizinhos(estado, t);
    let melhorV = -Infinity, exDefMelhor = 1;
    for (let i = 0; i < alvos.length; i++) {
      const vv = botValorAlvo(estado, id, alvos[i]);
      if (vv > melhorV) { melhorV = vv; exDefMelhor = estado.territorios[alvos[i]].exercitos; }
    }
    return { t: t, valor: melhorV, exDef: exDefMelhor, exAtual: estado.territorios[t].exercitos };
  });
  infos.sort(function (a, b) { return b.valor - a.valor; });

  let restante = total;
  const aloc = {};
  for (let i = 0; i < infos.length && restante > 0; i++) {
    const nivel = infos[i].exDef + BOT_FOLGA_REFORCO;
    const falta = Math.max(0, nivel - infos[i].exAtual);
    const add = Math.min(falta, restante);
    if (add > 0) { aloc[infos[i].t] = (aloc[infos[i].t] || 0) + add; restante -= add; }
  }
  if (restante > 0) { aloc[infos[0].t] = (aloc[infos[0].t] || 0) + restante; restante = 0; }

  let colocados = 0;
  Object.keys(aloc).forEach(function (t) {
    const r = posicionarReforco(estado, t, aloc[t]);
    if (r.ok) colocados += aloc[t];
  });
  return colocados;
}

// Rede de segurança: se por acaso sobrou reforço (não deveria), drena
// respeitando a restrição — bônus de região num território da própria região
// (o dono da região tem todos eles), depois o geral em qualquer território meu.
function botDrenarReforco(estado, id) {
  let trava = 0;
  while (estado.reforcosPendentes > 0 && trava < 400) {
    trava++;
    const rf = estado.reforco || { base: estado.reforcosPendentes, porRegiao: {}, ordem: [] };
    const regsPend = Object.keys(rf.porRegiao || {}).filter(function (r) { return rf.porRegiao[r] > 0; });
    if (regsPend.length) {
      const r = regsPend[0];
      const terrs = territoriosDaRegiao(r).filter(function (t) { return estado.territorios[t].dono === id; });
      if (terrs.length) {
        const rr = posicionarReforco(estado, terrs[0], rf.porRegiao[r]);
        if (rr.ok) continue;
      }
      // não deu para drenar esse bolsão (estado estranho): descarta p/ não travar a fase
      estado.reforcosPendentes -= rf.porRegiao[r];
      delete rf.porRegiao[r];
      continue;
    }
    const meus = territoriosDe(estado, id);
    if (meus.length === 0) break;
    const rr = posicionarReforco(estado, meus[0], estado.reforcosPendentes);
    if (!rr.ok) break;
  }
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
   FASE 3 — REMANEJAMENTO (agora vários pulos, com trava por exército)
   ----------------------------------------------------------------
   Empurra tropa FRESCA de territórios calmos do interior rumo à linha de
   frente, um pulo por vez. Como cada exército só se move uma vez na fase
   (trava ao chegar), o número de movimentos é finito e o loop termina.
   A cada volta escolhe o melhor par (origem calma com frescos -> destino meu
   vizinho), ranqueando o destino: 2 = é fronteira; 1 = vizinho de fronteira.
   ---------------------------------------------------------------- */
function botRemanejar(estado) {
  const id = estado.vez;
  if (estado.fase !== "remanejamento") return { ok: false, erro: "Não é a fase de remanejamento." };

  const TETO = 200; // cinto de segurança (o loop já termina sozinho)
  let movimentos = 0;

  while (movimentos < TETO) {
    const meus = territoriosDe(estado, id);

    // Origens: meus territórios NÃO-fronteira, com tropa FRESCA sobrando
    // (>= 1 fresco e total >= 2, para poder deixar 1 para trás).
    const origens = meus.filter(function (t) {
      return !ehFronteira(estado, t) &&
             estado.territorios[t].exercitos >= 2 &&
             frescosEm(estado, t) >= 1;
    });
    if (origens.length === 0) break;

    let melhor = null; // { origem, destino, rank, qtd }
    origens.forEach(function (o) {
      const podeMover = Math.min(frescosEm(estado, o), estado.territorios[o].exercitos - 1);
      if (podeMover < 1) return;
      vizinhosDe(o).forEach(function (dst) {
        if (estado.territorios[dst].dono !== id) return; // destino tem de ser meu
        let rank = 0;
        if (ehFronteira(estado, dst)) {
          rank = 2;
        } else {
          const vizs = vizinhosDe(dst);
          for (let i = 0; i < vizs.length; i++) {
            if (estado.territorios[vizs[i]].dono === id && ehFronteira(estado, vizs[i])) { rank = 1; break; }
          }
        }
        if (rank === 0) return;
        if (melhor === null || rank > melhor.rank ||
            (rank === melhor.rank && podeMover > melhor.qtd)) {
          melhor = { origem: o, destino: dst, rank: rank, qtd: podeMover };
        }
      });
    });

    if (melhor === null) break; // nenhuma tropa do fundo com caminho pro front
    const r = remanejar(estado, melhor.origem, melhor.destino, melhor.qtd);
    if (!r.ok) break; // segurança
    movimentos++;
  }

  return { ok: true, moveu: movimentos };
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
    // Rede de segurança: se sobrou reforço por qualquer motivo, drena
    // respeitando a restrição de região, pra poder fechar a fase.
    botDrenarReforco(estado, jogador);
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
