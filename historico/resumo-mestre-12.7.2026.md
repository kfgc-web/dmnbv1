# Domination: Britannia — Resumo-mestre do projeto

*Documento de retomada. Cole/anexe este arquivo no chat junto com os **6 arquivos do jogo** sempre que for continuar o trabalho. Ele substitui todo o histórico de chats anteriores.*

Gerado em: 12/07/2026.

---

## 1. O projeto

Jogo de estratégia de conquista no navegador, estilo **War/Risk**, ambientado na **Britânia e Irlanda por volta de 866 d.C.** (era de *The Last Kingdom*: anglo-saxões, celtas e vikings).

- **No ar:** https://kfgc-web.github.io/dmnbv1/ (GitHub Pages)
- **Repositório:** público, `kfgc-web/dmnbv1`, branch `main`, 6 arquivos na raiz
- **Nome oficial:** **Domination: Britannia** (com "nn" — não "Britânia"). Aparece só onde o jogador vê: `<title>`, `<h1>` e `<h2>` do modal de início. Comentários internos do código mantêm "WAR BRITÂNICO". O nome do repo (`dmnbv1` = Domination: Britannia v1) fica como está.
- **Por que não "Dominations":** colisão de marca com o jogo *DomiNations* (Big Huge Games/Nexon) — risco sob a Lei 9.279/96. Decisão já tomada; não reabrir.
- Tudo em **PT-BR informal**, inclusive mensagens de erro do motor.

## 2. Como trabalhamos (protocolo fixo)

- **Kauã é o diretor criativo; Claude faz toda a engenharia.** Kauã é não-técnico — explicações sempre acessíveis.
- **Protocolo:** esclarecer → confirmar → **"pode ir"** → agir. Nada de código antes do OK explícito.
- Kauã é **token-consciente** e prefere **ARQUIVOS COMPLETOS** para revisar linha a linha (não colar código inteiro no chat).
- Upload dos arquivos é feito **pelo navegador** no GitHub (não Git CLI); teste no GitHub Pages.
- **Depois de mexer em `motor.js` ou `bots.js`, SEMPRE rodar simulação de stress dos bots** (milhares de partidas) para validar antes de entregar.
- **`mapa.js` e `estilo.css` NÃO se tocam sem autorização explícita.**

## 3. Regras do jogo (travadas — não mudam)

- **64 territórios em 8 regiões:** Wessex (9), Ânglia Oriental (4), Mércia (9), Gales (4), Northumbria (9), Dál-Riata (6), Escócia (9), Irlanda (14).
- **Bônus por região inteira:** Irlanda 7 · Mércia 6 · Wessex 5 · Northumbria 5 · Escócia 5 · Dál-Riata 4 · Ânglia Oriental 3 · Gales 3.
- **Combate:** dados **d8**; ataque rola até 4 dados, defesa até 3; **empate favorece a defesa** (design pró-atacante mesmo assim, pelos 4 dados).
- **Reforço-base** = `max(3, round(territórios / 3))` + bônus regionais.
- **Turno:** reforço → ataque → remanejamento.
- **Vitória:** dominar **5 das 8 regiões inteiras** (à escolha do jogador, checado ao fim do turno) **OU** ser o último de pé.
- **Jogadores:** 2 a 6 (recomendado 4–6), humanos ou bots por assento. Distribuição inicial dos territórios: round-robin embaralhado (jogadores espalhados pelo mapa). Com 4 jogadores, 16 territórios cada.
- **Divergência intencional conhecida:** na conquista, o motor move **até 4 exércitos por padrão** (não exatamente 1). Kauã decidiu manter assim até o playtest; existe fix de 1 linha se quiser mudar.

### Reforço — "Modo B" (sequência guiada) — implementado
- O bônus de cada região fica **PRESO à própria região** (só pode ser posicionado nela).
- A tela acende só a região da vez, na **ordem fixa:** Irlanda → Dál-Riata → Escócia → Northumbria → Mércia → Ânglia Oriental → Wessex → Gales; o **reforço geral (base) vem por último** (mapa todo aceso).
- **Auto-avanço:** não existe botão "Terminar reforço" — quando o total zera, ~0,3s depois a tela abre a fase de ataque sozinha. A fase de ataque manteve os botões ("Terminar ataque" / "Passar vez").

### Remanejamento múltiplo com trava por exército — implementado
- Acabou o limite de 1 movimento por turno: **vários pulos por fase**.
- Cada pulo = entre **dois territórios seus vizinhos**; **sempre fica ≥1 na origem**.
- **Cada exército move no máximo UMA vez** na fase: ao chegar, **trava**. Só a tropa "fresca" (não-movida) pode sair. Ex.: A(10)→B — os que chegaram travam; os que já estavam em B continuam livres para B→C.
- Exércitos que avançaram numa conquista durante o **ataque** começam o remanejamento **livres** (a trava só conta movimentos da fase de remanejamento).

## 4. O mapa (dados lógicos)

- Fonte canônica original: documento `War_Britanico_mapa_64.md` (listas de território / litoral / vizinhos por região, validadas com simetria de adjacência). Os dados vivem hoje dentro de `mapa.js`.
- **5 rotas marítimas:** Gwynedd↔Dublin · Belfast↔Wigtown · Belfast↔Ilha de Mann · Gairloch↔Stornoway · Gairloch↔Kirkwall.
- **3 becos sem saída intencionais** (uma conexão só): Ilha de Mann, Stornoway, Kirkwall.
- Nomes atuais dos territórios: cidades modernas (York, London, Dublin etc.) — a renomeação de época está na fila (ver §8).

## 5. Arquitetura — os 6 arquivos

Ordem de carregamento no `index.html`: **mapa.js → motor.js → bots.js → telas.js** (+ `estilo.css`).

| Arquivo | Papel |
|---|---|
| `index.html` | Casca: título, `<h1>`, `<div id="overlay">` vazio (modais são injetados por JS), tags `<script>` na ordem acima |
| `estilo.css` | Visual (NÃO tocar sem autorização) |
| `mapa.js` | **Só dados lógicos:** territórios, regiões, litoral, vizinhos, rotas marítimas, bônus. **Sem coordenadas.** (NÃO tocar sem autorização) |
| `motor.js` | Motor de regras **puro** (sem tela, sem rede) em cima do mapa.js |
| `bots.js` | IA heurística; `jogarTurnoBot(estado)` joga o turno inteiro do jogador da vez (muta o estado; resiliente a herdar turno no meio de qualquer fase) |
| `telas.js` | Toda a UI: `POSICOES` (coordenadas), montagem do SVG, modais, interação |

### motor.js — API pública
Toda ação devolve `{ ok: true, ... }` ou `{ ok: false, erro: "mensagem em PT-BR" }`. Mapa.js deve estar carregado antes.

**Ações:** `criarPartida(jogadores)` (lista de `{nome, tipo}`, tipo `"humano"`/`"bot"`) · `calcularReforcos(estado, id)` → **`{ base, porRegiao, ordem, total }`** · `posicionarReforco(estado, territorio, qtd)` (respeita a restrição de região do Modo B) · `terminarReforco` · `atacar(estado, origem, destino)` → `{ ok, dadosAtaque, dadosDefesa, perdasAtacante, perdasDefensor, conquistou, exercitosMovidos }` · `terminarAtaque` · `remanejar(estado, origem, destino, qtd)` (um pulo; trava quem chega) · `passarVez`.

**Consultas:** `territoriosDe`, `contarExercitos`, `regioesDominadas`, `inimigosVizinhos`, `ehFronteira`, `frescosEm` (tropa fresca num território), `jogadoresVivos`, `verificarVitoria`, `resumoJogadores`.

**Estado:** inclui os campos `reforco` (controle do Modo B) e `movidos` (trava por território no remanejamento; inicializado em `terminarAtaque`, zerado em `passarVez`).

### telas.js — pontos-chave
- **`POSICOES`** no topo do arquivo: `"Território": [x, y]` — 64/64 entradas, nomes batendo exatamente com `mapa.js`. **Nenhum outro arquivo usa coordenadas** — hulls das regiões, rótulos, arestas e discos são todos gerados automaticamente a partir de POSICOES.
- `viewBox = "0 0 1000 1300"` (retrato), `VIEW_W=1000`, `VIEW_H=1300`, `R_DISC=17`. A proporção 1000×1300 (~0,77) bate com a proporção real Britânia+Irlanda (~0,78 com correção de latitude).
- Interação por fase: reforço = tocar nos próprios territórios (só a região acesa aceita); ataque = tocar origem (2+ exércitos) → alvo inimigo destacado (pode encadear); remanejamento = origem → vizinho seu → stepper limitado à tropa fresca.
- Bots jogam com pausa (~780 ms); territórios que trocam de dono **piscam**. Modais de início (escolhe nº de bots) e de vitória.

### Identidade visual
- Tema **"mesa de guerra à noite"**: fundo escuro, acento pergaminho/osso `#cbb892`, título na fonte **Cinzel**.
- Elemento-assinatura: os dados **d8 desenhados como octógonos** na hora do ataque.
- Cores dos assentos: `#c0392b` (vermelho), `#2c6fbb` (azul), `#27ae60` (verde), `#e0a200` (âmbar), `#8e44ad` (roxo), `#16a085` (turquesa).

## 6. Histórico — o que já foi feito e validado

1. **Design completo do mapa** região por região, com validação de simetria de adjacências (correções: Hawick adicionado à Northumbria, adjacências de mão única consertadas, grafias padronizadas, 6 nomes duplos resolvidos).
2. **`motor.js`** validado com 500 partidas simuladas (4/5/6 jogadores), zero falhas.
3. **`bots.js`** validado com 2.500 partidas + teste de resiliência em 4 cenários.
4. **Separação em 6 arquivos** e publicação no GitHub Pages (o SyntaxError do preview de arquivo único era só das tags `</script>` em comentários — não existe na estrutura separada).
5. **Pacote de refinamento** (32 checagens + **3.000 jogos limpos**): nome final "Domination: Britannia"; reforço **Modo B** com auto-avanço; **remanejamento múltiplo** com trava por exército. Bots atualizados para respeitar a restrição regional (`botDrenarReforco` incluído).
6. **Reposicionamento geográfico dos territórios:** o `POSICOES` foi recalculado com **projeção equiretangular** a partir dos documentos de descrição de vizinhança, para o mapa ficar fiel à geografia real da Britânia/Irlanda. Só `telas.js` foi tocado.

## 7. Estado atual

O jogo está **completo e jogável offline** (você vs bots) no GitHub Pages: mapa geograficamente fiel, distribuição, turno completo (Modo B → ataque → remanejo múltiplo), bônus regionais, vitória, bots competentes. Motor e bots validados por stress.

## 8. Fila de próximas tarefas (em ordem)

### 8.1 Renomeação de regiões e territórios para nomes de época (~866)
- **Critério linguístico por região:** Old English (Wessex, Mércia, Northumbria, Ânglia Oriental) · galês/britônico (Gales) · irlandês antigo (Irlanda) · gaélico/picto (Escócia, Dál-Riata) · nórdico antigo (Ilha de Mann, Kirkwall/Órcades, Stornoway/Hébridas).
- **Regras travadas:** **NÃO inventar nada** — só formas atestadas; se não houver, sinalizar e decidir junto. Cidades que não existiam em 866 (Newcastle ~1080, Blackpool etc.) → substituir por povoado/sítio real da época e da vizinhança. **Autenticidade total**, mesmo opaca ao olho moderno (York → *Eoforwic*, London → *Lundenburg*). Jogo privado entre amigos; sem preocupação com acessibilidade.
- **3 decisões globais pendentes:** (a) ortografia normalizada vs com þ/ð; (b) rótulos de região — ex.: Escócia → *Alba* vs *Pictland*/*Fortriu*; (c) filosofia de substituir cidades posteriores por mosteiros/sítios reais de 866 (ex.: Athlone → Clonmacnoise, Waterford → Lismore, Glasgow → Alt Clut).
- ✅ O rascunho completo (8 regiões + 64 territórios, com casos sinalizados) está salvo no arquivo companheiro **`domination-britannia-nomes-866.md`** — anexar junto quando esta tarefa for atacada.
- Toca: `mapa.js` (autorização já implícita na tarefa) + `telas.js` (POSICOES usa os nomes como chave — renomear em sincronia!) + possivelmente `bots.js`/`motor.js` se referenciarem nomes. Re-rodar stress.

### 8.2 PWA
- `manifest.json` + service worker → instalável e jogável offline.

### 8.3 Online (multiplayer)
- **Firebase Realtime Database autoritativo ("Opção A"):** o estado da partida vive na nuvem; a partida sobrevive à queda de qualquer jogador; quem cai é substituído por bot ("zelador" roda bots nos assentos vazios/desconectados).
- Novo módulo **`rede.js`**, reaproveitando a arquitetura do projeto anterior **`kfgc-web/super-trunfo-egipcio-online-multiplayer`** (Firebase, login anônimo, salas com código de 5 letras) — mas o projeto antigo era host-autoritativo ("Opção B") e com 4 assentos: precisa refatorar para nuvem-autoritativo e 6 assentos. Firebase novo e separado, plano Spark gratuito, sem Cloud Functions (custo zero). Link de convite.

## 9. Como retomar o trabalho num chat novo

Anexar: **os 6 arquivos** (`index.html`, `estilo.css`, `mapa.js`, `motor.js`, `bots.js`, `telas.js`) + **este documento**. Dizer qual tarefa da fila (§8) vai ser atacada. O Claude confere os arquivos, esclarece dúvidas, e só age depois do **"pode ir"**.
