# Domination: Britannia — Resumo-mestre do projeto

*Este arquivo substitui o antigo documento de retomada anexado nos chats. O Claude Code o lê sozinho ao abrir o repositório; manter atualizado a cada entrega.*

Última atualização: 25/09/2026.

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
- **A cada entrega, aumentar o número de versão** `?v=N` nos `<script>`/`<link>` do `index.html` (evita o navegador usar arquivo velho guardado).
- **Depois de mexer em `motor.js`, `bots.js` ou nas vizinhanças de `mapa.js`: rodar o stress dos bots** (3.000 partidas, 2 a 6 jogadores, zero falhas; conferir o total de 66 cartas a cada turno).
- **Depois de mexer no mapa:** rodar o gerador (§6) e confirmar "fronteiras que FALTAM/SOBRAM: nenhuma" e "divisas CURTAS: nenhuma".
- Testar a tela num navegador (Chromium/Playwright) antes de entregar: sem erros no console.

## 3. Regras do jogo

- **64 territórios em 8 regiões** (nomes de época, §5).
- **Bônus por região inteira:** Ériu 7 · Mierce 6 · Westseaxe 5 · Northhymbre 5 · Alba 5 · Dál Riata 4 · East Engle 3 · Cymru 3.
- **Combate:** dados **d8**; ataque rola até 4 dados (precisa deixar 1), defesa até 3; comparam-se os 3 maiores do ataque com os da defesa, maior × maior; **empate é da defesa**.
- **Conquista:** entram **no máximo 3 exércitos** (sempre fica 1 na origem). O jogador escolhe **1, 2 ou 3** numa janela logo após a conquista (limite decidido por Kauã: mover tudo gerava conquistas em cadeia). Bots levam automaticamente o nº de dados que rolaram, também limitado a 3. (Motor: `MAX_MOVER_CONQUISTA`, `atacar(..., { escolher: true })` + `moverNaConquista(estado, total)`.)
- **Reforço-base** = `max(3, round(territórios / 3))` + bônus regionais + trocas de cartas.
- **Turno:** reforço → ataque → remanejamento.
- **Vitória:** depende do **modo** (abaixo). Em todos, sobrar um único jogador vivo também é vitória.
- **Jogadores:** 2 a 6 (recomendado 4–6), humanos ou bots. Distribuição inicial: rodízio embaralhado, 1 exército por território.

### Modos de jogo (escolhidos na tela de início; padrão: Clássico)
- **Clássico:** cada jogador recebe um **objetivo secreto** diferente; vence quem cumprir o seu **na hora, durante o próprio turno** (checado após reforço, troca, ataque, conquista e remanejamento). O objetivo aparece no painel (botão Esconder/Mostrar) e todos são revelados na vitória.
- **Domínio:** vence quem tiver **5 das 8 regiões inteiras** (checado ao fim do turno).
- **Conquista Total:** só vence o **último de pé**.
- Ideias para depois (aprovadas como sugestão, ainda não feitas): **Grande Exército** (assimétrico viking × reinos), **Partida Rápida** (limite de rodadas, pontos), **Duplas** (2×2 / 3×3).

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
12–17. Rixa de Sangue — eliminar o jogador de cor X (vermelho, azul, verde, âmbar, roxo, turquesa). Se a cor não estiver na partida, for você mesmo, ou outro jogador eliminá-la antes, vale **36 territórios** (objetivo reserva).
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

Ordem de carregamento no `index.html`: **mapa.js → motor.js → bots.js → desenho.js → cartas.js → telas.js** (+ `estilo.css`), todos com `?v=N`.

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
| `ferramentas/` | Gerador do mapa (não é carregado pelo jogo) |

### motor.js — API
Toda ação devolve `{ ok: true, ... }` ou `{ ok: false, erro: "mensagem PT-BR" }`.

**Ações:** `criarPartida(jogadores, { modo })` · `calcularReforcos` → `{ base, porRegiao, ordem, total }` · `posicionarReforco(estado, t, qtd)` · `terminarReforco` · `trocarCartas(estado, [i, j, k])` · `atacar(estado, origem, destino, opcoes)` · `moverNaConquista(estado, total)` · `terminarAtaque` · `remanejar(estado, origem, destino, qtd)` · `passarVez` (devolve `carta` quando o jogador ganhou uma).

**Consultas:** `territoriosDe`, `contarExercitos`, `regioesDominadas`, `inimigosVizinhos`, `ehFronteira`, `frescosEm`, `jogadoresVivos`, `verificarVitoria`, `resumoJogadores`, `acharTroca`, `trocaValida`, `valorDaTroca`, `simboloDoTerritorio`, `trocaObrigatoria`, `objetivoCumprido`, `objetivoEfetivo`, `descreverObjetivo`. Dados dos modos/objetivos: `MODOS`, `OBJETIVOS`, `OBJETIVO_RESERVA`.

**Estado** (dado simples, pronto para salvar/enviar): `modo`, `territorios`, `jogadores` (cada um com `cartas`, `objetivo` no Clássico e `eliminadoPor`), `vez`, `turno`, `fase`, `reforcosPendentes`, `reforco`, `movidos`, `baralho`, `descarte`, `trocasFeitas`, `conquistouNoTurno`, `conquista`, `vencedor`, `ultimoEvento`, `log`.

### Tela — pontos-chave
- Mapa estilo WAR: cada território é uma área pintada com a **cor da sua região**; divisa fina entre territórios, grossa entre regiões; peças (discos) com a **cor do dono** e o nº de exércitos. Tocar no território ou na peça.
- Nomes de território que colidem mudam de lugar sozinhos (`afastarNomes`).
- **Dados** aparecem em cima da batalha e somem em 1,5 s.
- **Zoom** pelos botões + / − (mantém o centro).
- **Botão "Painel"** no cabeçalho recolhe o painel (fica só a vez, a fase e os botões) — pensado para o celular; a escolha fica guardada no navegador.
- Painel mostra o **modo** e, no Clássico, o **objetivo** do jogador.
- Bots jogam com pausa (~780 ms); territórios que trocam de dono piscam.
- Cores dos assentos: `#c0392b`, `#2c6fbb`, `#27ae60`, `#e0a200`, `#8e44ad`, `#16a085`. Acento pergaminho/osso `#cbb892`; títulos em **Cinzel**.

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

## 8. Próximos passos (ordem combinada)

1. **Playtest de Kauã no celular** (pendente) — e ajustes que saírem dele.
2. **Outros modos** (Grande Exército, Partida Rápida, Duplas, ou novos que Kauã trouxer) — depois do teste dos três primeiros.
3. **PWA** — instalável e jogável offline; deve **atualizar sozinho** quando houver versão nova (service worker que procura atualização ao abrir; aviso "Nova versão disponível, toque para atualizar"). Junto: **modo paisagem no celular** (layout próprio deitado, aviso "gire o celular" em pé, e travar deitado no app instalado — o Android respeita, o iPhone não).
4. **Online (multiplayer)** — Firebase Realtime Database autoritativo ("Opção A"): a partida vive na nuvem, sobrevive à queda de qualquer jogador, quem cai é substituído por bot. Novo `rede.js`, reaproveitando `kfgc-web/super-trunfo-egipcio-online-multiplayer` (login anônimo, salas com código de 5 letras), refatorado para nuvem-autoritativo e 6 assentos. Firebase novo, plano Spark gratuito, sem Cloud Functions. Link de convite. Kauã precisa criar o projeto no Firebase (Claude guia).
