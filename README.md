# SYNAPSE · Governança GBS

## Painel de Governança do CoE de Projetos e Automações — GBS Saint-Gobain Brasil

O SYNAPSE é o dashboard de governança do CoE de Projetos e Automações do GBS (Global Business Services). Ele consolida projetos, melhorias Pipefy, chamados de manutenção RPA e atividades de Analytics em uma única interface, a partir das planilhas que a equipe já utiliza no dia a dia.

Este documento cobre o uso e o funcionamento interno do sistema: a estrutura de dados, o comportamento de cada tela e as regras de leitura e transformação das planilhas carregadas pelo usuário. O objetivo é permitir que qualquer pessoa da equipe entenda o sistema sem precisar ler o código-fonte.

> **Acesso:** https://synapse-gbs-governanca.vercel.app
> **Dados:** 100% locais. Nenhuma informação sai do navegador do usuário (ver seção 24).

---

## Sumário

1. [Como usar](#1-como-usar)
2. [Abas do dashboard](#2-abas-do-dashboard)
3. [Arquitetura geral](#3-arquitetura-geral)
4. [Estado global (`App`)](#4-estado-global-app)
5. [Tela de upload](#5-tela-de-upload)
6. [Geração do dashboard](#6-geração-do-dashboard)
7. [Leitura e transformação das planilhas](#7-leitura-e-transformação-das-planilhas)
8. [Normalização de status](#8-normalização-de-status)
9. [Filtro global de período](#9-filtro-global-de-período)
10. [Barra superior](#10-barra-superior)
11. [Navegação entre abas](#11-navegação-entre-abas)
12. [Aba Painel de Controle](#12-aba-painel-de-controle)
13. [Aba Projetos](#13-aba-projetos)
14. [Aba Pipefy Melhorias](#14-aba-pipefy-melhorias)
15. [Registro manual de atividades](#15-registro-manual-de-atividades)
16. [Aba Analytics](#16-aba-analytics)
17. [Aba RPA e Bots](#17-aba-rpa-e-bots)
18. [Análise automática](#18-análise-automática)
19. [Gráficos](#19-gráficos)
20. [Exportação para PDF](#20-exportação-para-pdf)
21. [Fundo animado](#21-fundo-animado)
22. [Identidade visual](#22-identidade-visual)
23. [Estrutura de arquivos](#23-estrutura-de-arquivos)
24. [Privacidade e segurança](#24-privacidade-e-segurança)
25. [Referência de funções](#25-referência-de-funções)

---

## 1 Como usar

1. Abra o site publicado. O `index.html` sozinho, aberto localmente, não funciona: ele depende do `app.js` gerado pelo Vercel a cada deploy (ver seção 3.1).
2. Na tela de Upload, carregue as duas bases:

| Arquivo | Abas lidas |
|---|---|
| `Base_Governanca_GBS.xlsx` | Pipefy_Melhorias · Projetos · Analytics · Inventario_RPA |
| `relatório_completo.xlsx` | A aba com mais colunas de chamado (detectada automaticamente) |

3. Clique em "Gerar dashboard".
4. Use o filtro de período no topo para recortar os dados de todas as abas ao mesmo tempo.
5. Use "Exportar PDF" para gerar um PDF da aba atual (impressão nativa do navegador).

---

## 2 Abas do dashboard

| Aba | Conteúdo |
|---|---|
| Painel de Controle | Visão executiva: KPIs consolidados das 4 fontes, ações abertas por responsável CoE, donut de status |
| Projetos | Portfólio: status, fase, prazo, score de risco automático, filtros e painel de detalhes por projeto |
| Pipefy Melhorias | Melhorias e ajustes: status, complexidade, frente, responsável, gráfico evolutivo, overview por categoria |
| RPA & Bots | Chamados de manutenção (volume, tipos de problema, tempo de resolução, lista) e inventário de bots |
| Analytics | Atividades de Analytics: status, prioridade, frente, responsável |

---

## 3 Arquitetura geral

O SYNAPSE roda inteiramente no navegador do usuário. Não há servidor, banco de dados nem API própria: o processamento das planilhas, os cálculos e a montagem dos gráficos acontecem no cliente.

O fluxo de uso segue esta sequência: o usuário carrega duas planilhas Excel; o `FileReader`, API nativa do navegador, lê cada arquivo como `ArrayBuffer`; a biblioteca SheetJS converte o binário em um objeto de planilha (workbook); os parsers percorrem as abas relevantes e produzem arrays de objetos normalizados, armazenados em `App.dadosGovernanca.*`, `App.chamadosRPA` e `App.bots`; cada função de construção de aba lê esses arrays, aplica o filtro de período ativo e monta o HTML correspondente; por fim, o Chart.js desenha os gráficos nos elementos `<canvas>` inseridos na página.

```
Planilhas Excel → FileReader API → SheetJS → Parsers → Arrays normalizados → KPIs + Gráficos
```

Não há envio de dados para fora do navegador em nenhuma etapa desse fluxo. O código não contém chamadas de `fetch`, `XMLHttpRequest` ou `WebSocket` para servidor próprio. As únicas conexões de rede da página servem para carregar bibliotecas, ícones e fontes hospedados em CDN, que não recebem o conteúdo das planilhas.

**Dependências externas (CDN, sem instalação):**

| Biblioteca | Versão | Finalidade |
|---|---|---|
| [SheetJS (xlsx)](https://sheetjs.com/) | 0.18.5 | Leitura de arquivos `.xlsx`/`.xls` no navegador |
| [Chart.js](https://www.chartjs.org/) | 4.4.0 | Renderização dos gráficos de linha, barra e donut |
| [Tabler Icons](https://tabler.io/icons) | 3.19.0 | Ícones da interface |
| [Inter + Syne](https://fonts.google.com/) | — | Tipografia |

### 3.1 Relação entre `src/` e `app.js`

`src/` é a única fonte da verdade do código. É lá que toda alteração de lógica deve ser feita, nos cerca de vinte módulos com declarações `import`/`export` documentados ao longo deste texto.

`app.js` é o artefato de build: o arquivo único, gerado a partir de `src/main.js` e seus imports, que o `index.html` efetivamente carrega (`<script src="app.js">`). Ele nunca é editado à mão e não é versionado no git (está listado no `.gitignore`). Existe apenas como saída de um comando de build.

A geração acontece no deploy, não na máquina local. O `vercel.json` define `buildCommand: "npm install && npm run build && rm -rf node_modules"`. A cada push para o repositório, o Vercel instala o `esbuild` (dependência de desenvolvimento listada no `package.json`), executa `esbuild src/main.js --bundle --format=iife --outfile=app.js` e remove o `node_modules` antes de publicar o resultado. O Vercel tem Node.js disponível no seu próprio ambiente de build, o que contorna a restrição da máquina corporativa, onde Node.js não está instalado e não pode ser instalado.

Isso elimina o risco de duplicação: antes, `app.js` e `src/` eram mantidos manualmente em paralelo e podiam divergir. Agora só existe uma versão do código (`src/`), e `app.js` é sempre reflexo exato dela após o próximo deploy.

Consequência prática para desenvolvimento local: sem Node.js na máquina, não é possível regerar `app.js` localmente após editar `src/`. O arquivo foi removido do disco local de forma deliberada, para evitar que uma versão desatualizada fosse aberta por engano no navegador. Abrir o `index.html` diretamente (inclusive via Live Server) carrega a página sem JavaScript funcional. Para validar qualquer alteração em `src/`, o caminho é enviar a mudança para uma branch ou abrir um Pull Request: o Vercel gera automaticamente uma URL de preview já buildada a partir do `src/` atualizado, e é nela que o comportamento real deve ser conferido.

---

## 4 Estado global (`App`)

Um único objeto, `App`, concentra todo o estado da aplicação e é compartilhado por todas as funções:

```js
App = {
  planilhaGovernanca: null,   // workbook da Base Governança, após o upload
  planilhaRPA: null,          // workbook do relatório de Chamados RPA

  dadosGovernanca: {
    melhorias: [],    // Pipefy_Melhorias normalizado
    projetos: [],     // Projetos normalizado
    analytics: []     // Analytics normalizado
  },
  chamadosRPA: [],     // Chamados RPA normalizados
  bots: [],            // Inventário de Bots normalizado

  carregado: { governanca:false, rpa:false },
  periodoFiltro: { modo:'all', de:null, ate:null },

  projetosAbertos: new Set(),
  chipsProjetos: { atraso:false, risco:false },
  frenteGovernanca: '',

  botsAbertos: new Set(),
  avisoRPA: ''
}
```

Nada nesse objeto é persistido entre sessões. Ao recarregar a página, todo o estado volta ao valor inicial e é necessário carregar as planilhas novamente. A única exceção é o registro de atividades da aba Pipefy Melhorias, gravado em `localStorage` e descrito na seção 15.

---

## 5 Tela de upload

A tela inicial apresenta dois cartões de upload lado a lado: Base Governança e Chamados RPA. Cada cartão funciona como uma área de arraste e soltura (dropzone).

| Ação do usuário | Função acionada |
|---|---|
| Clique na área tracejada | Aciona o `<input type="file">` oculto, abrindo o seletor de arquivos do sistema |
| Arrastar um arquivo sobre a área | `tratarArrastarSobreDropzone`: destaca a área com a classe `.over` |
| Arrastar para fora da área | `tratarSairDropzone`: remove o destaque |
| Soltar o arquivo | `tratarSoltarDropzone`: lê o arquivo solto e chama `lerArquivo` |
| Selecionar o arquivo pelo seletor do sistema | `tratarMudancaArquivo`: chama `lerArquivo` sobre o arquivo escolhido |

A função `lerArquivo` cria um `FileReader` e lê o conteúdo como `ArrayBuffer`. Ao concluir a leitura, `XLSX.read()` converte os bytes em um workbook, com a opção `cellDates:true`, que faz o SheetJS retornar objetos `Date` nativos em vez do número serial usado internamente pelo Excel. O workbook resultante é armazenado em `App.planilhaGovernanca` ou `App.planilhaRPA`, conforme o tipo de upload, e as funções `mostrarSucesso` e `atualizarBarra` atualizam a interface.

A função `mostrarSucesso` confirma visualmente o upload e, no caso da Base Governança, verifica quais das quatro abas esperadas (`Pipefy_Melhorias`, `Projetos`, `Analytics`, `Inventario_RPA`) foram encontradas no arquivo, com comparação tolerante a maiúsculas, espaços e underscores. Um diagnóstico adicional varre as colunas da aba `Pipefy_Melhorias` em busca de termos como "data", "criado", "início" ou "conclusão", útil para identificar rapidamente se o nome de uma coluna de data foi alterado na planilha de origem.

A função `atualizarBarra` conta quantos dos dois arquivos já foram carregados e habilita o botão "Gerar dashboard" assim que pelo menos um deles estiver presente; não é necessário carregar as duas bases simultaneamente. As abas que dependem da fonte ausente exibem apenas uma mensagem informando que não há dados carregados.

---

## 6 Geração do dashboard

A função `gerarDashboard` orquestra a construção do dashboard a partir das planilhas carregadas, executando as seguintes etapas em sequência.

Primeiro, todas as instâncias ativas do Chart.js são destruídas e o contador de identificadores é zerado, evitando o erro de canvas duplicado ao gerar o dashboard mais de uma vez na mesma sessão. Em seguida, os parsers correspondentes às fontes carregadas são executados (`interpretarGov` e `interpretarInventario` para a Base Governança, `interpretarRPA` para o relatório de chamados), seguidos por `enriquecerRPAComArea`, que roda mesmo quando uma das fontes está ausente.

A partir dos dados normalizados, o sistema calcula o intervalo de datas coberto pela planilha e define esse intervalo como limite dos campos de data do filtro de período, impedindo a seleção de datas fora do que a base realmente contém. Cada aba é então construída dentro de um bloco `try/catch` independente, de modo que uma falha de renderização em uma aba não interrompa as demais. O erro, quando ocorre, é registrado no console do navegador.

Por fim, o texto de sincronização no topo da página é atualizado com o horário da geração e as fontes carregadas, a barra de filtro de período e o botão de exportação em PDF são exibidos, e a navegação é direcionada automaticamente para a aba Painel de Controle.

---

## 7 Leitura e transformação das planilhas

### 7.1 Detecção de abas

O sistema não exige nomes exatos de aba. A comparação ignora maiúsculas, minúsculas, espaços e underscores, de modo que `Pipefy_Melhorias`, `pipefymelhorias` e `PIPEFY MELHORIAS` são reconhecidos como a mesma aba.

Para o relatório de Chamados RPA, cujo nome de aba varia entre exportações do Pipefy, o sistema testa todas as abas do arquivo e atribui uma pontuação a cada uma, de acordo com a presença de colunas características de um relatório de chamados: `Código`, `Fase atual`, `Processo`, uma coluna relacionada a "qual é o problema" e `Criado em`. A aba com maior pontuação é selecionada. Quando nenhuma aba atinge ao menos duas dessas colunas, o sistema não tenta adivinhar: deixa `App.chamadosRPA` vazio e exibe um aviso informando que o arquivo carregado não corresponde a um relatório de chamados válido.

### 7.2 Pipefy_Melhorias → `App.dadosGovernanca.melhorias`

| Campo interno | Coluna de origem | Observação |
|---|---|---|
| `numero` | Numero | |
| `frente` | Gerencia | área de negócio (P2P, O2C etc.) |
| `fluxo` | NomeFluxo | nome do fluxo de processo |
| `atividade` | Atividade | descrição da melhoria |
| `statusRaw` | Status | texto original da planilha |
| `codigoStatus` | Status, via `classeStatusMelhoria` | ver seção 8; "Planejamento" conta como `doing` |
| `responsavel` | Responsavel | remove um caractere de espaço de largura zero comum em colagens do Excel |
| `champion` | Champion | |
| `complexidade` | Complexidade | |
| `tipo` | TipoMelhoriaAjuste | |
| `dataInicio` | DataInicioDesenvolvimento | sem coluna alternativa |
| `dataFim` | DataRealEstimadaConclusaoValidacaoChampion | apenas quando `codigoStatus==='done'` (ver observação abaixo) |
| `horas` | QtdHorasEstimadas | |

Linhas sem `numero` e sem `atividade` são descartadas. Melhorias de backlog sem `dataInicio` nem `dataFim` são sempre incluídas quando o filtro de período está ativo, por representarem trabalho pendente e não histórico.

A coluna `DataRealEstimadaConclusaoValidacaoChampion` guarda uma data estimada enquanto a melhoria ainda está em desenvolvimento e só passa a representar a data real depois que o champion valida a conclusão. Por isso o parser só preenche `dataFim` quando o item já está com status concluído (`codigoStatus==='done'`). Para os demais status, `dataFim` fica `null`, evitando que uma estimativa ainda não confirmada seja tratada como data de conclusão real pelo filtro de período (ver seção 9).

No comparativo "Concluídas" mês a mês, só entram itens com `codigoStatus === 'done'` e `dataFim` preenchida. Itens marcados como concluídos sem data de conclusão indicam erro de preenchimento na planilha, e a interface exibe um aviso com a contagem exata. Itens não concluídos sem data são esperados, pois ainda estão em andamento ou no backlog.

### 7.3 Projetos → `App.dadosGovernanca.projetos`

O parser reconhece automaticamente duas versões de layout da planilha. No layout atual, a coluna Status contém valores reconhecíveis pela função de classificação, e os campos são lidos pelo nome da coluna (`Numero`, `Titulo`, `Responsavel`, `AreaCliente` ou `Frente`, `PontoFocal`, `Status`, `PrazoConclusão`, entre outros). Quando nenhum valor de Status é reconhecido, o sistema assume uma versão anterior da planilha, na qual os cabeçalhos estão deslocados uma coluna em relação ao conteúdo, e passa a ler por posição: coluna 0 corresponde ao número, 1 ao título, 2 ao responsável, e assim por diante. Em ambos os casos, linhas sem título são descartadas.

### 7.4 Analytics → `App.dadosGovernanca.analytics`

| Campo | Coluna de origem | Observação |
|---|---|---|
| `numero` | Numero | |
| `titulo` | Titulo | linhas sem título são descartadas |
| `statusRaw` / `codigoStatus` | Status | classificação padrão, sem a regra especial do Pipefy |
| `prioridade` | Prioridade | extrai apenas o número do texto |
| `frente` | Frente | |
| `responsavel` | Responsavel | |
| `dataInicio` | DataAbertura | |
| `dataFim` | DataFechamento | |

### 7.5 Inventario_RPA → `App.bots`

| Campo | Coluna de origem | Observação |
|---|---|---|
| `nome` | NomeRPA | linhas sem nome são descartadas |
| `perimetro` | Perimetro | Brasil, MEX, ARG etc. |
| `area` | Area | P2P, TAX, H2R etc. |
| `status` | Status | convertido para maiúsculas: PRD, DEV, BACKLOG, CANCELADO, DESATIVADO |
| `anoPrd` | AnoPRD | ano de entrada em produção, usado no filtro de período específico desta aba |
| `criticidade` | Criticidade | 1 (crítica) a 4 (baixa) |
| `fte` | FTE | FTEs economizados |
| `volumetria` | VolumetriaMensal | transações por mês |

### 7.6 Relatório de Chamados RPA → `App.chamadosRPA`

| Campo | Coluna de origem | Observação |
|---|---|---|
| `codigo` | Código | linhas sem código são descartadas |
| `fase` | Fase atual | fase corrente no fluxo do Pipefy |
| `processo` | Processo | nome do bot; vazio vira `(sem processo)` |
| `solicitante` | Nome do solicitante | quem abriu o chamado |
| `responsaveis` | Responsáveis | quem atende o chamado, armazenado como lista |
| `criado` | Criado em | data de abertura |
| `dataFim` | Finalizado em | data de conclusão |
| `mes` | derivado de `criado` | chave no formato AAAA-MM |
| `vencido` | Vencido | aceita booleano ou texto "true"/"sim" |

Nos comparativos "Volume" e "Vencidos" mês a mês, a base é 100% coberta por `criado`, sem ressalvas de data faltante. Menos chamados representa melhora (verde); mais chamados, piora (vermelho). O comparativo sempre usa a base completa (`App.chamadosRPA`), não o subconjunto filtrado por fase ou por período.

### 7.7 Identificação da área de cada chamado

Os chamados RPA não têm coluna de área na planilha de origem. A função `enriquecerRPAComArea` resolve essa informação em duas etapas. Primeiro tenta um cruzamento com o inventário de bots, comparando os nomes normalizados (sem prefixos entre colchetes, sem acentuação, sem espaços) e verificando se um nome contém o outro. Quando esse cruzamento falha, aplica um conjunto de regras por palavra-chave: processos com termos como "bank statement" ou "payment run" são atribuídos a P2P, termos relacionados a impostos a TAX, e assim por diante. Chamados que não se encaixam em nenhuma das duas regras recebem a marcação `(não mapeada)`.

---

## 8 Normalização de status

Internamente, o sistema nunca compara o texto bruto de status vindo da planilha. Ele trabalha com um código normalizado (`codigoStatus`), já que o texto de origem varia em grafia e acentuação. A função `classeStatus` faz essa conversão.

| Texto na planilha | Código interno |
|---|---|
| Concluído, Finalizado(s) | `done` |
| Suporte Pipefy, Encaminhado ao fornecedor | `vendor` |
| Em andamento, Em execução, Desenvolvimento, Em validação | `doing` |
| Encerramento | `closing` |
| Monitoramento | `monitor` |
| Planejamento, Diagnóstico, Não iniciado, Backlog | `todo` |
| Bloqueado, Pausado | `blocked` |
| Cancelado | `cancel` |
| qualquer outro valor | `other` |

Um prefixo numérico de ordenação, quando presente, é ignorado antes da comparação: "3 - Planejamento" e "Planejamento" resultam no mesmo código.

Existe uma exceção para as Melhorias Pipefy, aplicada pela função `classeStatusMelhoria`: nessa fonte, o status "Planejamento" é tratado como `doing`, e não como `todo`, por já representar trabalho retirado do backlog. Essa distinção permite à coluna "Dev + Planej." do Overview somar os dois estados corretamente. A correção desse comportamento foi a motivação original deste projeto, já que a versão anterior do painel tratava "Backlog" e "Planejamento" como equivalentes. Em Projetos e Analytics a exceção não se aplica: ali, "Planejamento" é a segunda fase do fluxo (Diagnóstico → Planejamento → Execução) e permanece classificada como `todo`.

---

## 9 Filtro global de período

O filtro de período no topo da página afeta todas as abas simultaneamente. Ele pode ser acionado de três formas: pelos atalhos "Este mês", "Trimestre" e "Este ano" (função `definirPeriodoRapido`, que calcula o intervalo a partir da data atual e marca o atalho como ativo); pela edição manual dos dois campos de data (função `aplicarFiltroData`, que monta o intervalo no modo personalizado, cobrindo o dia inteiro em ambas as pontas); ou pelo botão de limpar (função `limparFiltroData`, que retorna ao modo sem filtro). Clicar em um atalho já ativo funciona como alternância e remove o filtro. Qualquer uma dessas ações aciona `renderizarTudo`, que reconstrói todas as abas com dado carregado.

O período não é interpretado da mesma forma em todas as fontes. Cada uma usa a data que faz sentido para o seu contexto de negócio.

| Fonte | Campo de referência |
|---|---|
| Pipefy Melhorias | intervalo `dataInicio` a `dataFim` enquanto em andamento; concluídas usam `dataFim` como data única (ver abaixo) |
| Projetos | `dataFim` (prazo de conclusão) |
| Analytics | intervalo `dataInicio` a `dataFim`, com a mesma regra de itens concluídos que Melhorias |
| Chamados RPA | `criado` (data de abertura) |
| Inventário de Bots | `anoPrd`, filtrado por ano (ver seção 17) |

A lógica central está em três funções do módulo de datas. `dataNoIntervalo` avalia itens com uma única data de referência: sem filtro ativo, tudo passa; com filtro ativo, um item sem data nunca passa. `ativoNoIntervalo` avalia itens com um intervalo próprio, como as Melhorias: um item com apenas a data de início é considerado ativo até a data atual, e um item sem nenhuma das duas datas é classificado como "sem data" e contado à parte.

`filtrarPorPeriodo` decide qual das duas regras aplicar a cada item de um array. Itens ainda em andamento usam o intervalo completo (`ativoNoIntervalo`), porque faz sentido considerá-los ativos durante todo o desenvolvimento. Itens já concluídos (`codigoStatus==='done'`) usam apenas `dataFim` como data única, via `dataNoIntervalo`: uma vez concluído, o item tem uma data de conclusão real e fixa, e o que importa é se essa conclusão caiu dentro do período, não se o desenvolvimento tocou o período em algum momento. Essa distinção evita que um item concluído bem depois do período apareça como "concluído no período" só porque estava em desenvolvimento durante ele.

`filtrarPorPeriodo` retorna dois valores: os itens que passaram no filtro e a quantidade dos que ficaram de fora por ausência de data. Essa contagem é sempre exibida na interface, nunca ocultada. Em nenhuma circunstância um item sem data recebe uma data aproximada ou padrão: ele simplesmente fica fora do recorte enquanto o filtro estiver ativo.

---

## 10 Barra superior

| Elemento | Comportamento |
|---|---|
| Logos Saint-Gobain e GBS | decorativos |
| Texto de sincronização | exibe a hora da última geração, as fontes carregadas e o período ativo |
| Atalhos de período | ver seção 9 |
| Botão "Exportar PDF" | visível somente após a primeira geração; aciona `window.print()` |
| Botão "Atualizar bases" | retorna à tela de upload sem descartar os dados já carregados |

---

## 11 Navegação entre abas

A função `definirNav` alterna a classe ativa entre o item de menu selecionado e a seção de página correspondente, ocultando as demais. Ao entrar em uma aba, os números dos indicadores visíveis são reanimados do zero até o valor final, um efeito puramente visual, sem novo cálculo.

A aba RPA e Bots possui uma navegação secundária entre seis subabas, controlada pela função `definirSubAbaRPA` e restrita ao conteúdo dessa aba. Os contadores exibidos ao lado de cada item do menu principal são atualizados pela função `definirBadge` conforme cada aba é construída.

---

## 12 Aba Painel de Controle

Esta aba apresenta uma visão executiva que combina as quatro fontes de dados (Projetos, Melhorias, Analytics e Chamados RPA) em uma lista unificada de ações, produzida pela função `todasAcoes`. Cada ação carrega a fonte de origem, o status normalizado, a frente de negócio, o responsável, as datas relevantes e, no caso de chamados RPA, o indicador de vencimento. Chamados RPA só recebem uma frente quando a área do bot corresponde a uma das cinco áreas de negócio principais; áreas secundárias do inventário não entram nos gráficos "por frente" desta aba. A função `todasAcoesFiltradas` aplica o filtro global de período sobre essa lista combinada.

Quando há mais de uma frente presente nos dados, chips de filtro permitem restringir a visão a uma área específica, e essa seleção é guardada em `App.frenteGovernanca`. O filtro de área afeta os indicadores, o donut de status e o gráfico "Por responsável", mas não o gráfico "Por frente", que sempre mostra o panorama completo como referência de comparação.

A aba exibe cinco indicadores (total de ações, percentual concluído, em andamento, em backlog e "outros"), seguidos de um donut de status que agrupa Encerramento e Monitoramento em uma única fatia e reúne bloqueados, cancelados e itens em suporte externo sob "Impedimentos". O gráfico "Por responsável" soma apenas os membros fixos da equipe CoE, definidos na constante `COE_TEAM`; pessoas fora dessa lista não aparecem, ainda que constem como responsáveis na planilha. Um rodapé de diagnóstico mostra a contagem bruta de cada fonte, sem filtro de data, para auditoria rápida.

---

## 13 Aba Projetos

A aba apresenta indicadores de total, execução, fase final, atrasos e risco alto, seguidos de um donut de status e barras por frente ou área cliente.

O score de risco de cada projeto, calculado pela função `riscoProjeto(p)`, combina três fatores sem exigir nenhum campo manual na planilha:

| Fator | Pontuação |
|---|---|
| Atraso (dias corridos) | `min(70, 15 + dias × 1,2)` |
| Prazo em ≤ 15 dias | +18 |
| Prazo em ≤ 30 dias | +10 |
| Sem prazo definido | +14 |
| Bloqueado | +30 |
| Fase inicial (Diagnóstico) | +18 |
| Fase Planejamento | +14 |
| Fase Execução | +9 |
| Fase Encerramento | +4 |

O atraso é o fator de maior peso. Quando o prazo já passou, a pontuação soma até 70 pontos, crescendo com o número de dias de atraso; cerca de 40 dias de atraso já são suficientes para classificar o projeto como risco alto isoladamente. Quando o prazo ainda não venceu, a proximidade da data soma pontos adicionais, e a ausência de qualquer prazo definido também é penalizada, por representar falta de controle. A fase do projeto contribui com um peso decrescente conforme o projeto avança no fluxo (Diagnóstico e Planejamento pesam mais que Execução e Encerramento), e um projeto bloqueado recebe um acréscimo fixo.

Níveis: score ≥ 55 é risco alto; ≥ 30, médio; abaixo de 30, baixo. Projetos em monitoramento, concluídos ou cancelados têm score 0 automaticamente. Cada cálculo mantém também uma lista de motivos legíveis, exibida como texto auxiliar no indicador de risco.

A lista de projetos aceita busca por texto, filtros combináveis de atraso e risco alto, e seletores de responsável, status e frente. A ordenação padrão é por score de risco, com progresso como critério de desempate. Clicar em um projeto expande um painel com os campos preenchidos na planilha; campos vazios simplesmente não aparecem. O estado de expansão de cada projeto é mantido em `App.projetosAbertos` enquanto a página não é recarregada.

---

## 14 Aba Pipefy Melhorias

Os indicadores desta aba mostram o total de melhorias sem filtro, seguido de conclusão percentual, backlog, bloqueadas e fluxos distintos. Quando existem melhorias marcadas como concluídas sem data de conclusão preenchida, um aviso identifica essa situação como erro de preenchimento da planilha, não como falha do sistema.

O gráfico "Melhorias Concluídas × Backlog" aparece somente quando há ao menos três melhorias concluídas com data e dois meses históricos distintos. Ele traz três séries: concluídas por mês, que é uma contagem histórica real; backlog reconstruído, calculado como o backlog atual somado às melhorias concluídas após cada mês do histórico, uma aproximação que assume que nenhum item novo entrou no backlog depois daquele ponto; e uma projeção linear para os meses futuros, calculada como o backlog atual dividido pelo número de meses futuros exibidos. Uma linha vertical tracejada marca o mês corrente, separando histórico de projeção.

A tabela "Overview por categoria" cruza frentes de negócio com as colunas Melhorias, Backlog, Dev + Planejamento, Validação, Pipefy, Bloqueado, Concluídos e Cancelados. As colunas Dev + Planejamento e Validação representam a mesma classificação interna (`doing`), diferenciadas pelo texto original do status: registros cujo status contém "validação" ou "aguardando" vão para Validação; os demais, para Dev + Planejamento.

---

## 15 Registro manual de atividades

No final da aba Pipefy Melhorias há um card de Atividades, a única parte do sistema cujos dados não vêm de planilha. Ele reproduz uma tabela de acompanhamento manual (tema, atividade, observação e responsável) usada pela equipe em apresentações internas, cujos temas não correspondem diretamente a linhas da planilha Pipefy_Melhorias.

Os registros são gravados em `localStorage`, sob a chave `synapse.melhorias.atividades`, como um array de objetos com os campos `id`, `tema`, `atividade`, `observacao` e `responsavel`. Essa gravação sobrevive a recarregamentos de página e a novas gerações do dashboard com planilhas diferentes, mas fica restrita ao navegador e computador em que foi criada: não é sincronizada entre dispositivos e é removida se o usuário limpar os dados de navegação.

O botão de adicionar abre o modal em branco; o ícone de lápis em uma linha o abre preenchido para edição. O envio do formulário decide entre criar ou atualizar com base no identificador oculto do registro. A exclusão pede confirmação nativa do navegador antes de remover o item, de forma definitiva. O texto digitado nos campos passa por um escape de HTML antes de ser inserido na tabela, prevenindo que marcações digitadas pelo usuário sejam interpretadas como código.

---

## 16 Aba Analytics

Além dos indicadores de total, conclusão, andamento e não iniciadas, a aba apresenta um donut de status e barras por prioridade, frente e responsável. Quando não há filtro de período ativo, mas parte das atividades carece de data registrada, um aviso informa a proporção afetada.

O heatmap de prioridade por frente, produzido pela função `construirMapaCalor` (fisicamente definida no módulo da Governança, mas usada apenas aqui), cruza as prioridades de 1 a 4 com as frentes presentes em Analytics ou em Projetos, contando apenas atividades ainda em aberto. A intensidade da cor é proporcional ao valor máximo da matriz.

---

## 17 Aba RPA e Bots

O filtro de período desta seção usa a data de abertura do chamado, campo obrigatório no Pipefy e por isso presente em todos os registros.

A subaba Visão geral acrescenta um filtro local por fase do chamado, que atualiza apenas seus próprios indicadores e gráficos através da função `renderizarStatusRPA`. Ela reúne cinco indicadores, um gráfico de volume mensal em barras empilhadas, um donut de status por fase e uma distribuição de chamados por área, na qual áreas secundárias do inventário são agregadas sob "Outros".

A subaba Top bots lista, em barras horizontais, a contagem de chamados por processo. A subaba Tipos de problema cruza tipo de problema com fase e com área, usando o componente `barrasAgrupadas`, e apresenta dois donuts adicionais sobre reexecução e causa interna ou externa. A subaba Tempo de resolução calcula a média de dias por fase e o tempo médio por bot, considerando apenas bots com três ou mais chamados para evitar distorção estatística por amostra pequena. A subaba Chamados oferece busca textual sobre a lista completa, limitada a mil linhas exibidas por vez.

A subaba Inventário de bots reinterpreta o filtro de período: em vez de filtrar por data de ação, filtra por ano de entrada em produção (`AnoPRD`). Ela apresenta indicadores de composição do inventário, distribuição por área e perímetro, classificação por criticidade e frequência de execução, e uma tabela de cruzamento que aponta os dez bots em produção com mais chamados de manutenção associados, candidatos naturais a refatoração.

---

## 18 Análise automática

O botão "Gerar análise", presente em todas as abas, não envolve inteligência artificial nem modelo de linguagem. Ele aciona um conjunto de regras determinísticas, escritas manualmente, que transformam os números do recorte atual em frases descritivas, 100% no navegador. Cada observação recebe uma classificação (positiva, negativa, alerta ou neutra) que define a cor e o ícone exibidos.

| Aba | Critérios avaliados |
|---|---|
| Governança | taxa geral de conclusão; fonte com mais backlog aberto; concentração de carga por responsável da equipe CoE; percentual de ações canceladas |
| Projetos | contagem geral; lista nominal de atrasados por dias de atraso; projeto mais crítico por score de risco; frente com mais projetos; percentual não iniciado |
| Pipefy Melhorias | taxa de conclusão; complexidade predominante; frente com mais demanda; contagem de bloqueadas |
| Analytics | taxa de conclusão; atividades de prioridade 1 em aberto; frente com mais demanda; atividades sem data |
| RPA | concentração nos três processos com mais manutenções; taxa de chamados vencidos; problema mais frequente; tendência de volume mês a mês; área com mais chamados |
| Inventário de Bots | composição geral; área com mais bots em produção; bots críticos em produção; bot com mais chamados associados |

Os limiares numéricos usados nessas regras (por exemplo, mais de 30% de concentração de carga em um responsável, mais de 40% dos chamados concentrados em 3 bots, ou variação mensal de volume igual ou superior a 15%) foram definidos pela equipe para separar ruído estatístico normal de sinais que merecem atenção. Eles não resultam de cálculo estatístico automático.

---

## 19 Gráficos

Os gráficos de linha, donut e barras empilhadas são produzidos pelo Chart.js. Cada função de gráfico devolve um trecho de HTML contendo um elemento `<canvas>` com identificador único e registra a configuração correspondente em uma fila interna, já que o elemento ainda não existe no DOM no momento da chamada. Após a inserção do HTML na página, a função `renderizarGraficosPendentes` percorre essa fila e instancia cada gráfico. Instâncias anteriores com o mesmo identificador são destruídas antes da recriação, evitando o erro de canvas já em uso quando uma aba é reconstruída (por exemplo, ao alterar o filtro de período). No início de cada geração de dashboard, todas as instâncias ativas são destruídas de uma só vez.

Dois componentes visuais não usam Chart.js: as barras agrupadas da subaba Tipos de problema e o heatmap da aba Analytics são montados diretamente em HTML e CSS, para permitir controle total do layout.

---

## 20 Exportação para PDF

O botão "Exportar PDF" aciona `window.print()`, abrindo o diálogo de impressão nativo do navegador. Não há geração de PDF customizada nem envio de dados a um servidor. Uma seção de impressão na folha de estilos oculta a navegação, os botões de ação, o filtro de período e o fundo animado, mostrando apenas o conteúdo da aba ativa no momento. Para exportar outra aba, é necessário navegar até ela antes de acionar a exportação.

---

## 21 Fundo animado

O fundo de partículas atrás do conteúdo é puramente decorativo. Um elemento `<canvas>` fixo desenha aproximadamente 95 pontos em movimento lento, conectados por linhas quando próximos o suficiente, com leve repulsão em relação ao cursor do mouse. A animação é recalculada a cada quadro via `requestAnimationFrame` e se ajusta automaticamente ao redimensionamento da janela.

---

## 22 Identidade visual

| Variável CSS | Cor | Uso |
|---|---|---|
| `--brand` | `#0F5299` | Topbar, cor principal de marca |
| `--accent` | `#0195D6` | Destaques interativos, botões |
| `--teal` | `#4DB1B3` | Acento secundário |
| `--err` | `#C5284C` | Alertas críticos |
| `--warn` | `#9A3412` | Avisos, prazos em risco |

Todas as variáveis estão em `styles/main.css` e podem ser ajustadas em um único lugar.

Recursos de experiência da interface:

- Fundo interativo: campo de partículas conectadas que reagem ao cursor do mouse (canvas fixo, `z-index: -1`).
- Animação de KPIs: os números contam de 0 ao valor final ao carregar cada aba (cubic ease-out, 850 ms).
- Exportar PDF: botão na topbar, visível após gerar o dashboard. Abre o diálogo de impressão do navegador com layout limpo (só a aba ativa, sem botões ou filtros).

---

## 23 Estrutura de arquivos

```
SYNAPSE - GBS GOVERNANCA/
│
├── index.html              # Estrutura HTML + fundo interativo de partículas
├── app.js                  # Artefato de build, gerado pelo Vercel a cada deploy
│                           #   (não existe localmente, não versionado)
│
├── styles/
│   └── main.css            # Estilos (identidade Saint-Gobain/GBS + @media print)
│
├── src/                    # Código-fonte real: toda alteração é feita aqui
│   ├── main.js             # Entry point: orquestra parsers, views e navegação
│   ├── state.js            # Estado global compartilhado (App.dadosGovernanca,
│   │                       #   App.chamadosRPA, App.bots…)
│   ├── constants.js        # Equipe CoE, status, paleta de cores, HOJE
│   ├── charts.js           # Componentes: graficoRosca, barrasHorizontais,
│   │                       #   graficoLinha, mapaCalor
│   ├── analysis.js         # Análise automática por aba (insights programáticos)
│   ├── nav.js              # Navegação entre abas
│   ├── upload.js           # Upload de arquivos (drag-and-drop + input file)
│   ├── filters.js          # Filtro global de período
│   ├── data/
│   │   └── actions.js      # Agregação de ações entre as 4 fontes (todasAcoes)
│   ├── parsers/
│   │   ├── gov.js          # Parser da Base Governança (Melhorias, Projetos,
│   │   │                   #   Analytics, Inventário)
│   │   └── rpa.js          # Parser dos Chamados RPA + enriquecimento de área
│   ├── views/
│   │   ├── gov.js          # Painel de Controle (visão executiva)
│   │   ├── proj.js         # Projetos (lista filtrável + score de risco)
│   │   ├── mel.js          # Pipefy Melhorias
│   │   ├── mel-activities.js # Registro manual de atividades (localStorage)
│   │   ├── ana.js          # Analytics
│   │   ├── rpa.js          # RPA & Bots (chamados)
│   │   └── bots.js         # Inventário de Bots
│   └── utils/
│       ├── date.js         # Conversão, formatação e filtro de datas
│       ├── classify.js     # Normalização de status + score de risco
│       └── helpers.js      # buscarAba, obterValorColuna, contar,
│                           #   calcularPercentual…
│
├── assets/                 # Logos (Saint-Gobain, GBS, SYNAPSE)
├── package.json            # Script "build": esbuild empacota src/main.js → app.js
├── vercel.json             # Roda o build (npm install + esbuild) a cada deploy
└── README.md               # Este arquivo
```

---

## 24 Privacidade e segurança

Nenhum dado das planilhas carregadas sai do navegador do usuário. Não há backend, API própria ou envio de arquivos a qualquer servidor, e todo o processamento ocorre localmente, em JavaScript. As conexões de rede feitas pela página servem exclusivamente para carregar bibliotecas de terceiros, ícones e fontes tipográficas; nenhuma delas recebe o conteúdo das planilhas.

A única informação que persiste entre sessões é o registro de atividades descrito na seção 15, mantido exclusivamente em `localStorage` local. Recarregar a página descarta o restante do estado (workbooks, dados normalizados e filtros), exigindo novo carregamento das planilhas.

---

## 25 Referência de funções

O quadro abaixo relaciona as principais funções do código-fonte e o papel de cada uma no sistema, agrupadas por área.

| Função | Papel |
|---|---|
| `lerArquivo` | lê o arquivo enviado como `ArrayBuffer` e o converte em workbook via SheetJS |
| `mostrarSucesso` | confirma o upload e verifica as abas esperadas do arquivo |
| `atualizarBarra` | controla o botão "Gerar dashboard" conforme os arquivos carregados |
| `tratarArrastarSobreDropzone` / `tratarSairDropzone` / `tratarSoltarDropzone` / `tratarMudancaArquivo` | eventos de arraste e seleção das áreas de upload |
| `interpretarGov` | lê as abas Pipefy_Melhorias, Projetos e Analytics da Base Governança |
| `interpretarInventario` | lê a aba Inventario_RPA |
| `interpretarRPA` | lê o relatório de Chamados RPA, com detecção automática da aba |
| `enriquecerRPAComArea` / `areaPorPalavraChave` | atribuem a área de negócio de cada chamado (seção 7.7) |
| `buscarAba` / `obterValorColuna` | localizam abas e colunas com tolerância a variações de nome |
| `classeStatus` | converte o texto de status da planilha no código interno normalizado |
| `classeStatusMelhoria` | variante das Melhorias Pipefy, na qual "Planejamento" conta como `doing` |
| `faseProjeto` / `projetoAtrasado` | identificam a fase do projeto e o vencimento do prazo |
| `riscoProjeto` | calcula o score de risco do projeto (seção 13) |
| `definirPeriodoRapido` / `aplicarFiltroData` / `limparFiltroData` | acionam o filtro global de período |
| `dataNoIntervalo` / `ativoNoIntervalo` / `filtrarPorPeriodo` | regras de recorte por data (seção 9) |
| `renderizarTudo` | reconstrói todas as abas após mudança de filtro |
| `atualizarBadgeData` | atualiza o indicador do período ativo |
| `gerarDashboard` | orquestra parsers, filtros e a construção de todas as abas |
| `construirGovernanca` / `construirProjetos` / `construirMelhorias` / `construirAnalytics` / `construirChamadosRPA` / `construirBots` | constroem as abas principais do dashboard |
| `construirAbaTopBots` / `construirAbaProblemas` / `construirAbaTempo` / `construirAbaLista` | constroem as subabas de Chamados RPA |
| `construirCruzamentoBots` | tabela de cruzamento inventário × chamados |
| `construirMapaCalor` | heatmap de prioridade por frente (aba Analytics) |
| `todasAcoes` / `todasAcoesFiltradas` | lista unificada das quatro fontes, sem e com filtro de período |
| `renderizarListaProjetos` / `alternarChipProjeto` / `alternarProjeto` / `detalhesProjeto` | lista, filtros e painel de detalhes da aba Projetos |
| `renderizarStatusRPA` / `renderizarListaRPA` / `rotuloComArea` | visão geral e lista de chamados RPA |
| `renderizarListaBots` / `alternarBot` / `detalhesBot` | lista e painel de detalhes do inventário de bots |
| `graficoRosca` / `barrasHorizontais` / `barrasAgrupadas` / `graficoLinha` / `graficoBarrasVerticais` / `mapaCalor` | componentes visuais de gráfico |
| `registrarGrafico` / `renderizarGraficosPendentes` / `reiniciarGraficos` / `resolverCor` | fila de renderização e ciclo de vida das instâncias Chart.js |
| `definirNav` / `definirSubAbaRPA` / `definirBadge` | troca de abas, subabas RPA e contadores do menu |
| `analisarGovernanca`, `analisarProjetos` etc. | regras determinísticas do botão "Gerar análise" (seção 18) |
| `paraData` / `paraChaveAnoMes` / `paraRotuloAnoMes` / `paraDataIso` / `diasEntre` | conversão e formatação de datas |
| `contar` / `calcularPercentual` / `mediaDoCampo` / `contarPorStatus` / `contagemOrdenada` | agregações numéricas |
| `normalizarNomeBot` / `nomesBatem` / `chamadosPorBot` | comparação aproximada entre nome de bot e processo do chamado |
| `nomePadraoCoe` / `ehIntegranteEquipePipefy` | padronização e verificação de membros da equipe CoE |

---

## Responsável técnico

CoE Projetos e Automações — GBS Saint-Gobain Brasil