/* ============================================================
   WAR BRITÂNICO — MOTOR (regras puras)
   ============================================================
   Este é o "cérebro" do jogo: funções PURAS, sem tela e sem
   internet. O motor só conhece o estado da partida e as regras.
   Quem desenha a tela (futuro telas.js) e quem leva o estado
   pela nuvem (futuro rede.js) conversam com ele pelas funções
   listadas em "API PÚBLICA", logo abaixo.

   Ele roda EM CIMA do mapa.js — então o mapa.js precisa estar
   carregado ANTES deste arquivo (no index.html, o <script> do
   mapa.js vem primeiro). Daqui usamos TERRITORIOS, REGIOES e os
   atalhos vizinhosDe / territoriosDaRegiao / bonusDaRegiao.

   Não altere a lógica aqui sem reexecutar os testes.
   ------------------------------------------------------------
   API PÚBLICA (os "verbos" do jogo):
     criarPartida(jogadores)            -> cria a partida pronta
     calcularReforcos(estado, id)       -> quantos reforços rende
     posicionarReforco(estado, t, qtd)  -> põe reforços num território
     terminarReforco(estado)            -> fecha reforços, abre ataque
     atacar(estado, origem, destino)    -> 1 ataque (1 rolagem)
     terminarAtaque(estado)             -> fecha ataque, abre remanejo
     remanejar(estado, orig, dest, qtd) -> 1 movimento de fim de turno
     passarVez(estado)                  -> fecha o turno e chama o próximo

   CONSULTAS (perguntas, não mudam nada):
     territoriosDe, contarExercitos, regioesDominadas,
     inimigosVizinhos, ehFronteira, jogadoresVivos,
     verificarVitoria, resumoJogadores

   FORMATO DO ESTADO (tudo é dado simples, fácil de salvar/enviar):
     estado = {
       territorios: { "Devon": { dono: 0, exercitos: 1 }, ... },
       jogadores:   [ { id, nome, tipo, cor, vivo }, ... ],
       vez:               0,            // id de quem joga agora
       turno:             1,            // contador de rodadas
       fase:              "reforco",    // reforco|ataque|remanejamento|fim
       reforcosPendentes: 0,            // reforços que faltam posicionar
       remanejouNesteTurno: false,
       vencedor:          null,         // id quando alguém vence
       ultimoEvento:      {...},        // último acontecimento (p/ a tela)
       log:               [ "...", ]    // histórico curto (p/ depurar/feed)
     }
   ============================================================ */


/* ----------------------------------------------------------------
   AJUSTES RÁPIDOS — os "botões" que dá pra mexer sem medo
   ---------------------------------------------------------------- */

// Exércitos no começo da partida: cada território entra com 1 (a posse
// exige pelo menos 1). NÃO há exército extra inicial — o primeiro lote de
// reforços (territórios ÷ 3) cada jogador posiciona normalmente, no seu turno.
const BASE_POR_TERRITORIO = 1;

const MIN_REFORCO = 3;          // todo turno rende no mínimo isto
const REGIOES_PARA_VENCER = 5;  // ter 5 das 8 regiões inteiras = vitória

const LADOS_DADO = 8;           // dado de 8 lados (d8)
const MAX_DADOS_ATAQUE = 4;     // atacante rola até 4
const MAX_DADOS_DEFESA = 3;     // defensor rola até 3

// Cor de cada assento (até 6 jogadores).
const CORES = ["#c0392b", "#2c6fbb", "#27ae60", "#e0a200", "#8e44ad", "#16a085"];


/* ----------------------------------------------------------------
   UTILIDADES
   ---------------------------------------------------------------- */

// Embaralha uma cópia do array (Fisher–Yates). Mesmo método do Super Trunfo.
function embaralhar(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Rola um dado de 8 lados: devolve um número de 1 a 8.
function rolarD8() {
  return 1 + Math.floor(Math.random() * LADOS_DADO);
}

// Rola "qtd" dados e devolve já ordenados do MAIOR para o menor.
function rolarDados(qtd) {
  const dados = [];
  for (let i = 0; i < qtd; i++) dados.push(rolarD8());
  return dados.sort(function (a, b) { return b - a; });
}

// Quantos dados o atacante pode rolar com tantos exércitos.
// Precisa deixar 1 de ocupação, então: (exércitos - 1), no máximo 4.
function dadosDeAtaque(exercitos) {
  return Math.max(0, Math.min(MAX_DADOS_ATAQUE, exercitos - 1));
}

// Quantos dados o defensor pode rolar: até 3, limitado ao que ele tem.
function dadosDeDefesa(exercitos) {
  return Math.min(MAX_DADOS_DEFESA, exercitos);
}

// Anota no histórico curto (ajuda a depurar; a tela pode mostrar um "feed").
function anotar(estado, texto) {
  estado.log.push(texto);
  if (estado.log.length > 40) estado.log.shift();
}


/* ----------------------------------------------------------------
   CONSULTAS — perguntas sobre o estado (não mudam nada)
   ---------------------------------------------------------------- */

// Lista os territórios de um jogador.
function territoriosDe(estado, idJogador) {
  return Object.keys(estado.territorios).filter(function (t) {
    return estado.territorios[t].dono === idJogador;
  });
}

// Total de exércitos de um jogador (somando todos os territórios dele).
function contarExercitos(estado, idJogador) {
  return territoriosDe(estado, idJogador).reduce(function (soma, t) {
    return soma + estado.territorios[t].exercitos;
  }, 0);
}

// Quais regiões o jogador domina INTEIRAS (todos os territórios são dele).
function regioesDominadas(estado, idJogador) {
  return Object.keys(REGIOES).filter(function (r) {
    return territoriosDaRegiao(r).every(function (t) {
      return estado.territorios[t].dono === idJogador;
    });
  });
}

// Vizinhos de um território que são de OUTRO dono (= alvos válidos de ataque).
function inimigosVizinhos(estado, territorio) {
  const dono = estado.territorios[territorio].dono;
  return vizinhosDe(territorio).filter(function (v) {
    return estado.territorios[v].dono !== dono;
  });
}

// Este território encosta em inimigo? (útil pros bots e pra destacar a linha de frente)
function ehFronteira(estado, territorio) {
  return inimigosVizinhos(estado, territorio).length > 0;
}

// Jogadores ainda vivos (com pelo menos 1 território).
function jogadoresVivos(estado) {
  return estado.jogadores.filter(function (j) { return j.vivo; });
}

// O jogador tem 5+ regiões inteiras? (condição de vitória da v1)
function verificarVitoria(estado, idJogador) {
  return regioesDominadas(estado, idJogador).length >= REGIOES_PARA_VENCER;
}

// Um retrato rápido de cada jogador — bom pro painel lateral da tela.
function resumoJogadores(estado) {
  return estado.jogadores.map(function (j) {
    return {
      id: j.id,
      nome: j.nome,
      tipo: j.tipo,
      cor: j.cor,
      vivo: j.vivo,
      territorios: territoriosDe(estado, j.id).length,
      exercitos: contarExercitos(estado, j.id),
      regioes: regioesDominadas(estado, j.id),
    };
  });
}


/* ----------------------------------------------------------------
   CONTROLE INTERNO — a tela/rede normalmente não chamam direto
   ---------------------------------------------------------------- */

// Atualiza a marca "vivo" de cada jogador (morre quem ficou sem território).
function marcarEliminados(estado) {
  estado.jogadores.forEach(function (j) {
    const tinha = j.vivo;
    j.vivo = territoriosDe(estado, j.id).length > 0;
    if (tinha && !j.vivo) anotar(estado, j.nome + " foi eliminado.");
  });
}

// Declara vitória de um jogador e congela a partida.
function declararVitoria(estado, idJogador) {
  estado.vencedor = idJogador;
  estado.fase = "fim";
  estado.ultimoEvento = { tipo: "vitoria", vencedor: idJogador };
  anotar(estado, estado.jogadores[idJogador].nome + " venceu a partida!");
  return estado;
}


/* ----------------------------------------------------------------
   CRIAR A PARTIDA — distribui território e exércitos, começa o jogo
   ---------------------------------------------------------------- */
// "jogadores" é uma lista de { nome, tipo } — tipo "humano" ou "bot".
// Recomendado de 4 a 6, mas funciona de 2 a 6 (bom pra testar).
function criarPartida(jogadores) {
  const n = jogadores.length;

  const estado = {
    territorios: {},
    jogadores: jogadores.map(function (j, i) {
      return {
        id: i,
        nome: j.nome || ("Jogador " + (i + 1)),
        tipo: (j.tipo === "bot") ? "bot" : "humano",
        cor: j.cor || CORES[i % CORES.length],
        vivo: true,
      };
    }),
    vez: 0,
    turno: 1,
    fase: "reforco",
    reforcosPendentes: 0,
    remanejouNesteTurno: false,
    vencedor: null,
    ultimoEvento: { tipo: "inicio" },
    log: [],
  };

  // Distribuição: embaralha os 64 territórios e reparte no rodízio.
  // As sobras (quando 64 não divide certinho, com 5 ou 6 jogadores)
  // caem naturalmente nos PRIMEIROS a receber. Cada território entra com 1.
  const baralho = embaralhar(Object.keys(TERRITORIOS));
  baralho.forEach(function (t, i) {
    estado.territorios[t] = { dono: i % n, exercitos: BASE_POR_TERRITORIO };
  });

  // Primeiro turno já montado: o jogador 0 recebe seu lote de reforços
  // (territórios ÷ 3, mínimo 3) para posicionar — igual a todos os turnos.
  estado.reforcosPendentes = calcularReforcos(estado, 0);
  anotar(estado, "Partida criada. Territórios distribuídos.");
  return estado;
}


/* ----------------------------------------------------------------
   REFORÇOS
   ---------------------------------------------------------------- */
// Quantos reforços o jogador recebe neste turno:
//   (territórios ÷ 3, arredondado para o MAIS PRÓXIMO, com mínimo 3)
//   + bônus de cada região que ele domina inteira.
// Obs.: como x/3 nunca dá ,50 exato (só ,33 ou ,67), o Math.round não
// tem ambiguidade — ,33 desce e ,67 sobe.
function calcularReforcos(estado, idJogador) {
  const nTerritorios = territoriosDe(estado, idJogador).length;
  const base = Math.max(MIN_REFORCO, Math.round(nTerritorios / 3));
  const bonus = regioesDominadas(estado, idJogador).reduce(function (soma, r) {
    return soma + bonusDaRegiao(r);
  }, 0);
  return base + bonus;
}

// Posiciona "qtd" reforços num território do jogador da vez.
function posicionarReforco(estado, territorio, qtd) {
  if (qtd == null) qtd = 1;
  if (estado.fase !== "reforco")
    return { ok: false, erro: "Não é a fase de reforços." };
  const alvo = estado.territorios[territorio];
  if (!alvo) return { ok: false, erro: 'Território "' + territorio + '" não existe.' };
  if (alvo.dono !== estado.vez)
    return { ok: false, erro: "Esse território não é seu." };
  if (qtd < 1) return { ok: false, erro: "Quantidade inválida." };
  if (qtd > estado.reforcosPendentes)
    return { ok: false, erro: "Você só tem " + estado.reforcosPendentes + " reforço(s) para posicionar." };

  alvo.exercitos += qtd;
  estado.reforcosPendentes -= qtd;
  estado.ultimoEvento = { tipo: "reforco", territorio: territorio, qtd: qtd, restante: estado.reforcosPendentes };
  return { ok: true, restante: estado.reforcosPendentes };
}

// Encerra a fase de reforços e abre a fase de ataque.
// Só funciona depois de posicionar TODOS os reforços.
function terminarReforco(estado) {
  if (estado.fase !== "reforco")
    return { ok: false, erro: "Não é a fase de reforços." };
  if (estado.reforcosPendentes > 0)
    return { ok: false, erro: "Ainda falta posicionar " + estado.reforcosPendentes + " reforço(s)." };
  estado.fase = "ataque";
  estado.ultimoEvento = { tipo: "faseAtaque" };
  return { ok: true };
}


/* ----------------------------------------------------------------
   COMBATE — um ataque = uma "rolagem"
   ---------------------------------------------------------------- */
// Atacante rola até 4 dados, defensor até 3 (d8). Comparam-se os 3
// MAIORES do atacante contra os do defensor, maior×maior; empate é
// vitória da defesa. Cada comparação perdida tira 1 exército de quem
// perdeu. Se o defensor zerar, o território é conquistado e o atacante
// move tropas pra dentro (deixando ao menos 1 para trás).
//
// opcoes.mover (opcional): quantos exércitos levar ao conquistar.
//   Sem informar, leva o nº de dados que rolou. Sempre deixa 1 atrás.
function atacar(estado, origem, destino, opcoes) {
  opcoes = opcoes || {};
  if (estado.fase !== "ataque")
    return { ok: false, erro: "Não é a fase de ataque." };
  const a = estado.territorios[origem];
  const d = estado.territorios[destino];
  if (!a) return { ok: false, erro: 'Território "' + origem + '" não existe.' };
  if (!d) return { ok: false, erro: 'Território "' + destino + '" não existe.' };
  if (a.dono !== estado.vez)
    return { ok: false, erro: "O território de origem não é seu." };
  if (d.dono === estado.vez)
    return { ok: false, erro: "Não dá para atacar um território seu." };
  if (vizinhosDe(origem).indexOf(destino) === -1)
    return { ok: false, erro: origem + " e " + destino + " não são vizinhos." };
  if (a.exercitos < 2)
    return { ok: false, erro: "Precisa de ao menos 2 exércitos para atacar." };

  const nAtq = dadosDeAtaque(a.exercitos);
  const nDef = dadosDeDefesa(d.exercitos);
  const dadosAtaque = rolarDados(nAtq);   // todos os dados rolados (até 4)
  const dadosDefesa = rolarDados(nDef);

  // Só os 3 MAIORES do atacante entram na comparação.
  const topAtaque = dadosAtaque.slice(0, MAX_DADOS_DEFESA);
  const comparacoes = Math.min(topAtaque.length, dadosDefesa.length);

  let perdasAtacante = 0;
  let perdasDefensor = 0;
  for (let i = 0; i < comparacoes; i++) {
    if (topAtaque[i] > dadosDefesa[i]) perdasDefensor++;  // ataque vence
    else perdasAtacante++;                                // empate ou defesa vence
  }

  a.exercitos -= perdasAtacante;
  d.exercitos -= perdasDefensor;

  let conquistou = false;
  let exercitosMovidos = 0;
  if (d.exercitos <= 0) {
    conquistou = true;
    // Quantos mover pra dentro: por padrão, o nº de dados que rolou.
    // Pode pedir outro valor em opcoes.mover. Sempre deixa 1 pra trás.
    let mover = (opcoes.mover != null) ? opcoes.mover : nAtq;
    mover = Math.max(1, Math.min(mover, a.exercitos - 1));
    a.exercitos -= mover;
    d.exercitos = mover;
    d.dono = estado.vez;
    exercitosMovidos = mover;
    anotar(estado, estado.jogadores[estado.vez].nome + " conquistou " + destino + ".");
    marcarEliminados(estado);
    // Se sobrou um só jogador vivo, a partida acaba na hora.
    if (jogadoresVivos(estado).length === 1)
      declararVitoria(estado, jogadoresVivos(estado)[0].id);
  }

  estado.ultimoEvento = {
    tipo: "ataque", origem: origem, destino: destino,
    dadosAtaque: dadosAtaque, dadosDefesa: dadosDefesa,
    perdasAtacante: perdasAtacante, perdasDefensor: perdasDefensor,
    conquistou: conquistou, exercitosMovidos: exercitosMovidos,
  };
  return {
    ok: true,
    dadosAtaque: dadosAtaque, dadosDefesa: dadosDefesa,
    perdasAtacante: perdasAtacante, perdasDefensor: perdasDefensor,
    conquistou: conquistou, exercitosMovidos: exercitosMovidos,
  };
}

// Encerra a fase de ataque e abre o remanejamento.
function terminarAtaque(estado) {
  if (estado.fase !== "ataque")
    return { ok: false, erro: "Não é a fase de ataque." };
  estado.fase = "remanejamento";
  estado.ultimoEvento = { tipo: "faseRemanejo" };
  return { ok: true };
}


/* ----------------------------------------------------------------
   REMANEJAMENTO — um movimento de fim de turno (opcional)
   ---------------------------------------------------------------- */
// Move exércitos de um território seu para um VIZINHO seu, deixando ao
// menos 1 para trás. Na v1 é UM movimento por turno (sem encadear).
function remanejar(estado, origem, destino, qtd) {
  if (estado.fase !== "remanejamento")
    return { ok: false, erro: "Não é a fase de remanejamento." };
  if (estado.remanejouNesteTurno)
    return { ok: false, erro: "Você já remanejou neste turno." };
  const a = estado.territorios[origem];
  const d = estado.territorios[destino];
  if (!a) return { ok: false, erro: 'Território "' + origem + '" não existe.' };
  if (!d) return { ok: false, erro: 'Território "' + destino + '" não existe.' };
  if (a.dono !== estado.vez || d.dono !== estado.vez)
    return { ok: false, erro: "Os dois territórios precisam ser seus." };
  if (vizinhosDe(origem).indexOf(destino) === -1)
    return { ok: false, erro: origem + " e " + destino + " não são vizinhos." };
  if (qtd < 1) return { ok: false, erro: "Quantidade inválida." };
  if (qtd > a.exercitos - 1)
    return { ok: false, erro: "Precisa deixar pelo menos 1 exército para trás." };

  a.exercitos -= qtd;
  d.exercitos += qtd;
  estado.remanejouNesteTurno = true;
  estado.ultimoEvento = { tipo: "remanejo", origem: origem, destino: destino, qtd: qtd };
  return { ok: true };
}


/* ----------------------------------------------------------------
   PASSAR A VEZ — fecha o turno, checa vitória, chama o próximo
   ---------------------------------------------------------------- */
// Pode ser chamado na fase de ataque (pula o remanejamento) ou na de
// remanejamento. A vitória é checada AQUI, ao fim do turno do jogador.
function passarVez(estado) {
  if (estado.fase !== "ataque" && estado.fase !== "remanejamento")
    return { ok: false, erro: "Só dá para passar a vez depois de receber os reforços." };

  marcarEliminados(estado);

  // Vitória do jogador da vez? (5+ regiões inteiras agora)
  if (verificarVitoria(estado, estado.vez)) {
    declararVitoria(estado, estado.vez);
    return { ok: true, vencedor: estado.vez };
  }
  // Sobrou um só jogador? (vitória por "último de pé")
  if (jogadoresVivos(estado).length === 1) {
    const ultimo = jogadoresVivos(estado)[0].id;
    declararVitoria(estado, ultimo);
    return { ok: true, vencedor: ultimo };
  }

  // Procura o próximo jogador VIVO, no sentido horário.
  const total = estado.jogadores.length;
  let proximo = estado.vez;
  let voltas = 0;
  do {
    proximo = (proximo + 1) % total;
    if (proximo === 0) estado.turno += 1;   // deu a volta na mesa = nova rodada
    voltas++;
  } while (!estado.jogadores[proximo].vivo && voltas <= total);

  estado.vez = proximo;
  estado.fase = "reforco";
  estado.remanejouNesteTurno = false;
  estado.reforcosPendentes = calcularReforcos(estado, proximo);
  estado.ultimoEvento = { tipo: "novaVez", jogador: proximo, reforcos: estado.reforcosPendentes };
  return { ok: true, vez: proximo, reforcos: estado.reforcosPendentes };
}
