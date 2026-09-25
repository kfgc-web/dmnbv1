# Domination: Britannia — Registro de design e autoria

Direção criativa: **Kauã Felipe Gielow Camargo**. Engenharia (código): Claude (Anthropic), sob a direção de Kauã.
© 2026 Kauã Felipe Gielow Camargo. Todos os direitos reservados (ver [LICENSE](LICENSE)).

Este documento resume o que foi registrado sobre o jogo e lista, com data e fonte, as decisões dadas, pedidas, aprovadas ou confirmadas por Kauã. As seções descritivas só resumem o que já estava registrado; o Registro de decisões só transcreve.

---

## Visão geral

Jogo de estratégia de conquista por turnos no navegador, estilo War/Risk. Joga-se sozinho contra bots ou online com amigos, no computador ou no celular (como app instalável, deitado). No ar em https://kfgc-web.github.io/dmnbv1/.

Divisão do trabalho: Kauã é o diretor criativo; o Claude faz a engenharia. Nada é aplicado sem a aprovação de Kauã (protocolo esclarecer → confirmar → "pode ir" → agir).

## Ambientação

Britânia e Irlanda por volta de 866 d.C. (era de *The Last Kingdom*: anglo-saxões, celtas e vikings). Regiões e territórios com nomes de época, só formas atestadas: inglês antigo, galês, irlandês antigo, gaélico e nórdico (ex.: Eoforwic, Lundenburg, Dyflin, Kirkjuvágr).

## Mapa

64 territórios em 8 regiões: Westseaxe, East Engle, Mierce, Cymru, Northhymbre, Dál Riata, Alba e Ériu. Cinco rotas marítimas, três becos sem saída intencionais (Mön, Ljóðhús, Kirkjuvágr) e sete ligações acrescentadas por Kauã depois de um playtest. O desenho segue o litoral real, estilo War: cada território pintado com a cor da sua região.

## Regras e modos

Reforço → ataque → remanejamento. Combate com dados d8 (ataque até 4, defesa até 3, empate da defesa). Na conquista entram 1, 2 ou 3 exércitos, à escolha do jogador. Bônus por região inteira, reforço guiado região por região ("Modo B"), cartas com três símbolos e trocas.

Seis modos: **Clássico** (17 objetivos secretos), **Domínio** (5 das 8 regiões), **Conquista Total** (último de pé), **Partida Rápida** (15 rodadas, por pontos), **Grande Exército** (Vikings contra os 8 reinos, 9 lugares) e **Equipes** (duplas ou trios).

Online: sala com código e convite, cor escolhida por cada pessoa, bot no lugar de quem cai ou fica parado.

## Identidade visual

Tema "mesa de guerra à noite": fundo escuro, acento pergaminho/osso `#cbb892`, títulos na fonte Cinzel, dados d8 desenhados como octógonos. Cartas em pergaminho com borda trançada celta. Ícone do app: um escudo (arte feita por IA a pedido de Kauã).

---

## Registro de decisões

Regras deste registro:
- Só entra o que Kauã deu, pediu, aprovou ou confirmou. Escolha técnica do Claude não entra.
- O texto é transcrito da fonte, sem interpretação.
- Itens do CLAUDE.md são datados pelo commit que trouxe a linha (`git log -S`) e pelo PR que o juntou ao `main`.
- O que não dá para datar com segurança fica como "data a confirmar".

Fontes:
- **H1:** `historico/resumo-mestre-12.7.2026.md` (documento de retomada gerado em 12.7.2026, da época do chat comum).
- **C:** `CLAUDE.md` do repositório.
- **S1:** mensagens de Kauã na sessão do Claude Code iniciada em 24.9.2026 (hoje "aposentada"), transcritas por ele.
- **S2:** mensagens de Kauã na sessão do Claude Code de 25.9.2026 (online, autoria).
- **S3:** mensagens de Kauã na sessão do Claude Code de 25.9.2026 (revanche e tutorial).
- **G:** histórico de commits do GitHub (datas registradas pelo servidor).

| Data | Decisão | Fonte |
|---|---|---|
| 29.6.2026 | Primeiro envio dos arquivos do jogo ao repositório `kfgc-web/dmnbv1` ("Add files via upload", feito por Kauã pelo navegador). Segundo envio em 1.7.2026. | G |
| até 12.7.2026 | "Kauã é o diretor criativo; Claude faz toda a engenharia." | H1, §2 |
| até 12.7.2026 | Conquista: "o motor move até 4 exércitos por padrão (não exatamente 1). Kauã decidiu manter assim até o playtest." | H1, §3 |
| 25.9.2026 | "Claude, consegue acessar o GitHub? Consegue ver o repositório do "WAR Britânico"? O próximo passo seria ajustar os nomes né? Também, precisaríamos desenhar o mapa, para ficar bonito igual ao do WAR, certo? Diz aí: o que precisamos fazer para o jogo funcionar? Depois que você mapear o que falta, analisamos tudo e, se eu julgar correto, partimos para o próximo passo." (mensagem de 24.9.2026) | S1, 1ª mensagem; PR #1 |
| 25.9.2026 | "Kauã é o diretor criativo; Claude faz toda a engenharia." | C (commit 1669e9a), PR #3 |
| 25.9.2026 | Publicação: Claude "junta ao `main` por conta própria (autorizado por Kauã), depois avisa." | C (commit 1669e9a), PR #3 |
| 25.9.2026 | Nomes: "não inventar nomes — só formas atestadas; se não houver, decidir com Kauã." | C (commit 1669e9a), PR #3 |
| 25.9.2026 | "Ligações acrescentadas por Kauã após playtest: Loncaster–Rippel, Legaceaster–Powys, Grantebrycge–Lundenburg, Lundenburg–Wintanceaster, Sumorsaete–Gwent, Ard Sratha–Mainistir Bhuithe, Gleawanceaster–Hamtun." | C (commit 1669e9a), PR #3 |
| 25.9.2026 | "Beannchar × Cruachan não são vizinhos (confirmado por Kauã)." | C (commit 1669e9a), PR #3 |
| 25.9.2026 | Conquista: "entram no máximo 3 exércitos (sempre fica 1 na origem). O jogador escolhe 1, 2 ou 3 numa janela logo após a conquista (limite decidido por Kauã: mover tudo gerava conquistas em cadeia)." | C (commit 891343c), PR #4 |
| 25.9.2026 | "Objetivos do Clássico (17, aprovados por Kauã)." | C (commit ffd0db2), PR #5 |
| 25.9.2026 | Texto da vitória no Clássico: "Agora ficou muito extenso, coloca só o "cumpriu o objetivo reserva...", sem dizer qual era o objetivo original, pois esse aparece embaixo. E daí debaixo, tira o objetivo reserva, deixa só o original. Pode ser?" (No CLAUDE.md: "texto curto, pedido de Kauã".) | S1, 2ª mensagem; C (commit fe59a28); PR #8 |
| 25.9.2026 | "Salve os scripts, fica mais fácil daí. Obrigado Claude. No chat novo, implantaremos os outros modos." | S1, 3ª mensagem; PR #9 |
| 25.9.2026 | Rixa de Sangue: "Só é sorteada se a cor estiver na partida e nunca contra a própria cor (pedido de Kauã)." | C (commit 7dc902e), PR #10 |
| 25.9.2026 | Rixa de Sangue: "Só é sorteada se a cor estiver na partida (pedido de Kauã). Pode sair contra a própria cor (como no WAR)." | C (commit 3d981b4), PR #11 |
| 25.9.2026 | "Outros modos — em definição com Kauã; implantar todos de uma vez quando as regras estiverem fechadas." "Partida Rápida (definido): acaba após 15 rodadas (15 turnos por jogador). Pontos: 1 por território; território de região inteira vale 3. Desempate: mais exércitos. Último de pé também vence." | C (commit 3d981b4), PR #11 |
| 25.9.2026 | Ícone do app: "icone-fonte.webp (arte do escudo, feita por IA a pedido de Kauã)." | C (commit 7926862), PR #15 |
| 25.9.2026 | "Celular: só deitado (decisão de Kauã)." | C (commit 7926862), PR #15 |
| 25.9.2026 | "Playtest de Kauã aprovado; dados mantidos (4 d8 × 3 d8 — simulação mostrou equilíbrio); 3×3 fica como está (aparece com 5 adversários)." | C (commit 7926862), PR #15 |
| 25.9.2026 | "Playtest do app no celular — aprovado por Kauã ("ficou perfeito")." | C (commit 8087d09), PR #16 |
| 25.9.2026 | "Vamos começar o online do Domination: Britannia (passo 2 do CLAUDE.md)." Projeto `domination-britannia` criado por Kauã no Firebase. | S2; PR #17 |
| 25.9.2026 | Online, respostas às decisões: "1. B. 2. O bot espera 10 segundo para assumir. 3. Quem está conectado, mas parado, após 60 segundos de inatividade absoluta (sem posicionar exército, sem movimentar, sem fazer nada), o host (quem criou a sala) tem a opção de colocar um bot para assumir aquela jogada. Se o jogador voltar ou na próxima, ele assume daí, novamente. Se, na próxima jogada, novamente demorar, aparece novamente a opção para o host." (1 = equipes montadas por quem criou a sala, com botão "Sortear".) Seguido de "pode ir". | S2; PR #17 |
| 25.9.2026 | "Limite aceito por Kauã: quem fuçar o navegador consegue espiar objetivos e cartas dos outros (esconder de verdade exigiria servidor pago)." | C (commit 8fb14b4), PR #17 |
| 25.9.2026 | "Testei o online, e aparentemente funciona kkk." | S2 |
| 25.9.2026 | Descrição do Grande Exército no README: "o objetivo dos reinos é expulsar os vikings, mas que eles podem se atacar e, também, ganha quem conseguir mais pontos (que são ganhos derrotando vikings), então quem estiver na Irlanda, por exemplo, terá de decidir se ataca ou não seus "aliados". Se atacar, vira inimigo, se não atacar, a chance de ganhar é quase 0, visto que dificilmente conseguirá pontos." | S2; PR #18 |
| 25.9.2026 | "Atualiza a versão dentro do jogo sim, por gentileza. Também, faz com que os bots revidem. Eles não atacam ativamente, mas se forem atacados, não vão só morrer sem reagir." | S2; PR #18 |
| 25.9.2026 | README em português e inglês, com prints, citando o Claude: "Pode se citar também, sem problemas, só quero mesmo é que fique registrado que o diretor criativo fui eu." LICENSE, aviso de © no jogo, pasta `historico/` e este registro, conforme `instrucoes-autoria-code.md`. | S2; PR #18 |
| 25.9.2026 | Sobre as sugestões de melhoria: "Gostei da ideia 2, é excelente. Eu já tinha sentido falta disso quando joguei, mas esqueci de comentar. A ideia 3 também é bacana, dentre os modos de jogo, podemos adicionar um modo tutorial, bem simples, talvez até com uns bots mais burrinhos. As sugestões 1 e 6 não me parecem necessárias, por hora." (2 = revanche na mesma sala; 3 = tutorial; 1 = salvar a partida sozinho; 6 = estatísticas.) | S3; PR #19 |
| 25.9.2026 | Revanche: "Isso, todos voltam à sala, só ver que o host está organizando a revanche sem poder fazer nada não é muito bacana." Placar da sala: "Acredito que não há necessidade. Eu e meus amigos competimos assim, claro, é muito bom se gabar por ter ganho mais partidas, mas isso fica só na conversa mesmo kkk." | S3; PR #19 |
| 25.9.2026 | Tutorial: "Acredito que o ideal sejam 3 bots, e sim, eles podem ter só uns 70% da inteligência do bot padrão, mais disso já seria difícil para um tutorial e abaixo seria muito fácil. Não vamos colocar limite de tempo, se o jogador quiser jogar até o fim, joga, mas damos as intruções [...]. Acredito que é legal manter a aleatoriedade para ensinar a conquistar um reino e ver que ganha bônus, e sim, pensei também nos balõezinhos explicativos, explicando passo a passo do jogo. O objetivo pode ser conquistar 3 reinos à escolha do jogador (até é bacana incluir objetivos deste gênero ao jogo normal), acredito que não seja fácil nem difícil demais." | S3 |
| 25.9.2026 | Tutorial: "eu disse 15 rodadas apenas para ilustrar, mas ele pode terminar o tutorial antes ou depois [...]". Aprovados o botão "Pular tutorial" e o Tutorial em primeiro na lista com "Novo no jogo? Comece aqui". | S3 |
| 25.9.2026 | Tutorial: fim ao fazer a 1ª troca de cartas — "Sim, a troca pode ser o fim, além disso já é mais "natural" e fácil de se entender, sem muita necessidade de tutorial; mas é claro que manteremos os "passos extras" para caso algo daquilo aconteça." Botão "Dicas": "Sim, esse botão é importante." Textos dos balões propostos por Claude (1º turno guiado: boas-vindas, mapa, reforço, ataque, dados, conquista, terminar ataque, remanejar, carta, vez dos adversários; depois: fechou região, 1ª troca, 5 cartas, perdeu território, adversário fechou região): "Acho que está tudo ok, não tenho nada a opor [...]. Pode ir." | S3 |
