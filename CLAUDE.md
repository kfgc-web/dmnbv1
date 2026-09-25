# Domination: Britannia — Resumo-mestre do projeto

*Este arquivo substitui o antigo documento de retomada anexado nos chats. O Claude Code o lê sozinho ao abrir o repositório; manter atualizado a cada entrega.*

Última atualização: 25/09/2026 (online testado por Kauã; README, LICENSE, DESIGN.md e aviso de ©).

---

## 1. O projeto

Jogo de estratégia de conquista no navegador, estilo **War/Risk**, ambientado na **Britânia e Irlanda por volta de 866 d.C.** (era de *The Last Kingdom*: anglo-saxões, celtas e vikings).

- **No ar:** https://kfgc-web.github.io/dmnbv1/ (GitHub Pages, publica o que está no `main`).
- **Repositório:** público, `kfgc-web/dmnbv1`.
- **Nome oficial:** **Domination: Britannia** (com "nn"). Aparece só onde o jogador vê: `<title>`, `<h1>` e modal de início. Comentários internos podem manter "WAR BRITÂNICO". Não usar "Dominations" (colisão com a marca *DomiNations*; decisão tomada, não reabrir).
- Tudo em **PT-BR informal**, inclusive mensagens de erro do motor.

## 2. Como trabalhamos

- **Kauã é o diretor criativo; Claude faz toda a engenharia.** Kauã não é técnico: explicações sempre acessíveis, sem jargão.
- **Protocolo:** esclarecer → confirmar → **"pode ir"** → agir. Nada de mudar arquivos do jogo antes do OK explícito. Protótipos e maquetes para Kauã avaliar (fora do repositório) podem ser feitos antes.
- **Publicação:** Claude grava num ramo `claude/...`, abre/usa o Pull Request e **junta ao `main` por conta própria** (autorizado por Kauã), depois avisa. O site atualiza sozinho em 1–2 minutos.
- **A cada entrega, aumentar o número de versão** `?v=N` nos `<script>`/`<link>` do `index.html` **e `VERSAO` em `sw.js` para o mesmo N** (é o que faz o app instalado mostrar "Nova versão disponível"; o teste da tela confere que os dois batem). Arquivo novo do jogo → acrescentar na lista `ARQUIVOS` do `sw.js`.
- **Depois de mexer em `motor.js`, `bots.js` ou nas vizinhanças de `mapa.js`: rodar o stress dos bots** — `node ferramentas/stress.js` (3.000 partidas por modo, 2 a 6 jogadores — 9 no Grande Exército, 4/6 no Equipes; confere 66 cartas a cada turno, a vitória certa de cada modo e, a cada 10 partidas, uma "gêmea" com a mesma semente jogada pela lista de jogadas que tem de terminar idêntica). Precisa terminar em "tudo certo, zero falhas". **Toda sorte do motor tem de sair de `sorte(estado)`** (nunca `Math.random` nas regras nem nos bots), senão o online dessincroniza.
- Ao fim de cada entrega, registrar no DESIGN.md as decisões que o Kauã deu na sessão (transcritas, com data e nº do PR). O DESIGN.md não precisa ser lido no início das sessões.
- Mensagens de commit e PR dizem a decisão por trás da mudança, não só o que mudou.
- **Depois de mexer no mapa:** rodar o gerador (§6) e confirmar "fronteiras que FALTAM/SOBRAM: nenhuma" e "divisas CURTAS: nenhuma".
- **Testar a tela antes de entregar:** `node ferramentas/teste-tela.js` (Playwright + Chromium; `--prints` salva prints em `ferramentas/prints/`). Abre o jogo num servidor local, joga e confere início com modos, objetivo no painel, reforço, conquista 1/2/3, dados visíveis, troca obrigatória, zoom, painel recolhido, vitória do Clássico, turnos com bots, Grande Exército (lado, começo, reforço do mar, placar), Equipes (marquinha, parceiro protegido), Partida Rápida (rodada, placar), celular em pé (aviso de girar), celular deitado (mapa à esquerda, painel à direita, rolagem única), tablet em pé e o app (versão do sw.js, manifesto, funciona sem internet, aviso de versão nova e atualização). Precisa terminar em "tudo certo". Ao criar algo novo na tela, acrescentar a checagem nesse script.
- **Depois de mexer no online** (`rede.js`, `online.js`, regras do banco, ou nas jogadas do motor): `node ferramentas/teste-online.js` (`--prints` para prints). Sobe o emulador oficial do Firebase com `ferramentas/regras-firebase.json` e joga com vários "aparelhos": sala, convite, cor, modo, regras recusando estranho/trapaça, partida igual em todos a cada jogada, bots, jogador parado (botão), jogadas ao mesmo tempo, quem cai e volta, sair e voltar, Equipes montadas na sala, Grande Exército com reino escolhido. Precisa terminar em "tudo certo". Instalação (uma vez): `npm i --no-save --prefix ferramentas firebase@12.11.0 firebase-tools@15` (precisa de Java). No ambiente do Claude, rodar os testes com `NODE_PATH=$(npm root -g)` (o Playwright é global). O emulador é iniciado sem regras e as regras são publicadas por HTTP (o proxy do ambiente bloqueia o firebase-tools de fazer isso).

## 3. Regras do jogo

- **64 territórios em 8 regiões** (nomes de época, §5).
- **Bônus por região inteira:** Ériu 7 · Mierce 6 · Westseaxe 5 · Northhymbre 5 · Alba 5 · Dál Riata 4 · East Engle 3 · Cymru 3.
- **Combate:** dados **d8**; ataque rola até 4 dados (precisa deixar 1), defesa até 3; comparam-se os 3 maiores do ataque com os da defesa, maior × maior; **empate é da defesa**.
- **Conquista:** entram **no máximo 3 exércitos** (sempre fica 1 na origem). O jogador escolhe **1, 2 ou 3** numa janela logo após a conquista (limite decidido por Kauã: mover tudo gerava conquistas em cadeia). Bots levam automaticamente o nº de dados que rolaram, também limitado a 3. (Motor: `MAX_MOVER_CONQUISTA`, `atacar(..., { escolher: true })` + `moverNaConquista(estado, total)`.)
- **Reforço-base** = `max(3, round(territórios / 3))` + bônus regionais + trocas de cartas.
- **Turno:** reforço → ataque → remanejamento.
- **Vitória:** depende do **modo** (abaixo). Em todos, sobrar um único jogador vivo (no Equipes, uma única equipe) também é vitória.
- **Jogadores:** 2 a 6 (recomendado 4–6), humanos ou bots; Grande Exército sempre 9. Distribuição inicial: rodízio embaralhado, 1 exército por território (Grande Exército: começo fixo, abaixo). Sozinho: **um humano** ("Você") e o resto bots. Online: várias pessoas (cada uma no seu aparelho), o resto bots (§3, "Online").

### Modos de jogo (escolhidos na tela de início; padrão: Clássico)
- **Clássico:** cada jogador recebe um **objetivo secreto** diferente; vence quem cumprir o seu **na hora, durante o próprio turno** (checado após reforço, troca, ataque, conquista e remanejamento). O objetivo aparece no painel (botão Esconder/Mostrar) e todos são revelados na vitória.
- **Domínio:** vence quem tiver **5 das 8 regiões inteiras** (checado ao fim do turno).
- **Conquista Total:** só vence o **último de pé**.
- **Partida Rápida:** acaba após **15 rodadas** (15 turnos por jogador). Pontos: 1 por território; território de região inteira vale 3. Desempate: mais exércitos; se ainda empatar, 1 d6 para cada. Último de pé também vence. A fase mostra "Rodada X de 15" e o painel, os pontos.
- **Grande Exército:**
  - **9 assentos fixos** (humano ou bot): Vikings + os 8 reinos (cada reino = uma região). Cores por lado em `COR_REINO` (3 novas: preto, branco, rosa). Na tela de início o jogador escolhe **seu lado** (os outros 8 são bots, enquanto não houver online).
  - **Ordem fixa:** Vikings → East Engle → Northhymbre → Mierce → Westseaxe → Cymru → Dál Riata → Alba → Ériu.
  - **Início:** Vikings em Eoforwic, Streoneshalh, Mameceaster, Northfolc, Suthfolc com **7** em cada. East Engle: o que sobra (Grantebrycge, Medeshamstede) com **3** em cada. Northhymbre: os outros 6 com **2** em cada. Demais reinos: a região inteira com **1** em cada.
  - **Reforço (todo turno):** reinos = `max(3, floor(territórios / 2))` + bônus de regiões. Vikings = o mesmo + **3 do mar** (`reforco.mar`), que só vão para território viking no litoral (sem litoral, sem os 3); na sequência guiada vêm depois das regiões e antes do geral. Cartas funcionam normal para todos.
  - **Vitória viking:** Northhymbre + Mierce + East Engle + Westseaxe inteiras (na hora).
  - **Vitória dos reinos:** vikings eliminados → vence o reino **vivo** com mais **pontos** (1 ponto por exército viking derrotado, no ataque e na defesa). Reino eliminado fica fora. Desempate: quem destruiu o último território viking → mais territórios → mais exércitos → cada empatado rola 1 d6, maior vence (rola de novo se empatar).
  - Reinos podem se atacar; **reinos-bots só atacam os Vikings** (`botAlvos` em `bots.js`, pedido de não forçar a traição). Sem limite de tempo. Lista de jogadores mostra os pontos; os dados mostram "+N pontos"; o fim mostra o placar e o desempate.
  - Stress (só bots): os reinos vencem ~95% (Vikings ~5%). Com humanos brigando entre si, a chance viking sobe.
- **Equipes:**
  - Formatos: 4 jogadores = 2×2; 6 = 3×3 ou 2×2×2. Com outro nº de jogadores o modo não aparece.
  - Equipes **sorteadas** pelo jogo (o motor embaralha os assentos; assento i = equipe i % nº de equipes); vezes **alternadas** entre equipes, sequência fixa na partida.
  - **Sem ataque ao parceiro** e **sem remanejar** para território do parceiro. Cartas individuais, sem troca entre parceiros.
  - **Bônus de região da equipe:** região toda nas mãos da equipe conta como fechada; o bônus vai inteiro para o parceiro com mais territórios nela (empate: mais exércitos lá; depois, quem joga antes).
  - **Vitória:** equipe com **5 das 8 regiões** fechadas (somando parceiros; checado no fim do turno, como no Domínio) ou que eliminar todos os adversários.
  - Parceiro eliminado: o resto da equipe segue; cartas do eliminado vão para quem o eliminou. Marquinha da equipe (letra A/B/C) nas peças e na lista de jogadores.
- A tela de início só mostra os modos que cabem no nº de jogadores (`modoDisponivel`).

### Online (jogar com amigos) — decidido com Kauã
- **Sala** com código de 5 letras + link de convite (`?sala=CODIGO`, entra direto). Quem **criou a sala** escolhe o modo e cada lugar (aberto para pessoa / bot / vazio; pode tirar alguém) e começa a partida; lugares abertos viram bot ao começar.
- Cada pessoa escolhe **sua cor** (as 6 cores; bots ficam com as que sobram). No **Grande Exército** o lugar é o reino ("Sentar aqui"), cor fixa do reino. Nos outros modos a **ordem da mesa é sorteada** ao começar.
- **Equipes online:** quem criou a sala **monta as equipes** (toca nas letras A/B/C) ou toca em **Sortear**; o jogo sorteia a ordem, alternando as equipes.
- **Quem caiu** (desconectado): na vez dele, depois de **10 s**, o bot joga **aquele turno**. Voltou (abrir o app de novo já volta sozinho para a partida), joga o próximo normalmente.
- **Quem está conectado mas parado:** depois de **60 s sem nenhum toque** na vez dele, quem criou a sala (se estiver fora, o "juiz") vê o botão **"Bot joga por Fulano"** — só aquele turno. Qualquer toque zera a contagem. Nada é automático sem o toque de quem criou.
- Sair no meio (Novo jogo → Sair): a partida continua com o bot; a tela de início oferece **"Voltar para a partida online"** (não volta sozinho).
- Limite aceito por Kauã: quem fuçar o navegador consegue espiar objetivos e cartas dos outros (esconder de verdade exigiria servidor pago). Dados e jogadas **não** dá para falsificar.

### Objetivos do Clássico (17, aprovados por Kauã)
1. Alto-Rei da Irlanda — Ériu + Dál Riata
2. Rota de Dyflin — Ériu + Cymru
3. Caminho do Grande Exército — Northhymbre + Mierce
4. Sonho de Alfredo — Westseaxe + Mierce
5. Senhor do Norte — Northhymbre + Alba
6. Terras de Offa — Mierce + East Engle + Cymru
7. Bretwalda do Sul — Westseaxe + East Engle + Cymru
8. Reino de Alba — Alba + Dál Riata + 1 região à escolha
9. De Eoforwic a Lundenburg — Northhymbre + Westseaxe
10. Bretwalda — 36 territórios
11. Terra Assentada — 27 territórios com 2+ exércitos em cada
12–17. Rixa de Sangue — eliminar o jogador de cor X (vermelho, azul, verde, âmbar, roxo, turquesa). Mira a **cor** (`alvoDaRixa`: quem estiver com `CORES[alvo]`), não o assento — no online cada um escolhe a cor. **Só é sorteada se a cor estiver na partida** (pedido de Kauã). Pode sair contra a própria cor (como no WAR); nesse caso, ou se outro jogador eliminar o alvo antes, vale **36 territórios** (objetivo reserva). Na vitória: em cima só "cumpriu o objetivo reserva Bretwalda (conquistar 36 territórios)"; na lista revelada, só o objetivo **original** de cada um (texto curto, pedido de Kauã). Durante a partida, o painel avisa quando a Rixa vira Bretwalda e o motivo.
- Bots perseguem o próprio objetivo (`botBonusObjetivo` em `bots.js`).

### Reforço "Modo B" (sequência guiada)
- O bônus de cada região fica **preso à própria região**.
- Ordem fixa: Ériu → Dál Riata → Alba → Northhymbre → Mierce → East Engle → Westseaxe → Cymru; o **reforço geral vem por último** (inclui os exércitos de troca de cartas).
- **Auto-avanço:** quando o total zera, ~0,3 s depois abre o ataque sozinho.

### Remanejamento
- Quantos pulos quiser na fase; cada pulo entre dois territórios seus vizinhos; sempre fica ≥1 na origem.
- **Cada exército move no máximo uma vez por turno**: quem chega trava até o próximo turno. Quem avançou numa conquista durante o ataque começa o remanejamento livre.

### Cartas e trocas
- Baralho: **64 cartas de território** (símbolo fixo por território, alternando na ordem de `mapa.js`: 22 **espadas**, 21 **escudos**, 21 **navios**) + **2 coringas** = 66 cartas.
- Ganha **1 carta no fim do turno** em que conquistou pelo menos 1 território.
- Troca: **3 iguais ou 3 diferentes**; coringa vale qualquer símbolo. Só na fase de reforço.
- Valor pela **contagem da mesa** (único para todos): **4, 6, 8, 10, 12, 15, 18, 20**, depois +5 a cada troca.
- Cada carta trocada de território próprio: **+2 exércitos nele**.
- Com **5+ cartas**, troca obrigatória antes de posicionar (a janela abre sozinha).
- Quem elimina um jogador **fica com as cartas dele**. Descarte volta ao baralho quando ele acaba.
- Bots trocam sempre que há troca válida (`acharTroca` prefere cartas de territórios próprios e poupa coringas).

## 4. Arquitetura — arquivos

Ordem de carregamento no `index.html`: **mapa.js → motor.js → bots.js → desenho.js → cartas.js → rede.js → online.js → telas.js → app.js** (+ `estilo.css`), todos com `?v=N`.

| Arquivo | Papel |
|---|---|
| `index.html` | Casca: título, `<h1>`, painel, `<div id="overlay">` (modais injetados por JS), scripts na ordem acima |
| `estilo.css` | Visual (tema "mesa de guerra à noite") |
| `mapa.js` | **Só dados:** territórios (região, litoral, vizinhos), regiões (bônus), rotas marítimas |
| `motor.js` | Regras **puras** (sem tela, sem rede) |
| `bots.js` | IA heurística; `jogarTurnoBot(estado)` joga o turno inteiro (resiliente a herdar o turno em qualquer fase) |
| `desenho.js` | **Gerado** pelo gerador (§6) — não editar à mão. Litoral, contorno de cada território, divisas, lagos, rotas, posição das peças e dos nomes de região |
| `cartas.js` | Só o **visual** das cartas (SVG): pergaminho, borda trançada celta, faixa com nome, silhueta do território, medalhão do símbolo |
| `telas.js` | Toda a interface: tabuleiro, painel, janelas (início, troca de cartas, conquista, vitória), dados, zoom |
| `rede.js` | Conversa com a nuvem (Firebase Realtime Database, projeto `domination-britannia`, plano Spark): carrega o Firebase **só quando alguém escolhe jogar online**, login anônimo, salas, lugares, presença (conectado/desconectado), lista de jogadas. Formato do banco no topo do arquivo |
| `online.js` | Tela de entrada/sala e a partida online: refaz a partida pela lista de jogadas, fila de envio das minhas jogadas, juiz dos bots, 10 s de quem caiu, botão do parado (60 s) |
| `app.js` | O jogo como app: registra o `sw.js`, aviso "Nova versão disponível" (só recarrega quando o jogador toca), botão "Instalar" (quando o navegador oferece), trava deitado no app instalado |
| `sw.js` | Service worker: guarda os arquivos (`ARQUIVOS`, com `VERSAO`) para abrir sem internet; versão nova espera o toque no aviso; guarda também as fontes do Google |
| `manifest.webmanifest` | Dados do app: nome "Domination: Britannia" (curto "Domination"), tela cheia, **deitado**, ícones |
| `icones/` | `icone-fonte.webp` (arte do escudo, feita por IA a pedido de Kauã) e os PNG gerados por `ferramentas/gerar-icones.js` (192/512, maskable com margem para o círculo do Android, apple-touch, favicon) |
| `README.md`, `LICENSE`, `DESIGN.md` | Apresentação (PT + EN, prints em `imagens/`); licença proprietária (© Kauã Felipe Gielow Camargo, todos os direitos reservados); registro de design e das decisões de Kauã, com data e fonte |
| `historico/` | Os dois documentos de 12.7.2026 (época do chat comum), gravados **sem alteração** — nunca editar |
| `ferramentas/` | Não é carregado pelo jogo: gerador do mapa (`gerar-mapa.js`, `gerar-desenho.js`), `gerar-icones.js`, `stress.js` (stress dos bots), `teste-tela.js` (teste no navegador), `teste-online.js` (vários aparelhos contra o emulador do Firebase) e `regras-firebase.json` (regras de segurança do banco — é o que se cola no console do Firebase) |

### motor.js — API
Toda ação devolve `{ ok: true, ... }` ou `{ ok: false, erro: "mensagem PT-BR" }`.

**Ações:** `criarPartida(jogadores, { modo, tamanhoEquipe, semente, equipesProntas })` · `calcularReforcos` → `{ base, porRegiao, ordem, mar, total }` · `posicionarReforco(estado, t, qtd)` · `terminarReforco` · `trocarCartas(estado, [i, j, k])` · `atacar(estado, origem, destino, opcoes)` · `moverNaConquista(estado, total)` · `terminarAtaque` · `remanejar(estado, origem, destino, qtd)` · `passarVez` (devolve `carta` quando o jogador ganhou uma) · `aplicarAcao(estado, acao)` — uma jogada descrita como dado (`{ t: "ref"|"fimRef"|"troca"|"atq"|"conq"|"fimAtq"|"rem"|"passar"|"bot", a, ... }`); é assim que a tela joga e o online guarda a partida.

**Consultas:** `territoriosDe`, `contarExercitos`, `regioesDominadas`, `inimigosVizinhos`, `ehFronteira`, `frescosEm`, `jogadoresVivos`, `verificarVitoria`, `resumoJogadores`, `acharTroca`, `trocaValida`, `valorDaTroca`, `simboloDoTerritorio`, `trocaObrigatoria`, `objetivoCumprido`, `objetivoEfetivo`, `descreverObjetivo`, `descreverMeta`, `modoDisponivel`, `saoAliados`, `membrosDaEquipe`, `regioesDaEquipe`, `pontosRapida`, `ehViking`. Dados dos modos/objetivos: `MODOS`, `OBJETIVOS`, `OBJETIVO_RESERVA`, `RODADAS_RAPIDA`, `REINOS_GRANDE`, `COR_REINO`, `META_VIKINGS`, `NOMES_EQUIPE`. Fins de partida: `finalizarRapida`, `finalizarGrande` (desempate em `desempatar`).

**Estado** (dado simples, pronto para salvar/enviar): `modo`, `semente` + `rng` (sorte combinada: mesma semente + mesmas jogadas = mesma partida em qualquer aparelho), `territorios`, `jogadores` (cada um com `cartas`, `objetivo` no Clássico, `reino` e `pontos` no Grande Exército, `equipe` no Equipes, e `eliminadoPor`), `vez`, `turno` (rodada), `fase`, `reforcosPendentes`, `reforco`, `movidos`, `baralho`, `descarte`, `trocasFeitas`, `conquistouNoTurno`, `conquista`, `vencedor`, `resultado` (como acabou: `motivo` = objetivo/regioes/ultimo/rapida/vikings/reinos/equipeRegioes, + placar e desempate), `ultimoGolpe`, `ultimoEvento`, `log`. A ordem dos assentos é a ordem de jogada.

### Tela — pontos-chave
- Mapa estilo WAR: cada território é uma área pintada com a **cor da sua região**; divisa fina entre territórios, grossa entre regiões; peças (discos) com a **cor do dono** e o nº de exércitos. Tocar no território ou na peça.
- Nomes de território que colidem mudam de lugar sozinhos (`afastarNomes`).
- **Dados** aparecem em cima da batalha e somem em 1,5 s.
- Rodapé da janela de início: "© 2026 Kauã Felipe Gielow Camargo · Todos os direitos reservados" (o teste da tela confere).
- **Zoom** pelos botões + / − (mantém o centro).
- **Botão "Painel"** no cabeçalho recolhe o painel (fica só a vez, a fase e os botões) — pensado para o celular; a escolha fica guardada no navegador.
- **Celular: só deitado** (decisão de Kauã). Em pé (largura ≤ 600) aparece o aviso **"Gire o celular"** cobrindo tudo. Deitado (altura ≤ 540): cabeçalho baixo, mapa à esquerda (no zoom 1 a ilha inteira cabe na altura), painel de 270 px à direita rolando como **uma página só**; janelas roláveis; respeita o entalhe (`safe-area`).
- **Tablet em pé** (até 860 de largura): painel embaixo ocupando metade da tela, rolando como uma página só.
- Painel mostra o **modo** e a meta do jogador: objetivo (Clássico), lado (Grande Exército), equipe e regiões da equipe (Equipes), pontos (Partida Rápida).
- `HUMANO` (assento do jogador) é definido em `novoJogo`: no Grande Exército e no Equipes não é o assento 0. No online, é o assento deste aparelho (`abrirPartidaOnline`).
- Toda jogada do jogador passa por `jogar(acao)` (aplica com `aplicarAcao` e, no online, manda para a nuvem). Jogada de outro aparelho chega por `receber(acao)` (mostra dados, pisca). Sozinho, os bots rodam em `rodarBots`; no online, **não** (o juiz grava `{ t: "bot" }` e todos calculam igual).

### Online — como funciona por dentro
- A nuvem guarda `partida/config` (semente, modo, jogadores na ordem de jogada com `uid` e `lugar`) + `acoes/0000000…` (lista de jogadas, só se acrescenta; cada número só pode ser gravado uma vez). Cada aparelho refaz a partida com o motor. Ninguém rola dado no próprio aparelho: a sorte vem da semente.
- Minha jogada vale na hora aqui e entra numa fila de envio (numerada). Se outro gravou aquele número antes (ex.: o bot assumiu), o aparelho refaz a partida pela lista. Cada jogada leva um resumo (`h`) do estado; se não bater, aparece aviso de "fora de sincronia".
- **Juiz** = a pessoa conectada de menor número na mesa: grava os turnos dos bots (pausa de 0,75 s) e o bot de quem caiu (10 s). As regras do banco só deixam gravar jogada em nome do próprio assento (bot: qualquer membro da sala).
- Sem servidor: a faxina das salas com mais de 3 dias é feita por quem cria sala nova.
- Bots jogam com pausa (~780 ms); territórios que trocam de dono piscam.
- Cores dos assentos: `#c0392b`, `#2c6fbb`, `#27ae60`, `#e0a200`, `#8e44ad`, `#16a085` (+ `#1e1e1e`, `#ecf0f1`, `#e84393` no Grande Exército). Acento pergaminho/osso `#cbb892`; títulos em **Cinzel**.

## 5. O mapa

### Nomes (época ~866; forma normalizada: sem þ/ð e sem mácrons no inglês antigo; célticos e nórdico com acentos)
- **Regiões:** Westseaxe (Wessex) · East Engle (Ânglia Oriental) · Mierce (Mércia) · Cymru (Gales) · Northhymbre (Northumbria) · Dál Riata · Alba (Escócia) · Ériu (Irlanda).
- Territórios: ver `mapa.js`. Decisões que valem lembrar: **Eoforwic** (York — fica no antigo "East York"), **Streoneshalh** (Whitby), **Bebbanburg**, **Lundenburg**, **Dyflin** (Dublin nórdica), **Mön** (Ilha de Man), **Dún Att** (Dunadd, em vez de Kilchomann/Islay — o território é terra firme em Argyll), **Rippel** (Ribble, no lugar de Blackpool), **Hagustaldesham** (Hexham, no lugar de Alston), **Apor Crosán** (Applecross, no lugar de Gairloch), **Gleann Comhann** mantido.
- Regra: **não inventar nomes** — só formas atestadas; se não houver, decidir com Kauã.

### Ligações
- **5 rotas marítimas** (tracejadas no mapa): Gwynedd↔Dyflin · Beannchar↔Hwiterne · Beannchar↔Mön · Apor Crosán↔Ljóðhús · Apor Crosán↔Kirkjuvágr.
- **3 becos sem saída intencionais:** Mön, Ljóðhús, Kirkjuvágr.
- **Ligações acrescentadas por Kauã após playtest:** Loncaster–Rippel, Legaceaster–Powys, Grantebrycge–Lundenburg, Lundenburg–Wintanceaster, Sumorsaete–Gwent, Ard Sratha–Mainistir Bhuithe, Gleawanceaster–Hamtun.
- **Beannchar × Cruachan não são vizinhos** (confirmado por Kauã).
- Ilhas: Ljóðhús = só Hébridas Exteriores; **Skye → Apor Crosán; Rùm e Eigg → Gleann Comhann**; Anglesey faz parte de Gwynedd.
- **Lough Neagh** aberto no Ulster (decorativo).

## 6. Gerador do mapa (`ferramentas/`)

```
npm i world-atlas@2 topojson-client
node ferramentas/gerar-mapa.js            # grava desenho.js
node ferramentas/gerar-mapa.js --previa   # + ferramentas/previa-mapa.png
```

- Litoral real: Natural Earth 1:10m (domínio público), projeção equiretangular com correção de latitude, tela 1200 × 1300.
- Cada território cresce a partir de **ÂNCORAS** (pontos reais, em `gerar-mapa.js`) sem encostar em quem não é vizinho no jogo; folga mínima de 3 px entre não-vizinhos (nem na ponta).
- O gerador confere e imprime: fronteiras que **FALTAM**, que **SOBRAM** e divisas **CURTAS** (< 10 px). Só grava `desenho.js` se não faltar nem sobrar nada. Para mudar a forma de um território, ajustar as âncoras.
- `gerar-desenho.js` converte os pixels em contornos suaves (cada trecho de divisa é simplificado uma vez e compartilhado pelos dois lados) e posiciona peças, rotas e nomes de região (`ROTULOS_REGIAO`).

## 7. Histórico

1. Design do mapa lógico (64 territórios, adjacências simétricas).
2. `motor.js` e `bots.js` validados por stress; separação em arquivos; publicação no GitHub Pages.
3. Refinamento: nome final, reforço Modo B, remanejamento múltiplo com trava.
4. **Nomes de época** aplicados; **mapa desenhado estilo WAR** a partir do litoral real.
5. **Cartas e trocas**; dados em cima da batalha; zoom consertado; número de versão; Eoforwic; fronteiras corrigidas.
6. **7 ligações novas** (playtest); ilhas do noroeste para a terra firme.
7. **Escolha de quantos exércitos entram na conquista** — depois limitada a 1, 2 ou 3.
8. **Modos Clássico (17 objetivos), Domínio e Conquista Total**; botão de recolher o painel; cabeçalho ajustado ao celular.
9. Playtest no celular aprovado; Rixa de Sangue só sorteada contra cores presentes.
10. **Modos Partida Rápida, Grande Exército e Equipes**; stress e teste da tela cobrindo os 6 modos. Playtest de Kauã aprovado; dados mantidos (4 d8 × 3 d8 — simulação mostrou equilíbrio); 3×3 fica como está (aparece com 5 adversários).
11. **App no celular (PWA)**: instalável, abre sem internet, avisa versão nova; ícone do escudo; jogo só deitado no celular.
12. **Online com amigos** (Firebase `domination-britannia`): sala com código e convite, cor escolhida, equipes montadas na sala, reino escolhido no Grande Exército, partida guardada como lista de jogadas com sorte combinada (motor com `sorte(estado)`), bots pelo juiz, quem cai vira bot em 10 s, botão do parado (60 s), volta sozinho ao reabrir o app.
13. **Autoria:** README (PT + EN, com prints), LICENSE proprietário, aviso de © no início, DESIGN.md com o registro das decisões de Kauã e `historico/` com os documentos de julho. Online testado por Kauã ("aparentemente funciona").

## 8. Próximos passos (ordem combinada)

1. ~~Playtest do app no celular~~ — aprovado por Kauã ("ficou perfeito").
2. **Online** — entregue (histórico 12) e testado por Kauã. Ideias para depois: revanche na mesma sala, bate-papo, cronômetro de turno (Kauã preferiu o botão do parado).
3. Ideia anotada: **salvar a partida sozinho** no aparelho (hoje fechar o app ou atualizar a versão recomeça a partida contra bots; a online já sobrevive).
