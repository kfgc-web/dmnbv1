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
     criarPartida(jogadores, opcoes)    -> cria a partida pronta (opcoes.modo: veja MODOS;
                                           opcoes.tamanhoEquipe: 2 ou 3 no modo "equipes";
                                           opcoes.semente: a sorte da partida (online);
                                           opcoes.equipesProntas: equipes já montadas na ordem)
     calcularReforcos(estado, id)       -> detalha reforços { base, porRegiao, ordem, total }
     posicionarReforco(estado, t, qtd)  -> põe reforços num território (respeita a restrição de região)
     terminarReforco(estado)            -> fecha reforços, abre ataque
     atacar(estado, origem, destino)    -> 1 ataque (1 rolagem)
     moverNaConquista(estado, total)    -> depois de conquistar, escolhe quantos exércitos entram
     terminarAtaque(estado)             -> fecha ataque, abre remanejo
     remanejar(estado, orig, dest, qtd) -> 1 pulo de remanejamento (vários por turno; trava por exército)
     passarVez(estado)                  -> fecha o turno e chama o próximo
     trocarCartas(estado, indices)      -> troca 3 cartas da mão por exércitos (fase de reforço)
     aplicarAcao(estado, acao)          -> aplica UMA jogada descrita como dado simples
                                           (o online guarda a partida como lista delas)

   CONSULTAS (perguntas, não mudam nada):
     territoriosDe, contarExercitos, regioesDominadas,
     inimigosVizinhos, ehFronteira, frescosEm, jogadoresVivos,
     verificarVitoria, resumoJogadores,
     acharTroca, trocaValida, valorDaTroca, simboloDoTerritorio,
     objetivoCumprido, objetivoEfetivo, descreverObjetivo,
     modoDisponivel, saoAliados, regioesDaEquipe, membrosDaEquipe,
     pontosRapida, ehViking, descreverMeta

   FORMATO DO ESTADO (tudo é dado simples, fácil de salvar/enviar):
     estado = {
       territorios: { "Defnas": { dono: 0, exercitos: 1 }, ... },
       modo:        "dominio",        // chave de MODOS (tutorial, classico, dominio, total, rapida, grande, equipes)
       semente, rng:  números da sorte combinada (todo dado/embaralhada sai daqui)
       jogadores:   [ { id, nome, tipo, cor, vivo, cartas: [ {t, s}, ... ],
                        objetivo (só no clássico), eliminadoPor (id de quem o eliminou),
                        reino + pontos + revide (só no Grande Exército: quem atacou este reino),
                        equipe (só no Equipes) }, ... ],
       vez:               0,            // id de quem joga agora
       turno:             1,            // contador de rodadas
       fase:              "reforco",    // reforco|ataque|remanejamento|fim
       reforcosPendentes: 0,            // total de reforços que faltam posicionar
       reforco:           {...},        // detalhamento do reforço: { base, porRegiao, ordem, mar }
       movidos:           {...},        // por território: exércitos que JÁ moveram nesta fase de remanejo (travados)
       baralho:           [ {t, s}, ...], // cartas para comprar (t = território ou null no coringa)
       descarte:          [ ... ],      // cartas já trocadas (voltam ao baralho quando ele acaba)
       trocasFeitas:      0,            // quantas trocas a mesa já fez (define o valor da próxima)
       conquistouNoTurno: false,        // o jogador da vez já conquistou algo neste turno?
       conquista:         null,         // { origem, destino } enquanto o jogador escolhe quantos entram
       vencedor:          null,         // id quando alguém vence
       resultado:         null,         // como a partida acabou (p/ a tela): { motivo, ... }
       ultimoGolpe:       null,         // Grande Exército: quem tomou o último território viking
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
//   rapida:   acaba depois de RODADAS_RAPIDA rodadas; vence quem tiver mais pontos
//             (1 por território; 3 por território de região inteira sua).
//   grande:   Grande Exército — 9 assentos fixos: os Vikings contra os 8 reinos.
//   equipes:  duplas ou trios sorteados; vence a equipe com 5 das 8 regiões.
//   tutorial: partida guiada (só sozinho): você + 3 bots mais fracos (bots.js);
//             você vence ao fechar REGIOES_TUTORIAL regiões inteiras, na hora.
//             Um bot vence com 5 regiões (como no Domínio) ou eliminando você —
//             sem isso, partidas só de bots empacavam (bot com 6 regiões e
//             exércitos aos milhares, sem nunca vencer).
const MODOS = {
  tutorial: { nome: "Tutorial", resumo: "Uma partida guiada contra 3 bots mais fracos: feche 3 regiões inteiras, à sua escolha." },
  classico: { nome: "Clássico", resumo: "Cada um recebe um objetivo secreto. Vence quem cumprir o seu primeiro." },
  dominio:  { nome: "Domínio", resumo: "Vence quem dominar 5 das 8 regiões inteiras." },
  total:    { nome: "Conquista Total", resumo: "Só vence o último de pé. Partida longa." },
  rapida:   { nome: "Partida Rápida", resumo: "15 rodadas. No fim, cada território vale 1 ponto, ou 3 se a região inteira for sua." },
  grande:   { nome: "Grande Exército", resumo: "Os vikings invadem e cada reino é um jogador (9 lugares). Vikings: dominar 4 regiões. Reinos: expulsar os vikings; vence o reino com mais pontos (1 por exército viking derrotado). Reinos podem se atacar, e quem é atacado revida." },
  equipes:  { nome: "Equipes", resumo: "Duplas ou trios sorteados, sem atacar o parceiro. Vence a equipe com 5 das 8 regiões." },
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
const NOMES_COR = ["vermelho", "azul", "verde", "âmbar", "roxo", "turquesa", "preto", "branco", "rosa"];
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

// Cor de cada assento (até 6 jogadores; as 3 últimas são do Grande Exército).
const CORES = ["#c0392b", "#2c6fbb", "#27ae60", "#e0a200", "#8e44ad", "#16a085", "#1e1e1e", "#ecf0f1", "#e84393"];

// PARTIDA RÁPIDA
const RODADAS_RAPIDA = 15;
const PONTOS_TERRITORIO = 1;          // cada território
const PONTOS_TERRITORIO_REGIAO = 3;   // cada território de uma região inteira sua

// GRANDE EXÉRCITO (regras fechadas com Kauã)
// Assentos fixos, na ORDEM DE JOGADA (dos mais "afetados" para os menos).
const VIKINGS = "Vikings";
const REINOS_GRANDE = [VIKINGS, "East Engle", "Northhymbre", "Mierce", "Westseaxe", "Cymru", "Dál Riata", "Alba", "Ériu"];
// Cor de cada lado (escolhida para contrastar com a cor da própria região).
const COR_REINO = {
  "Vikings": "#1e1e1e", "East Engle": "#2c6fbb", "Northhymbre": "#e0a200", "Mierce": "#27ae60",
  "Westseaxe": "#8e44ad", "Cymru": "#ecf0f1", "Dál Riata": "#c0392b", "Alba": "#16a085", "Ériu": "#e84393",
};
const INICIO_VIKINGS = ["Eoforwic", "Streoneshalh", "Mameceaster", "Northfolc", "Suthfolc"];
const EXERCITOS_INICIO_GRANDE = { "Vikings": 7, "East Engle": 3, "Northhymbre": 2 }; // os demais: 1
const REFORCO_MAR = 3;                // vikings: +3 por turno, só no litoral
const META_VIKINGS = ["Northhymbre", "Mierce", "East Engle", "Westseaxe"];

// EQUIPES
const NOMES_EQUIPE = ["A", "B", "C"];

// TUTORIAL
const REGIOES_TUTORIAL = 3;           // regiões inteiras (à sua escolha) para vencer
const JOGADORES_TUTORIAL = 4;         // você + 3 bots


/* ----------------------------------------------------------------
   UTILIDADES
   ---------------------------------------------------------------- */

// SORTE COMBINADA: todo sorteio (dados, embaralhar) sai de um gerador que
// vive no próprio estado (estado.rng, um número). Com a mesma semente e as
// mesmas jogadas, qualquer aparelho chega exatamente ao mesmo resultado — é
// o que deixa o online conferir os dados de todo mundo (ninguém inventa um 8).
// Gerador mulberry32: devolve um número em [0, 1) e avança estado.rng.
function sorte(estado) {
  let t = (estado.rng = (estado.rng + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Semente nova (partida sozinho; no online, quem cria a sala sorteia e manda).
function novaSemente() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

// Embaralha uma cópia do array (Fisher–Yates). Mesmo método do Super Trunfo.
function embaralhar(array, estado) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(sorte(estado) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Rola um dado de 8 lados: devolve um número de 1 a 8.
function rolarD8(estado) {
  return 1 + Math.floor(sorte(estado) * LADOS_DADO);
}

// Rola um dado de 6 lados (só no desempate final).
function rolarD6(estado) {
  return 1 + Math.floor(sorte(estado) * 6);
}

// Rola "qtd" dados e devolve já ordenados do MAIOR para o menor.
function rolarDados(qtd, estado) {
  const dados = [];
  for (let i = 0; i < qtd; i++) dados.push(rolarD8(estado));
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
// No modo Equipes, o parceiro não conta como inimigo.
function inimigosVizinhos(estado, territorio) {
  const dono = estado.territorios[territorio].dono;
  return vizinhosDe(territorio).filter(function (v) {
    const outro = estado.territorios[v].dono;
    return outro !== dono && !saoAliados(estado, dono, outro);
  });
}

// Modo Equipes: os dois jogadores são parceiros (mesma equipe)?
function saoAliados(estado, a, b) {
  if (estado.modo !== "equipes" || a === b) return false;
  return estado.jogadores[a].equipe === estado.jogadores[b].equipe;
}

// Modo Equipes: ids dos jogadores de uma equipe.
function membrosDaEquipe(estado, equipe) {
  return estado.jogadores.filter(function (j) { return j.equipe === equipe; }).map(function (j) { return j.id; });
}

// Modo Equipes: regiões inteiras nas mãos da equipe (somando os parceiros).
function regioesDaEquipe(estado, equipe) {
  return Object.keys(REGIOES).filter(function (r) {
    return territoriosDaRegiao(r).every(function (t) {
      return estado.jogadores[estado.territorios[t].dono].equipe === equipe;
    });
  });
}

// Modo Equipes: quem da equipe recebe o bônus de uma região da equipe —
// quem tem mais territórios nela; empate: mais exércitos lá; depois, quem joga antes.
function beneficiarioDaRegiao(estado, regiao) {
  const conta = {};
  territoriosDaRegiao(regiao).forEach(function (t) {
    const d = estado.territorios[t];
    if (!conta[d.dono]) conta[d.dono] = { id: d.dono, terr: 0, exe: 0 };
    conta[d.dono].terr += 1;
    conta[d.dono].exe += d.exercitos;
  });
  return Object.keys(conta).map(function (k) { return conta[k]; }).sort(function (a, b) {
    return (b.terr - a.terr) || (b.exe - a.exe) || (a.id - b.id);
  })[0].id;
}

// Regiões cujo bônus vai para o jogador neste turno (no Equipes, as da equipe
// em que ele é o beneficiário; nos outros modos, as que ele tem inteiras).
function regioesComBonus(estado, idJogador) {
  if (estado.modo !== "equipes") return regioesDominadas(estado, idJogador);
  return regioesDaEquipe(estado, estado.jogadores[idJogador].equipe).filter(function (r) {
    return beneficiarioDaRegiao(estado, r) === idJogador;
  });
}

// Grande Exército: este jogador é o dos Vikings?
function ehViking(estado, idJogador) {
  return estado.modo === "grande" && estado.jogadores[idJogador].reino === VIKINGS;
}

// Partida Rápida: pontos do jogador agora (1 por território; 3 por
// território de região inteira dele).
function pontosRapida(estado, idJogador) {
  const dom = regioesDominadas(estado, idJogador);
  return territoriosDe(estado, idJogador).reduce(function (s, t) {
    return s + (dom.indexOf(regiaoDe(t)) !== -1 ? PONTOS_TERRITORIO_REGIAO : PONTOS_TERRITORIO);
  }, 0);
}

// O modo pode ser jogado com n jogadores? (Grande Exército tem sempre 9 lugares;
// Equipes só com 4 ou 6; os outros de 2 a 6.)
function modoDisponivel(modo, n) {
  if (modo === "grande") return true;
  if (modo === "tutorial") return n === JOGADORES_TUTORIAL;
  if (modo === "equipes") return n === 4 || n === 6;
  return n >= 2 && n <= 6;
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
  if (modo === "total" || modo === "rapida") return false;
  if (modo === "classico") return objetivoCumprido(estado, idJogador);
  if (modo === "grande") return vikingsCumpriram(estado, idJogador);
  if (modo === "tutorial") return tutorialCumprido(estado, idJogador);
  if (modo === "equipes")
    return regioesDaEquipe(estado, estado.jogadores[idJogador].equipe).length >= REGIOES_PARA_VENCER;
  return regioesDominadas(estado, idJogador).length >= REGIOES_PARA_VENCER;
}

// Grande Exército: os Vikings já têm as 4 regiões da meta inteiras?
function vikingsCumpriram(estado, idJogador) {
  if (!ehViking(estado, idJogador) || !estado.jogadores[idJogador].vivo) return false;
  const dom = regioesDominadas(estado, idJogador);
  return META_VIKINGS.every(function (r) { return dom.indexOf(r) !== -1; });
}

// Tutorial: o jogador fechou as 3 regiões pedidas, ou um bot fechou 5?
function tutorialCumprido(estado, idJogador) {
  const j = estado.jogadores[idJogador];
  const meta = j.tipo === "humano" ? REGIOES_TUTORIAL : REGIOES_PARA_VENCER;
  return j.vivo && regioesDominadas(estado, idJogador).length >= meta;
}
// Como acabou o Tutorial para quem venceu: "tutorial" (o jogador) ou "derrota" (um bot).
function motivoTutorial(estado, idJogador) {
  return estado.jogadores[idJogador].tipo === "humano" ? "tutorial" : "derrota";
}

// Texto da meta do jogador nos modos sem objetivo secreto (p/ o painel).
function descreverMeta(estado, idJogador) {
  const j = estado.jogadores[idJogador];
  if (estado.modo === "grande") {
    return ehViking(estado, idJogador)
      ? "Dominar " + META_VIKINGS.slice(0, -1).join(", ") + " e " + META_VIKINGS[META_VIKINGS.length - 1] + " inteiras."
      : "Expulsar os vikings. Quando eles caírem, vence o reino com mais pontos (1 por exército viking derrotado, no ataque ou na defesa).";
  }
  if (estado.modo === "equipes") {
    const parceiros = membrosDaEquipe(estado, j.equipe).filter(function (id) { return id !== idJogador; })
      .map(function (id) { return estado.jogadores[id].nome; });
    return "Equipe " + NOMES_EQUIPE[j.equipe] + " (com " + parceiros.join(" e ") + "): dominar 5 das 8 regiões somando a equipe.";
  }
  if (estado.modo === "rapida") return MODOS.rapida.resumo;
  return MODOS[estado.modo].resumo;
}

// O objetivo que VALE agora para o jogador (a "Rixa de Sangue" vira o
// objetivo reserva quando o alvo não existe, é ele mesmo, ou foi eliminado
// por outro).
// Rixa de Sangue: o alvo é a COR (índice em CORES); devolve o jogador que
// está com essa cor na partida, ou null.
function alvoDaRixa(estado, obj) {
  const j = estado.jogadores.filter(function (x) { return x.cor === CORES[obj.alvo]; })[0];
  return j ? j.id : null;
}

function objetivoEfetivo(estado, idJogador) {
  const obj = estado.jogadores[idJogador].objetivo;
  if (!obj) return null;
  if (obj.tipo !== "destruir") return obj;
  const idAlvo = alvoDaRixa(estado, obj);
  const alvo = idAlvo !== null ? estado.jogadores[idAlvo] : null;
  if (!alvo || idAlvo === idJogador) return OBJETIVO_RESERVA;
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
    const alvo = estado.jogadores[alvoDaRixa(estado, obj)];
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
    const idAlvo = alvoDaRixa(estado, obj);
    const alvo = idAlvo !== null ? estado.jogadores[idAlvo] : null;
    const cor = "o jogador " + NOMES_COR[obj.alvo];
    if (!alvo) motivo = cor + " não está nesta partida";
    else if (idAlvo === idJogador) motivo = cor + " é você mesmo";
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

// Vitória NA HORA, durante o turno do jogador da vez: objetivo do Clássico
// ou a meta dos Vikings no Grande Exército.
function checarNaHora(estado) {
  if (estado.vencedor !== null) return;
  const modo = estado.modo || MODO_PADRAO;
  if (modo === "classico" && objetivoCumprido(estado, estado.vez))
    declararVitoria(estado, estado.vez, { motivo: "objetivo" });
  else if (modo === "grande" && vikingsCumpriram(estado, estado.vez))
    declararVitoria(estado, estado.vez, { motivo: "vikings" });
  else if (modo === "tutorial" && tutorialCumprido(estado, estado.vez))
    declararVitoria(estado, estado.vez, { motivo: motivoTutorial(estado, estado.vez) });
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
      reino: j.reino || null,
      pontos: estado.modo === "grande" ? (j.pontos || 0) : estado.modo === "rapida" ? pontosRapida(estado, j.id) : null,
      equipe: estado.modo === "equipes" ? j.equipe : null,
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

// Declara vitória de um jogador e congela a partida. "info" diz como
// acabou (motivo + detalhes) e fica em estado.resultado para a tela.
function declararVitoria(estado, idJogador, info) {
  estado.vencedor = idJogador;
  estado.fase = "fim";
  estado.resultado = info || { motivo: "regioes" };
  estado.ultimoEvento = { tipo: "vitoria", vencedor: idJogador };
  if (estado.modo === "equipes") {
    const eq = estado.jogadores[idJogador].equipe;
    estado.resultado.equipe = eq;
    anotar(estado, "A equipe " + NOMES_EQUIPE[eq] + " venceu a partida!");
  } else {
    anotar(estado, estado.jogadores[idJogador].nome + " venceu a partida!");
  }
  return estado;
}

// Sobrou um lado só? (um jogador vivo; no Equipes, todos os vivos da mesma equipe)
function ladoQueSobrou(estado) {
  const vivos = jogadoresVivos(estado);
  if (vivos.length === 1) return vivos[0].id;
  if (estado.modo === "equipes" && vivos.every(function (j) { return j.equipe === vivos[0].equipe; }))
    return vivos.some(function (j) { return j.id === estado.vez; }) ? estado.vez : vivos[0].id;
  return null;
}

// Desempate: aplica os critérios em ordem (cada um: { nome, valor(id) }) até
// sobrar um. Se ainda empatar, cada um rola 1 d6 (de novo, se empatar).
// Devolve { vencedor, decidiu (nome do critério que desempatou), dados }.
function desempatar(estado, ids, criterios) {
  let restantes = ids.slice(), decidiu = null;
  for (let i = 0; i < criterios.length && restantes.length > 1; i++) {
    const c = criterios[i];
    const melhor = Math.max.apply(null, restantes.map(c.valor));
    restantes = restantes.filter(function (id) { return c.valor(id) === melhor; });
    if (restantes.length === 1) decidiu = c.nome;
  }
  const dados = [];
  while (restantes.length > 1) {
    const rolagem = {};
    restantes.forEach(function (id) { rolagem[id] = rolarD6(estado); });
    dados.push(rolagem);
    const melhor = Math.max.apply(null, restantes.map(function (id) { return rolagem[id]; }));
    restantes = restantes.filter(function (id) { return rolagem[id] === melhor; });
    decidiu = "dados";
  }
  return { vencedor: restantes[0], decidiu: decidiu, dados: dados };
}

// Partida Rápida: fim das rodadas -> conta os pontos e declara o vencedor.
// Desempate: mais exércitos; depois, 1 d6 cada.
function finalizarRapida(estado) {
  const vivos = jogadoresVivos(estado).map(function (j) { return j.id; });
  const placar = estado.jogadores.map(function (j) {
    return { id: j.id, pontos: pontosRapida(estado, j.id), territorios: territoriosDe(estado, j.id).length, exercitos: contarExercitos(estado, j.id) };
  });
  const d = desempatar(estado, vivos, [
    { nome: "pontos", valor: function (id) { return placar[id].pontos; } },
    { nome: "exercitos", valor: function (id) { return placar[id].exercitos; } },
  ]);
  anotar(estado, "Fim das " + RODADAS_RAPIDA + " rodadas!");
  return declararVitoria(estado, d.vencedor, { motivo: "rapida", placar: placar, decidiu: d.decidiu, dados: d.dados });
}

// Grande Exército: os Vikings caíram -> vence o reino VIVO com mais pontos.
// Desempate: quem tomou o último território viking; mais territórios; mais
// exércitos; depois, 1 d6 cada.
function finalizarGrande(estado) {
  const vivos = jogadoresVivos(estado).filter(function (j) { return !ehViking(estado, j.id); }).map(function (j) { return j.id; });
  const placar = estado.jogadores.filter(function (j) { return !ehViking(estado, j.id); }).map(function (j) {
    return { id: j.id, pontos: j.pontos || 0, vivo: j.vivo, territorios: territoriosDe(estado, j.id).length, exercitos: contarExercitos(estado, j.id) };
  });
  const de = function (id) { return placar.filter(function (p) { return p.id === id; })[0]; };
  const d = desempatar(estado, vivos, [
    { nome: "pontos", valor: function (id) { return de(id).pontos; } },
    { nome: "ultimoGolpe", valor: function (id) { return id === estado.ultimoGolpe ? 1 : 0; } },
    { nome: "territorios", valor: function (id) { return de(id).territorios; } },
    { nome: "exercitos", valor: function (id) { return de(id).exercitos; } },
  ]);
  anotar(estado, "Os vikings foram expulsos!");
  return declararVitoria(estado, d.vencedor, { motivo: "reinos", placar: placar, decidiu: d.decidiu, dados: d.dados });
}


/* ----------------------------------------------------------------
   CRIAR A PARTIDA — distribui território e exércitos, começa o jogo
   ---------------------------------------------------------------- */
// "jogadores" é uma lista de { nome, tipo } — tipo "humano" ou "bot".
// Recomendado de 4 a 6, mas funciona de 2 a 6 (bom pra testar).
//   Grande Exército: sempre 9 assentos, na ordem de REINOS_GRANDE (a lista
//     dada ocupa os assentos nessa ordem; o que faltar vira bot).
//   Equipes: 4 ou 6 jogadores; opcoes.tamanhoEquipe = 2 ou 3. O jogo sorteia
//     as equipes e a sequência (as vezes se alternam entre as equipes).
function criarPartida(jogadores, opcoes) {
  opcoes = opcoes || {};
  let modo = MODOS[opcoes.modo] ? opcoes.modo : MODO_PADRAO;
  let tamEquipe = opcoes.tamanhoEquipe === 3 ? 3 : 2;
  if (modo === "equipes") {
    if (!modoDisponivel("equipes", jogadores.length)) modo = MODO_PADRAO;
    else if (jogadores.length % tamEquipe !== 0 || jogadores.length / tamEquipe < 2) tamEquipe = 2;
  }
  if (modo === "grande") {
    jogadores = REINOS_GRANDE.map(function (r, i) {
      const j = jogadores[i] || {};
      return { nome: j.nome || r, tipo: j.tipo || "bot", reino: r, cor: COR_REINO[r] };
    });
  }
  // Sorte da partida: opcoes.semente (online: a mesma em todos os aparelhos).
  const semente = opcoes.semente != null ? (opcoes.semente >>> 0) : novaSemente();
  const inicio = { rng: semente };
  // Equipes: o jogo sorteia assentos = equipes + sequência. Com
  // opcoes.equipesProntas (online, equipes montadas na sala) a lista já vem
  // na ordem de jogada, alternando as equipes (assento i = equipe i % nº).
  if (modo === "equipes" && !opcoes.equipesProntas) jogadores = embaralhar(jogadores, inicio);
  const n = jogadores.length;
  const nEquipes = n / tamEquipe;

  const estado = {
    modo: modo,
    semente: semente,
    rng: inicio.rng,             // gerador da sorte (avança a cada dado/embaralhada)
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
    resultado: null,
    ultimoGolpe: null,
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

  if (modo === "grande") {
    // Cada reino começa com a própria região; os Vikings, com INICIO_VIKINGS.
    estado.jogadores.forEach(function (j) { j.reino = REINOS_GRANDE[j.id]; j.pontos = 0; j.revide = []; });
    Object.keys(TERRITORIOS).forEach(function (t) {
      const reino = INICIO_VIKINGS.indexOf(t) !== -1 ? VIKINGS : regiaoDe(t);
      estado.territorios[t] = { dono: REINOS_GRANDE.indexOf(reino), exercitos: EXERCITOS_INICIO_GRANDE[reino] || BASE_POR_TERRITORIO };
    });
  } else {
    // Distribuição: embaralha os 64 territórios e reparte no rodízio.
    // As sobras (quando 64 não divide certinho, com 5 ou 6 jogadores)
    // caem naturalmente nos PRIMEIROS a receber. Cada território entra com 1.
    const baralho = embaralhar(Object.keys(TERRITORIOS), estado);
    baralho.forEach(function (t, i) {
      estado.territorios[t] = { dono: i % n, exercitos: BASE_POR_TERRITORIO };
    });
  }
  // Equipes: assento i fica na equipe i % nEquipes (A, B, A, B… ou A, B, C, A, B, C).
  if (modo === "equipes") estado.jogadores.forEach(function (j) { j.equipe = j.id % nEquipes; });

  // Baralho: uma carta por território + os coringas, embaralhado.
  const cartas = Object.keys(TERRITORIOS).map(function (t) { return { t: t, s: simboloDoTerritorio(t) }; });
  for (let c = 0; c < CORINGAS; c++) cartas.push({ t: null, s: "coringa" });
  estado.baralho = embaralhar(cartas, estado);

  // Clássico: cada jogador recebe um objetivo secreto diferente.
  // Rixa de Sangue só entra no sorteio se a cor-alvo estiver na partida
  // (pedido de Kauã). Contra a própria cor pode sair, como no WAR: vira reserva.
  if (modo === "classico") {
    const cores = estado.jogadores.map(function (j) { return j.cor; });
    const objs = embaralhar(OBJETIVOS.filter(function (o) { return o.tipo !== "destruir" || cores.indexOf(CORES[o.alvo]) !== -1; }), estado);
    estado.jogadores.forEach(function (j, i) { j.objetivo = objs[i]; });
  }

  // Primeiro turno já montado: o jogador 0 recebe seu lote de reforços
  // (base = territórios ÷ 3, mínimo 3; + bônus por região completa) para posicionar.
  montarReforco(estado, 0);
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
//   mar = Grande Exército: +3 dos Vikings, só em território viking no litoral
//           (sem litoral, sem os 3). Vem depois das regiões, antes do geral.
//   total = base + soma dos bônus + mar (é o que vai em estado.reforcosPendentes).
// Obs.: como x/3 nunca dá ,50 exato (só ,33 ou ,67), o Math.round não
// tem ambiguidade — ,33 desce e ,67 sobe.
// No Grande Exército a base é territórios ÷ 2, arredondado para BAIXO (mínimo 3).
function calcularReforcos(estado, idJogador) {
  const meus = territoriosDe(estado, idJogador);
  const nTerritorios = meus.length;
  const base = estado.modo === "grande"
    ? Math.max(MIN_REFORCO, Math.floor(nTerritorios / 2))
    : Math.max(MIN_REFORCO, Math.round(nTerritorios / 3));
  const mar = (ehViking(estado, idJogador) && meus.some(function (t) { return TERRITORIOS[t].litoral; })) ? REFORCO_MAR : 0;

  const dominadas = regioesComBonus(estado, idJogador);
  const porRegiao = {};
  let somaBonus = 0;
  ORDEM_REGIOES_REFORCO.forEach(function (r) {
    if (dominadas.indexOf(r) !== -1) {
      const b = bonusDaRegiao(r);
      if (b > 0) { porRegiao[r] = b; somaBonus += b; }
    }
  });

  const ordem = ORDEM_REGIOES_REFORCO.filter(function (r) { return porRegiao[r] > 0; });
  return { base: base, porRegiao: porRegiao, ordem: ordem, mar: mar, total: base + somaBonus + mar };
}

// Monta o reforço do turno do jogador (estado.reforco + reforcosPendentes).
function montarReforco(estado, idJogador) {
  const det = calcularReforcos(estado, idJogador);
  estado.reforco = { base: det.base, porRegiao: det.porRegiao, ordem: det.ordem, mar: det.mar };
  estado.reforcosPendentes = det.total;
}

// Posiciona "qtd" reforços num território do jogador da vez.
// Restrição (Modo B): o bônus de uma região SÓ pode entrar em território
// daquela região; o do mar (Vikings) só no litoral; o reforço-base (geral)
// entra em qualquer território seu. Ao posicionar, consome primeiro o bolsão
// da região do território (o menos flexível), depois o do mar e só então o
// geral. A ORDEM guiada é responsabilidade da tela; aqui vale a restrição.
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
  const doMar = TERRITORIOS[territorio].litoral ? (rf.mar || 0) : 0;
  const disponivel = daRegiao + doMar + rf.base;
  if (qtd > disponivel) {
    if (daRegiao === 0 && doMar === 0)
      return { ok: false, erro: rf.mar && !TERRITORIOS[territorio].litoral
        ? "O reforço do mar só entra em território no litoral."
        : "Você só tem " + rf.base + " de reforço geral para posicionar." };
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
  const usarMar = Math.min(doMar, restante);
  if (usarMar > 0) { rf.mar -= usarMar; restante -= usarMar; }
  if (restante > 0) { rf.base -= restante; restante = 0; }

  alvo.exercitos += qtd;
  estado.reforcosPendentes -= qtd;
  estado.ultimoEvento = { tipo: "reforco", territorio: territorio, qtd: qtd, restante: estado.reforcosPendentes };
  checarNaHora(estado);
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
  checarNaHora(estado);
  return { ok: true, valor: valor, bonusEm: bonusEm, proxima: valorDaTroca(estado.trocasFeitas) };
}

// Tira uma carta do baralho para o jogador (reembaralha o descarte se acabar).
function comprarCarta(estado, idJogador) {
  if (!estado.baralho.length) { estado.baralho = embaralhar(estado.descarte, estado); estado.descarte = []; }
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
  if (saoAliados(estado, estado.vez, d.dono))
    return { ok: false, erro: "Não dá para atacar seu parceiro de equipe." };
  if (vizinhosDe(origem).indexOf(destino) === -1)
    return { ok: false, erro: origem + " e " + destino + " não são vizinhos." };
  if (a.exercitos < 2)
    return { ok: false, erro: "Precisa de ao menos 2 exércitos para atacar." };

  const nAtq = dadosDeAtaque(a.exercitos);
  const nDef = dadosDeDefesa(d.exercitos);
  const dadosAtaque = rolarDados(nAtq, estado);   // todos os dados rolados (até 4)
  const dadosDefesa = rolarDados(nDef, estado);

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

  // Grande Exército: cada exército viking derrotado vale 1 ponto para o reino
  // que o derrotou (no ataque ou na defesa).
  let pontosGanhos = 0;
  if (estado.modo === "grande") {
    // Reino atacado por outro reino guarda quem o atacou: o bot dele passa a
    // revidar contra esse jogador (pedido de Kauã: não ataca por conta própria,
    // mas não morre sem reagir).
    const vitimaReino = estado.jogadores[d.dono];
    if (!ehViking(estado, estado.vez) && !ehViking(estado, d.dono) && vitimaReino.revide &&
        vitimaReino.revide.indexOf(estado.vez) === -1) {
      vitimaReino.revide.push(estado.vez);
      anotar(estado, vitimaReino.nome + " foi atacado por " + estado.jogadores[estado.vez].nome + " e vai revidar.");
    }
    if (ehViking(estado, d.dono) && !ehViking(estado, estado.vez)) {
      pontosGanhos = perdasDefensor;
      estado.jogadores[estado.vez].pontos += perdasDefensor;
    }
    else if (ehViking(estado, estado.vez) && !ehViking(estado, d.dono)) estado.jogadores[d.dono].pontos += perdasAtacante;
  }

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
    // Tutorial: o jogador caiu -> fim (quem o eliminou vence).
    if (estado.modo === "tutorial" && vitima.tipo === "humano" && !vitima.vivo) {
      declararVitoria(estado, estado.vez, { motivo: "derrota" });
    // Grande Exército: os Vikings caíram -> fim, vence o reino com mais pontos.
    } else if (ehViking(estado, donoAntigo) && !vitima.vivo) {
      estado.ultimoGolpe = estado.vez;
      finalizarGrande(estado);
    } else {
      // Se sobrou um lado só (um jogador, ou uma equipe), a partida acaba na hora.
      const lado = ladoQueSobrou(estado);
      if (lado !== null) declararVitoria(estado, lado, { motivo: "ultimo" });
      else checarNaHora(estado);
    }
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
    pontos: pontosGanhos,        // Grande Exército: pontos que o atacante ganhou nesta rolagem
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
  checarNaHora(estado);
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
  checarNaHora(estado);
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

  // Vitória do jogador da vez? (pela condição do modo: regiões, objetivo, meta viking)
  if (verificarVitoria(estado, estado.vez)) {
    const motivo = estado.modo === "tutorial" ? motivoTutorial(estado, estado.vez)
      : { classico: "objetivo", grande: "vikings", equipes: "equipeRegioes" }[estado.modo] || "regioes";
    declararVitoria(estado, estado.vez, { motivo: motivo });
    return { ok: true, vencedor: estado.vez, carta: carta };
  }
  // Sobrou um lado só? (vitória por "último de pé")
  const lado = ladoQueSobrou(estado);
  if (lado !== null) {
    declararVitoria(estado, lado, { motivo: "ultimo" });
    return { ok: true, vencedor: lado, carta: carta };
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

  // Partida Rápida: acabou a última rodada -> conta os pontos.
  if (estado.modo === "rapida" && estado.turno > RODADAS_RAPIDA) {
    estado.turno = RODADAS_RAPIDA;
    finalizarRapida(estado);
    return { ok: true, vencedor: estado.vencedor, carta: carta };
  }

  estado.vez = proximo;
  estado.fase = "reforco";
  estado.movidos = {};                 // zera o controle de remanejamento
  montarReforco(estado, proximo);
  estado.ultimoEvento = { tipo: "novaVez", jogador: proximo, reforcos: estado.reforcosPendentes };
  return { ok: true, vez: proximo, reforcos: estado.reforcosPendentes, carta: carta };
}


/* ----------------------------------------------------------------
   JOGADAS COMO DADO — usado pelo online
   ----------------------------------------------------------------
   A partida online é guardada como a semente + a LISTA de jogadas. Cada
   aparelho refaz a partida aplicando a lista aqui, na mesma ordem; como a
   sorte vem da semente, todos chegam ao mesmo estado. Jogada que não vale
   (fora da vez, proibida) é recusada igualzinho em todos e não muda nada.
     { t: "ref",    a, x }        posiciona 1 reforço em x
     { t: "fimRef", a }           fecha o reforço (abre o ataque)
     { t: "troca",  a, c: [i,j,k] } troca 3 cartas
     { t: "atq",    a, o, d }     1 ataque de o em d (com escolha na conquista)
     { t: "conq",   a, n }        quantos ficam no conquistado
     { t: "fimAtq", a }           fecha o ataque
     { t: "rem",    a, o, d, n }  remaneja n de o para d
     { t: "passar", a }           passa a vez
     { t: "bot",    a }           o bot joga o resto do turno de a
   "a" é o jogador que fez a jogada: precisa ser o da vez.
   ---------------------------------------------------------------- */
function aplicarAcao(estado, acao) {
  if (!acao || typeof acao !== "object") return { ok: false, erro: "Jogada inválida." };
  if (estado.vencedor !== null) return { ok: false, erro: "A partida já terminou." };
  if (acao.a !== estado.vez) return { ok: false, erro: "Não é a vez desse jogador." };
  if (acao.n !== undefined && !Number.isInteger(acao.n)) return { ok: false, erro: "Quantidade inválida." };
  switch (acao.t) {
    case "ref": return posicionarReforco(estado, acao.x, 1);
    case "fimRef": return terminarReforco(estado);
    case "troca":
      if (!Array.isArray(acao.c) || !acao.c.every(Number.isInteger)) return { ok: false, erro: "Escolha 3 cartas da sua mão." };
      return trocarCartas(estado, acao.c.slice());
    case "atq": return atacar(estado, acao.o, acao.d, { escolher: true });
    case "conq": return moverNaConquista(estado, acao.n);
    case "fimAtq": return terminarAtaque(estado);
    case "rem": return remanejar(estado, acao.o, acao.d, acao.n);
    case "passar": return passarVez(estado);
    case "bot":
      if (typeof jogarTurnoBot !== "function") return { ok: false, erro: "Bots não carregados." };
      return jogarTurnoBot(estado);
  }
  return { ok: false, erro: "Jogada desconhecida." };
}
