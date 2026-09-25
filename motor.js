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
     criarPartida(jogadores, opcoes)    -> cria a partida pronta (opcoes.modo: "classico" | "dominio" | "total")
     calcularReforcos(estado, id)       -> detalha reforços { base, porRegiao, ordem, total }
     posicionarReforco(estado, t, qtd)  -> põe reforços num território (respeita a restrição de região)
     terminarReforco(estado)            -> fecha reforços, abre ataque
     atacar(estado, origem, destino)    -> 1 ataque (1 rolagem)
     moverNaConquista(estado, total)    -> depois de conquistar, escolhe quantos exércitos entram
     terminarAtaque(estado)             -> fecha ataque, abre remanejo
     remanejar(estado, orig, dest, qtd) -> 1 pulo de remanejamento (vários por turno; trava por exército)
     passarVez(estado)                  -> fecha o turno e chama o próximo
     trocarCartas(estado, indices)      -> troca 3 cartas da mão por exércitos (fase de reforço)

   CONSULTAS (perguntas, não mudam nada):
     territoriosDe, contarExercitos, regioesDominadas,
     inimigosVizinhos, ehFronteira, frescosEm, jogadoresVivos,
     verificarVitoria, resumoJogadores,
     acharTroca, trocaValida, valorDaTroca, simboloDoTerritorio,
     objetivoCumprido, objetivoEfetivo, descreverObjetivo

   FORMATO DO ESTADO (tudo é dado simples, fácil de salvar/enviar):
     estado = {
       territorios: { "Defnas": { dono: 0, exercitos: 1 }, ... },
       modo:        "dominio",        // "classico" (objetivos) | "dominio" (5 regiões) | "total" (último de pé)
       jogadores:   [ { id, nome, tipo, cor, vivo, cartas: [ {t, s}, ... ],
                        objetivo (só no clássico), eliminadoPor (id de quem o eliminou) }, ... ],
       vez:               0,            // id de quem joga agora
       turno:             1,            // contador de rodadas
       fase:              "reforco",    // reforco|ataque|remanejamento|fim
       reforcosPendentes: 0,            // total de reforços que faltam posicionar
       reforco:           {...},        // detalhamento do reforço: { base, porRegiao, ordem }
       movidos:           {...},        // por território: exércitos que JÁ moveram nesta fase de remanejo (travados)
       baralho:           [ {t, s}, ...], // cartas para comprar (t = território ou null no coringa)
       descarte:          [ ... ],      // cartas já trocadas (voltam ao baralho quando ele acaba)
       trocasFeitas:      0,            // quantas trocas a mesa já fez (define o valor da próxima)
       conquistouNoTurno: false,        // o jogador da vez já conquistou algo neste turno?
       conquista:         null,         // { origem, destino } enquanto o jogador escolhe quantos entram
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

// Ordem fixa em que os bônus de região são posicionados (Modo B, sequência
// guiada). Usa as CHAVES REAIS de REGIOES. O reforço-base (geral) vem por
// último — ele não entra aqui porque não é preso a nenhuma região.
const ORDEM_REGIOES_REFORCO = [
  "Ériu", "Dál Riata", "Alba", "Northhymbre",
  "Mierce", "East Engle", "Westseaxe", "Cymru",
];

const LADOS_DADO = 8;           // dado de 8 lados (d8)
const MAX_DADOS_ATAQUE = 4;     // atacante rola até 4
const MAX_DADOS_DEFESA = 3;     // defensor rola até 3
const MAX_MOVER_CONQUISTA = 3;  // ao conquistar, entram no máximo 3 exércitos

// CARTAS — uma por território (símbolo fixo) + coringas.
const SIMBOLOS = ["espada", "escudo", "navio"];
const CORINGAS = 2;
// Quanto rende cada troca, na ordem em que a MESA troca (contador único
// para todos). Depois da última da lista, cada troca vale 5 a mais.
const VALORES_TROCA = [4, 6, 8, 10, 12, 15, 18, 20];
const BONUS_TERRITORIO_TROCA = 2; // carta trocada de território seu: +2 nele
const CARTAS_TROCA_OBRIGATORIA = 5; // com 5+ na mão, troca antes de posicionar

// MODOS DE JOGO
//   classico: cada um recebe um OBJETIVO secreto; vence quem cumprir o seu,
//             na hora, durante o próprio turno.
//   dominio:  vence quem tiver 5 das 8 regiões inteiras (checado no fim do turno).
//   total:    só vence o último de pé.
// Em todos os modos, sobrar um único jogador vivo também é vitória.
const MODOS = {
  classico: { nome: "Clássico", resumo: "Cada um recebe um objetivo secreto. Vence quem cumprir o seu primeiro." },
  dominio:  { nome: "Domínio", resumo: "Vence quem dominar 5 das 8 regiões inteiras." },
  total:    { nome: "Conquista Total", resumo: "Só vence o último de pé. Partida longa." },
};
const MODO_PADRAO = "dominio";

// OBJETIVOS do modo Clássico (nomes de época; aprovados por Kauã).
//   regioes: dominar todas as regiões da lista (+ "extra" regiões quaisquer).
//   territorios: ter pelo menos "qtd" territórios.
//   territorios2: ter pelo menos "qtd" territórios com "min"+ exércitos em cada.
//   destruir: eliminar o jogador do assento "alvo" (cor). Só é sorteado se
//     essa cor estiver na partida. Se for você mesmo, ou outro jogador
//     eliminá-la antes, o objetivo vira OBJETIVO_RESERVA (conquistar 36 territórios).
const OBJETIVO_RESERVA = { tipo: "territorios", qtd: 36 };
const NOMES_COR = ["vermelho", "azul", "verde", "âmbar", "roxo", "turquesa"];
const OBJETIVOS = [
  { id: "alto-rei", nome: "Alto-Rei da Irlanda", tipo: "regioes", regioes: ["Ériu", "Dál Riata"], extra: 0 },
  { id: "rota-dyflin", nome: "Rota de Dyflin", tipo: "regioes", regioes: ["Ériu", "Cymru"], extra: 0 },
  { id: "grande-exercito", nome: "Caminho do Grande Exército", tipo: "regioes", regioes: ["Northhymbre", "Mierce"], extra: 0 },
  { id: "sonho-alfredo", nome: "Sonho de Alfredo", tipo: "regioes", regioes: ["Westseaxe", "Mierce"], extra: 0 },
  { id: "senhor-norte", nome: "Senhor do Norte", tipo: "regioes", regioes: ["Northhymbre", "Alba"], extra: 0 },
  { id: "terras-offa", nome: "Terras de Offa", tipo: "regioes", regioes: ["Mierce", "East Engle", "Cymru"], extra: 0 },
  { id: "bretwalda-sul", nome: "Bretwalda do Sul", tipo: "regioes", regioes: ["Westseaxe", "East Engle", "Cymru"], extra: 0 },
  { id: "reino-alba", nome: "Reino de Alba", tipo: "regioes", regioes: ["Alba", "Dál Riata"], extra: 1 },
  { id: "eoforwic-lundenburg", nome: "De Eoforwic a Lundenburg", tipo: "regioes", regioes: ["Northhymbre", "Westseaxe"], extra: 0 },
  { id: "bretwalda", nome: "Bretwalda", tipo: "territorios", qtd: 36 },
  { id: "terra-assentada", nome: "Terra Assentada", tipo: "territorios2", qtd: 27, min: 2 },
  { id: "rixa-0", nome: "Rixa de Sangue", tipo: "destruir", alvo: 0 },
  { id: "rixa-1", nome: "Rixa de Sangue", tipo: "destruir", alvo: 1 },
  { id: "rixa-2", nome: "Rixa de Sangue", tipo: "destruir", alvo: 2 },
  { id: "rixa-3", nome: "Rixa de Sangue", tipo: "destruir", alvo: 3 },
  { id: "rixa-4", nome: "Rixa de Sangue", tipo: "destruir", alvo: 4 },
  { id: "rixa-5", nome: "Rixa de Sangue", tipo: "destruir", alvo: 5 },
];

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

// Exércitos "frescos" num território: os que AINDA NÃO se moveram nesta fase
// de remanejamento (só eles podem mover). Fora da fase de remanejo, ou logo no
// início dela, todos são frescos (movidos vazio => 0 movidos).
function frescosEm(estado, territorio) {
  const jaMovidos = (estado.movidos && estado.movidos[territorio]) || 0;
  return estado.territorios[territorio].exercitos - jaMovidos;
}

// Jogadores ainda vivos (com pelo menos 1 território).
function jogadoresVivos(estado) {
  return estado.jogadores.filter(function (j) { return j.vivo; });
}

// O jogador já cumpriu a condição de vitória do modo? (fora "último de pé",
// que vale em todos os modos e é checado à parte)
function verificarVitoria(estado, idJogador) {
  const modo = estado.modo || MODO_PADRAO;
  if (modo === "total") return false;
  if (modo === "classico") return objetivoCumprido(estado, idJogador);
  return regioesDominadas(estado, idJogador).length >= REGIOES_PARA_VENCER;
}

// O objetivo que VALE agora para o jogador (a "Rixa de Sangue" vira o
// objetivo reserva quando o alvo não existe, é ele mesmo, ou foi eliminado
// por outro).
function objetivoEfetivo(estado, idJogador) {
  const obj = estado.jogadores[idJogador].objetivo;
  if (!obj) return null;
  if (obj.tipo !== "destruir") return obj;
  const alvo = estado.jogadores[obj.alvo];
  if (!alvo || obj.alvo === idJogador) return OBJETIVO_RESERVA;
  if (!alvo.vivo && alvo.eliminadoPor !== idJogador) return OBJETIVO_RESERVA;
  return obj;
}

// O jogador cumpriu o seu objetivo (modo Clássico)?
function objetivoCumprido(estado, idJogador) {
  const obj = objetivoEfetivo(estado, idJogador);
  if (!obj || !estado.jogadores[idJogador].vivo) return false;
  if (obj.tipo === "regioes") {
    const dom = regioesDominadas(estado, idJogador);
    if (!obj.regioes.every(function (r) { return dom.indexOf(r) !== -1; })) return false;
    const outras = dom.filter(function (r) { return obj.regioes.indexOf(r) === -1; }).length;
    return outras >= (obj.extra || 0);
  }
  if (obj.tipo === "territorios") return territoriosDe(estado, idJogador).length >= obj.qtd;
  if (obj.tipo === "territorios2") {
    return territoriosDe(estado, idJogador).filter(function (t) {
      return estado.territorios[t].exercitos >= obj.min;
    }).length >= obj.qtd;
  }
  if (obj.tipo === "destruir") {
    const alvo = estado.jogadores[obj.alvo];
    return !alvo.vivo && alvo.eliminadoPor === idJogador;
  }
  return false;
}

// Texto do objetivo para mostrar na tela:
//   { nome, texto, original, reserva, motivo }
//   nome/texto = o objetivo que VALE agora; original = o sorteado;
//   reserva = true se a Rixa de Sangue virou "Bretwalda"; motivo = por quê.
function descreverObjetivo(estado, idJogador) {
  const obj = estado.jogadores[idJogador].objetivo;
  if (!obj) return null;
  const ef = objetivoEfetivo(estado, idJogador);
  const texto = function (o) {
    if (o.tipo === "regioes") {
      return "Conquistar " + o.regioes.join(" e ") + " inteiras" +
        (o.extra ? ", mais " + o.extra + " região à sua escolha" : "") + ".";
    }
    if (o.tipo === "territorios") return "Conquistar " + o.qtd + " territórios.";
    if (o.tipo === "territorios2") return "Conquistar " + o.qtd + " territórios com pelo menos " + o.min + " exércitos em cada.";
    if (o.tipo === "destruir") return "Eliminar o jogador " + NOMES_COR[o.alvo] + ".";
    return "";
  };
  const reserva = ef !== obj;
  let motivo = "";
  if (reserva) {
    const alvo = estado.jogadores[obj.alvo];
    const cor = "o jogador " + NOMES_COR[obj.alvo];
    if (!alvo) motivo = cor + " não está nesta partida";
    else if (obj.alvo === idJogador) motivo = cor + " é você mesmo";
    else {
      const quem = alvo.eliminadoPor != null ? estado.jogadores[alvo.eliminadoPor].nome : "outro jogador";
      motivo = cor + " (" + alvo.nome + ") foi eliminado por " + quem;
    }
  }
  return {
    nome: reserva ? "Bretwalda" : obj.nome,
    texto: reserva ? texto(OBJETIVO_RESERVA) : texto(obj),
    original: obj.nome + ": " + texto(obj),
    reserva: reserva,
    motivo: motivo,
  };
}

// Modo Clássico: vitória NA HORA, durante o turno do jogador da vez.
function checarObjetivo(estado) {
  if ((estado.modo || MODO_PADRAO) !== "classico" || estado.vencedor !== null) return;
  if (objetivoCumprido(estado, estado.vez)) declararVitoria(estado, estado.vez);
}

// Símbolo da carta de um território (fixo: segue a ordem de mapa.js,
// alternando espada/escudo/navio -> 22 espadas, 21 escudos, 21 navios).
function simboloDoTerritorio(t) {
  return SIMBOLOS[Object.keys(TERRITORIOS).indexOf(t) % SIMBOLOS.length];
}

// Quanto vale a troca de número n (0 = primeira troca da mesa).
function valorDaTroca(n) {
  if (n < VALORES_TROCA.length) return VALORES_TROCA[n];
  return VALORES_TROCA[VALORES_TROCA.length - 1] + 5 * (n - VALORES_TROCA.length + 1);
}

// 3 cartas formam troca? Três iguais OU três diferentes; o coringa vale qualquer símbolo.
function trocaValida(cartas) {
  if (!cartas || cartas.length !== 3) return false;
  const simb = cartas.filter(function (c) { return c.s !== "coringa"; }).map(function (c) { return c.s; });
  if (simb.length < 3) return true; // com coringa sempre fecha (iguais ou diferentes)
  const dif = new Set(simb).size;
  return dif === 1 || dif === 3;
}

// Melhor troca disponível na mão do jogador (índices de 3 cartas) ou null.
// Prefere trocas com cartas de territórios SEUS (rendem +2) e poupa coringas.
function acharTroca(estado, idJogador) {
  const mao = estado.jogadores[idJogador].cartas || [];
  let melhor = null, nota = -Infinity;
  for (let i = 0; i < mao.length; i++) for (let j = i + 1; j < mao.length; j++) for (let k = j + 1; k < mao.length; k++) {
    const trio = [mao[i], mao[j], mao[k]];
    if (!trocaValida(trio)) continue;
    let n = 0;
    trio.forEach(function (c) {
      if (c.s === "coringa") n -= 5;
      else if (estado.territorios[c.t].dono === idJogador) n += 10;
    });
    if (n > nota) { nota = n; melhor = [i, j, k]; }
  }
  return melhor;
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
      cartas: (j.cartas || []).length,
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
function criarPartida(jogadores, opcoes) {
  opcoes = opcoes || {};
  const n = jogadores.length;
  const modo = MODOS[opcoes.modo] ? opcoes.modo : MODO_PADRAO;

  const estado = {
    modo: modo,
    territorios: {},
    jogadores: jogadores.map(function (j, i) {
      return {
        id: i,
        nome: j.nome || ("Jogador " + (i + 1)),
        tipo: (j.tipo === "bot") ? "bot" : "humano",
        cor: j.cor || CORES[i % CORES.length],
        vivo: true,
        cartas: [],
        eliminadoPor: null,
      };
    }),
    vez: 0,
    turno: 1,
    fase: "reforco",
    reforcosPendentes: 0,
    reforco: null,               // detalhamento do reforço do jogador da vez (montado abaixo)
    movidos: {},                 // controle de remanejamento (frescos × movidos), por território
    baralho: [],
    descarte: [],
    trocasFeitas: 0,
    conquistouNoTurno: false,
    conquista: null,
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

  // Baralho: uma carta por território + os coringas, embaralhado.
  const cartas = Object.keys(TERRITORIOS).map(function (t) { return { t: t, s: simboloDoTerritorio(t) }; });
  for (let c = 0; c < CORINGAS; c++) cartas.push({ t: null, s: "coringa" });
  estado.baralho = embaralhar(cartas);

  // Clássico: cada jogador recebe um objetivo secreto diferente.
  // Rixa de Sangue só entra no sorteio se a cor-alvo estiver na partida
  // (pedido de Kauã). Contra a própria cor pode sair, como no WAR: vira reserva.
  if (modo === "classico") {
    const objs = embaralhar(OBJETIVOS.filter(function (o) { return o.tipo !== "destruir" || o.alvo < n; }));
    estado.jogadores.forEach(function (j, i) { j.objetivo = objs[i]; });
  }

  // Primeiro turno já montado: o jogador 0 recebe seu lote de reforços
  // (base = territórios ÷ 3, mínimo 3; + bônus por região completa) para posicionar.
  const det0 = calcularReforcos(estado, 0);
  estado.reforco = { base: det0.base, porRegiao: det0.porRegiao, ordem: det0.ordem };
  estado.reforcosPendentes = det0.total;
  anotar(estado, "Partida criada (modo " + MODOS[modo].nome + "). Territórios distribuídos.");
  return estado;
}


/* ----------------------------------------------------------------
   REFORÇOS
   ---------------------------------------------------------------- */
// Detalha os reforços do jogador neste turno:
//   base  = territórios ÷ 3 (arredondado ao MAIS PRÓXIMO, mínimo 3) -> GERAL,
//           pode ser posicionado em qualquer território seu.
//   porRegiao = { região: bônus } para cada região que ele domina INTEIRA;
//           esse bônus fica PRESO à própria região (só entra em território dela).
//   ordem = as regiões de porRegiao já na ordem fixa (ORDEM_REGIOES_REFORCO),
//           para a sequência guiada da tela (Modo B).
//   total = base + soma dos bônus (é o que vai em estado.reforcosPendentes).
// Obs.: como x/3 nunca dá ,50 exato (só ,33 ou ,67), o Math.round não
// tem ambiguidade — ,33 desce e ,67 sobe.
function calcularReforcos(estado, idJogador) {
  const nTerritorios = territoriosDe(estado, idJogador).length;
  const base = Math.max(MIN_REFORCO, Math.round(nTerritorios / 3));

  const dominadas = regioesDominadas(estado, idJogador);
  const porRegiao = {};
  let somaBonus = 0;
  ORDEM_REGIOES_REFORCO.forEach(function (r) {
    if (dominadas.indexOf(r) !== -1) {
      const b = bonusDaRegiao(r);
      if (b > 0) { porRegiao[r] = b; somaBonus += b; }
    }
  });

  const ordem = ORDEM_REGIOES_REFORCO.filter(function (r) { return porRegiao[r] > 0; });
  return { base: base, porRegiao: porRegiao, ordem: ordem, total: base + somaBonus };
}

// Posiciona "qtd" reforços num território do jogador da vez.
// Restrição (Modo B): o bônus de uma região SÓ pode entrar em território
// daquela região; o reforço-base (geral) entra em qualquer território seu.
// Ao posicionar, consome primeiro o bolsão da região do território (o menos
// flexível) e só depois o geral. A ORDEM guiada é responsabilidade da tela;
// aqui vale a restrição.
function posicionarReforco(estado, territorio, qtd) {
  if (qtd == null) qtd = 1;
  if (estado.fase !== "reforco")
    return { ok: false, erro: "Não é a fase de reforços." };
  const alvo = estado.territorios[territorio];
  if (!alvo) return { ok: false, erro: 'Território "' + territorio + '" não existe.' };
  if (alvo.dono !== estado.vez)
    return { ok: false, erro: "Esse território não é seu." };
  if (qtd < 1) return { ok: false, erro: "Quantidade inválida." };
  if (trocaObrigatoria(estado))
    return { ok: false, erro: "Você tem " + estado.jogadores[estado.vez].cartas.length + " cartas: troque antes de posicionar." };

  // Bolsões disponíveis para ESTE território: o da sua região (se houver) + o geral.
  const rf = estado.reforco || { base: estado.reforcosPendentes, porRegiao: {}, ordem: [] };
  const regiao = regiaoDe(territorio);
  const daRegiao = (rf.porRegiao && rf.porRegiao[regiao]) || 0;
  const disponivel = daRegiao + rf.base;
  if (qtd > disponivel) {
    if (daRegiao < qtd && rf.base < qtd && daRegiao === 0)
      return { ok: false, erro: "Você só tem " + rf.base + " de reforço geral para posicionar." };
    return { ok: false, erro: "Não há reforço suficiente para " + territorio + " (máximo " + disponivel + ")." };
  }

  // Consome o bolsão da região primeiro, depois o geral.
  let restante = qtd;
  const usarRegiao = Math.min(daRegiao, restante);
  if (usarRegiao > 0) {
    rf.porRegiao[regiao] -= usarRegiao;
    restante -= usarRegiao;
    if (rf.porRegiao[regiao] <= 0) delete rf.porRegiao[regiao];
  }
  if (restante > 0) { rf.base -= restante; restante = 0; }

  alvo.exercitos += qtd;
  estado.reforcosPendentes -= qtd;
  estado.ultimoEvento = { tipo: "reforco", territorio: territorio, qtd: qtd, restante: estado.reforcosPendentes };
  checarObjetivo(estado);
  return { ok: true, restante: estado.reforcosPendentes };
}

// Encerra a fase de reforços e abre a fase de ataque.
// Só funciona depois de posicionar TODOS os reforços.
function terminarReforco(estado) {
  if (estado.fase !== "reforco")
    return { ok: false, erro: "Não é a fase de reforços." };
  if (estado.reforcosPendentes > 0)
    return { ok: false, erro: "Ainda falta posicionar " + estado.reforcosPendentes + " reforço(s)." };
  if (trocaObrigatoria(estado))
    return { ok: false, erro: "Você tem " + estado.jogadores[estado.vez].cartas.length + " cartas: troque antes de seguir." };
  estado.fase = "ataque";
  estado.ultimoEvento = { tipo: "faseAtaque" };
  return { ok: true };
}


/* ----------------------------------------------------------------
   CARTAS — troca por exércitos (só na fase de reforço)
   ---------------------------------------------------------------- */
// O jogador da vez está com cartas demais e precisa trocar agora?
function trocaObrigatoria(estado) {
  const j = estado.jogadores[estado.vez];
  return (j.cartas || []).length >= CARTAS_TROCA_OBRIGATORIA;
}

// Troca 3 cartas da mão (índices) por exércitos. O valor segue o contador
// da MESA (4, 6, 8, 10, 12, 15, 18, 20, depois +5). Esses exércitos entram
// no reforço GERAL (o último da sequência do Modo B). Cada carta trocada de
// um território do próprio jogador põe +2 direto nele.
function trocarCartas(estado, indices) {
  if (estado.fase !== "reforco")
    return { ok: false, erro: "Só dá para trocar cartas na fase de reforços." };
  const j = estado.jogadores[estado.vez];
  const mao = j.cartas || [];
  if (!indices || indices.length !== 3 || new Set(indices).size !== 3 ||
      indices.some(function (i) { return i < 0 || i >= mao.length; }))
    return { ok: false, erro: "Escolha 3 cartas da sua mão." };
  const trio = indices.map(function (i) { return mao[i]; });
  if (!trocaValida(trio))
    return { ok: false, erro: "Precisa ser 3 símbolos iguais ou 3 diferentes (o coringa vale qualquer um)." };

  const valor = valorDaTroca(estado.trocasFeitas);
  estado.trocasFeitas += 1;
  if (!estado.reforco) estado.reforco = { base: 0, porRegiao: {}, ordem: [] };
  estado.reforco.base += valor;
  estado.reforcosPendentes += valor;

  const bonusEm = [];
  trio.forEach(function (c) {
    if (c.t && estado.territorios[c.t].dono === estado.vez) {
      estado.territorios[c.t].exercitos += BONUS_TERRITORIO_TROCA;
      bonusEm.push(c.t);
    }
  });
  indices.slice().sort(function (a, b) { return b - a; }).forEach(function (i) { mao.splice(i, 1); });
  trio.forEach(function (c) { estado.descarte.push(c); });

  anotar(estado, j.nome + " trocou cartas: +" + valor + " exércitos" +
    (bonusEm.length ? " (+" + BONUS_TERRITORIO_TROCA + " em " + bonusEm.join(", ") + ")" : "") + ".");
  estado.ultimoEvento = { tipo: "troca", valor: valor, bonusEm: bonusEm };
  checarObjetivo(estado);
  return { ok: true, valor: valor, bonusEm: bonusEm, proxima: valorDaTroca(estado.trocasFeitas) };
}

// Tira uma carta do baralho para o jogador (reembaralha o descarte se acabar).
function comprarCarta(estado, idJogador) {
  if (!estado.baralho.length) { estado.baralho = embaralhar(estado.descarte); estado.descarte = []; }
  if (!estado.baralho.length) return null;
  const c = estado.baralho.pop();
  estado.jogadores[idJogador].cartas.push(c);
  anotar(estado, estado.jogadores[idJogador].nome + " recebeu uma carta.");
  return c;
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
//   Sem informar, leva o nº de dados que rolou. Sempre deixa 1 atrás e
//   nunca passa de MAX_MOVER_CONQUISTA (3).
// opcoes.escolher (opcional, a tela usa): ao conquistar, entra só 1 e a
//   conquista fica "aberta" em estado.conquista; o jogador escolhe o total
//   com moverNaConquista. Qualquer outra ação fecha a escolha (fica o que entrou).
function atacar(estado, origem, destino, opcoes) {
  opcoes = opcoes || {};
  if (estado.fase !== "ataque")
    return { ok: false, erro: "Não é a fase de ataque." };
  estado.conquista = null; // atacar de novo fecha uma escolha de conquista em aberto
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
    const donoAntigo = d.dono;
    let mover = opcoes.escolher ? 1 : (opcoes.mover != null) ? opcoes.mover : nAtq;
    mover = Math.max(1, Math.min(mover, MAX_MOVER_CONQUISTA, a.exercitos - 1));
    a.exercitos -= mover;
    d.exercitos = mover;
    d.dono = estado.vez;
    exercitosMovidos = mover;
    estado.conquistouNoTurno = true;
    if (opcoes.escolher && a.exercitos > 1) estado.conquista = { origem: origem, destino: destino };
    anotar(estado, estado.jogadores[estado.vez].nome + " conquistou " + destino + ".");
    marcarEliminados(estado);
    // Quem elimina um jogador fica com as cartas dele.
    const vitima = estado.jogadores[donoAntigo];
    if (!vitima.vivo && vitima.eliminadoPor == null) vitima.eliminadoPor = estado.vez;
    if (!vitima.vivo && vitima.cartas && vitima.cartas.length) {
      const herdadas = vitima.cartas.length;
      estado.jogadores[estado.vez].cartas = estado.jogadores[estado.vez].cartas.concat(vitima.cartas);
      vitima.cartas = [];
      anotar(estado, estado.jogadores[estado.vez].nome + " ficou com " + herdadas + " carta(s) de " + vitima.nome + ".");
    }
    // Se sobrou um só jogador vivo, a partida acaba na hora.
    if (jogadoresVivos(estado).length === 1)
      declararVitoria(estado, jogadoresVivos(estado)[0].id);
    else checarObjetivo(estado);
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
    // com opcoes.escolher: até quantos exércitos podem ficar no conquistado
    podeFicarAte: estado.conquista ? Math.min(MAX_MOVER_CONQUISTA, d.exercitos + a.exercitos - 1) : null,
  };
}

// Depois de uma conquista com opcoes.escolher: define quantos exércitos
// ficam no território conquistado (total: 1, 2 ou 3, sempre deixando 1 na origem).
function moverNaConquista(estado, total) {
  const c = estado.conquista;
  if (!c) return { ok: false, erro: "Não há conquista esperando a escolha." };
  const a = estado.territorios[c.origem], d = estado.territorios[c.destino];
  const max = Math.min(MAX_MOVER_CONQUISTA, d.exercitos + a.exercitos - 1);
  if (total == null || total < 1 || total > max)
    return { ok: false, erro: "Escolha entre 1 e " + max + "." };
  const extra = total - d.exercitos;
  a.exercitos -= extra;
  d.exercitos += extra;
  estado.conquista = null;
  estado.ultimoEvento = { tipo: "conquistaMovida", origem: c.origem, destino: c.destino, total: total };
  checarObjetivo(estado);
  return { ok: true, origem: c.origem, destino: c.destino, total: total };
}

// Encerra a fase de ataque e abre o remanejamento.
function terminarAtaque(estado) {
  if (estado.fase !== "ataque")
    return { ok: false, erro: "Não é a fase de ataque." };
  estado.fase = "remanejamento";
  estado.conquista = null;
  // Início do remanejamento: TODOS os exércitos entram "frescos" (movidos vazio).
  // Isso inclui os que avançaram para um território conquistado durante o ataque
  // — a trava só conta movimentos feitos DENTRO da fase de remanejamento.
  estado.movidos = {};
  estado.ultimoEvento = { tipo: "faseRemanejo" };
  return { ok: true };
}


/* ----------------------------------------------------------------
   REMANEJAMENTO — vários pulos por turno, com trava por exército
   ---------------------------------------------------------------- */
// Cada chamada é UM pulo entre dois territórios seus que fazem fronteira.
// Pode-se chamar quantas vezes quiser na fase. Regras:
//   - só os exércitos "frescos" (que ainda não se moveram nesta fase) podem sair;
//   - sempre fica pelo menos 1 exército na origem (não esvaziar);
//   - ao chegar ao destino, os exércitos que vieram TRAVAM (viram "movidos"),
//     então não se movem de novo nesta fase. Os que já estavam no destino e
//     ainda estão frescos continuam livres para um próximo pulo.
function remanejar(estado, origem, destino, qtd) {
  if (estado.fase !== "remanejamento")
    return { ok: false, erro: "Não é a fase de remanejamento." };
  if (!estado.movidos) estado.movidos = {};
  const a = estado.territorios[origem];
  const d = estado.territorios[destino];
  if (!a) return { ok: false, erro: 'Território "' + origem + '" não existe.' };
  if (!d) return { ok: false, erro: 'Território "' + destino + '" não existe.' };
  if (a.dono !== estado.vez || d.dono !== estado.vez)
    return { ok: false, erro: "Os dois territórios precisam ser seus." };
  if (vizinhosDe(origem).indexOf(destino) === -1)
    return { ok: false, erro: origem + " e " + destino + " não são vizinhos." };
  if (qtd == null || qtd < 1) return { ok: false, erro: "Quantidade inválida." };

  const frescos = frescosEm(estado, origem);   // só estes podem sair
  if (frescos <= 0)
    return { ok: false, erro: "Esses exércitos já se moveram nesta fase." };
  const limite = Math.min(frescos, a.exercitos - 1); // e sempre deixa 1 na origem
  if (qtd > limite)
    return { ok: false, erro: "Só dá para mover " + Math.max(0, limite) + " daqui (tropa fresca, deixando 1)." };

  a.exercitos -= qtd;
  d.exercitos += qtd;
  // Os que chegaram travam no destino. Na origem, movidos[origem] não muda
  // (só saíram exércitos frescos; os já-travados continuam contados lá).
  estado.movidos[destino] = ((estado.movidos && estado.movidos[destino]) || 0) + qtd;
  estado.ultimoEvento = { tipo: "remanejo", origem: origem, destino: destino, qtd: qtd };
  checarObjetivo(estado);
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
  estado.conquista = null;

  // Conquistou pelo menos 1 território neste turno? Ganha UMA carta.
  let carta = null;
  if (estado.conquistouNoTurno) carta = comprarCarta(estado, estado.vez);
  estado.conquistouNoTurno = false;

  // Vitória do jogador da vez? (pela condição do modo: 5 regiões ou objetivo)
  if (verificarVitoria(estado, estado.vez)) {
    declararVitoria(estado, estado.vez);
    return { ok: true, vencedor: estado.vez, carta: carta };
  }
  // Sobrou um só jogador? (vitória por "último de pé")
  if (jogadoresVivos(estado).length === 1) {
    const ultimo = jogadoresVivos(estado)[0].id;
    declararVitoria(estado, ultimo);
    return { ok: true, vencedor: ultimo, carta: carta };
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
  estado.movidos = {};                 // zera o controle de remanejamento
  const det = calcularReforcos(estado, proximo);
  estado.reforco = { base: det.base, porRegiao: det.porRegiao, ordem: det.ordem };
  estado.reforcosPendentes = det.total;
  estado.ultimoEvento = { tipo: "novaVez", jogador: proximo, reforcos: estado.reforcosPendentes };
  return { ok: true, vez: proximo, reforcos: estado.reforcosPendentes, carta: carta };
}
