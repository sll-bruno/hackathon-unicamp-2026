# Home do advogado: hero de métricas + lista expansível

## Contexto

"Meus processos" (`src/web/src/pages/CasesList`) hoje é só a tabela de casos com um
filtro de pendências em chips no topo. Ao longo desta sessão tentamos três formas
de tornar essa tela mais informativa para o advogado (stat cards, feed de
pendências, coluna de urgência na tabela) e todas foram revertidas: ou escondiam a
lista, ou duplicavam informação que o Status já mostrava, ou inventavam conceitos
(prazo processual) que não existem em `docs/architecture_engine.md`.

Este spec cobre a quarta tentativa: uma seção de métricas de portfólio (KPIs) e
pendências de ação, organizadas como um "hero" no topo da página, sem esconder a
lista de processos.

Escopo desta pessoa (Pessoa D, per `docs/DIVISAO_TRABALHO.md`): lista de processos,
cadastro, histórico, dashboard. **Fora de escopo aqui:** o dashboard de
aderência/efetividade cross-escritório do banco (rota `/dashboard`, público
diferente — gestão do banco, não o advogado). Este spec trata só da home do
advogado (`/processos`).

## Objetivo

Dar ao advogado, ao abrir a home, uma leitura rápida de:
1. o tamanho e a saúde da sua carteira (KPIs), e
2. o que precisa da atenção dele agora (hot topics),

sem sacrificar o acesso imediato à lista completa de processos.

## Layout

A página passa a ter duas metades:

**Topo (hero, ocupa aproximadamente a metade da viewport):**
- Saudação centralizada: "Bem-vindo, {nome do advogado}". Nome fictício para a
  demo: **Clara Porter** (hardcoded no componente por enquanto — não há
  autenticação real neste momento do projeto).
- Abaixo, uma única linha centralizada: 4 KPI cards, um divisor vertical, e os 3
  hot-topics em formato de lista (não cards).

**Baixo (lista, começa logo após o hero):**
- Cabeçalho "Meus processos" + botão "Novo processo" (como já existe).
- A tabela atual (Processo/UF/Tese/Valor/Status/Recomendação), com os filtros de
  busca/status/recomendação como já existem hoje.
- A tabela não renderiza todas as linhas de uma vez: mostra as 5 primeiras
  (ordenadas pela mesma regra de urgência já implementada) e um rodapé "Mostrar
  mais N processos" que expande o restante. Sem paginação de verdade — é
  client-side sobre os mesmos dados já carregados via `useCases()`. Ao aplicar
  um filtro (busca, status, hot-topic), a lista renderiza colapsada de novo.

## Componentes novos

### `WelcomeBanner`
Só o texto de saudação centralizado. Recebe o nome do advogado como prop (hoje,
uma constante `"Clara Porter"` exportada de algum lugar central — não vale a pena
um contexto de auth para isso agora).

### `KpiRow`
4 caixas (reaproveitando visualmente o estilo de card que `StatCard` tinha, mas
sem interatividade — são leitura, não filtro):
- **Valor total em aberto** — `formatBRL(soma de claim_value onde status != ENCERRADO)`
- **Casos novos no mês** — contagem de casos com `created_at` nos últimos 30 dias
- **Aderência à recomendação** — `% aceitos / (aceitos + divergiu)` (ver cálculo abaixo)
- **Eficácia ao seguir a recomendação** — `% de desfechos favoráveis entre os casos
  encerrados que seguiram a recomendação` (ver cálculo abaixo; depende de campo
  novo, ver "Modelo de dados")

### `HotTopics`
Lista vertical de 3 linhas (não cards): bolinha colorida + rótulo + número grande
alinhado à direita. Clicável — cada linha continua funcionando como os chips
antigos (filtra a tabela abaixo, toggle liga/desliga). Cores da bolinha seguem o
tom já usado em `Badges.tsx`/`lib/pendencies.ts`:
- **Erro de leitura** → `--status-negative` (vermelho)
- **Revisar recomendação** → `--accent` (laranja)
- **Falta desfecho** → `--text-muted` (cinza — pendência de registro, não uma urgência)

## Cálculo das métricas — o que é real e o que é mockado

Baseado em `docs/ARCHITECTURE.md` §7 (motor de aderência) e §8 (motor de
efetividade), para não inventar semântica nova:

| Métrica | Fórmula | Fonte de dado |
|---|---|---|
| Valor em aberto | soma direta de `claim_value` | 100% real, já existe |
| Casos novos no mês | contagem por `created_at` | precisa de campo novo `created_at` (ISO), real e simples de justificar — todo registro tem data de criação |
| Aderência | `count(followed_recommendation = true) / count(followed_recommendation != null)` | precisa de campo novo `followed_recommendation: boolean \| null`, mas **não é um conceito novo** — é exatamente `lawyer_decisions.accepted` (§7), só exposto no item da lista em vez de numa tabela de eventos à parte |
| Eficácia | dentre os casos `ENCERRADO` com `followed_recommendation = true`, quantos têm `outcome` favorável | precisa de campo novo `outcome: 'FAVORAVEL' \| 'PARCIAL' \| 'DESFAVORAVEL'` em casos `ENCERRADO`, inspirado no enum real `case_outcomes.outcome` do doc (`procedencia`/`acordo` → favorável, `improcedencia` → desfavorável, `parcial` → parcial) |

Nota importante descoberta ao revisar o spec: `status` sozinho **não basta** para
aderência, porque o próprio state machine (§6) faz `PROPOSTA_ACEITA` e `DIVERGIU`
convergirem depois para os mesmos estados (`AGUARDANDO_ENCERRAMENTO`/`ENCERRADO`)
— uma vez que o caso avança, o status atual não diz mais se o advogado aceitou ou
divergiu naquele momento. Por isso `lawyer_decisions.accepted` precisa mesmo virar
um campo persistente (`followed_recommendation`) no item do caso, e não algo
derivado do status corrente.

Todos os números continuam com o selo "Dados simulados" já existente na navbar —
nada aqui é dado real da engine.

## Modelo de dados — mudanças

`types/case.ts`:
- `CaseListItem` ganha `created_at: string` (ISO datetime).
- `CaseListItem` ganha `followed_recommendation: boolean | null` — espelha
  `lawyer_decisions.accepted` (§7); `null` enquanto o caso ainda não passou por
  uma decisão (ex.: `RASCUNHO`, `EM_ANALISE`, `AGUARDANDO_DECISAO`), preenchido a
  partir do momento em que o status vira `PROPOSTA_ACEITA`/`DIVERGIU` e mantido
  daí em diante mesmo que o status avance.
- `CaseListItem` ganha `outcome: CaseOutcome | null`, só preenchido quando
  `status === 'ENCERRADO'`. `type CaseOutcome = 'FAVORAVEL' | 'PARCIAL' | 'DESFAVORAVEL'`.
- `CasesSummary` ganha `open_value_sum: number`, `new_this_month: number`,
  `adherence_percent: number | null`, `effectiveness_percent: number | null`
  (`null` quando não há casos suficientes para calcular — ex.: nenhum caso
  encerrado ainda).

`api/mocks/cases.ts`: adicionar `created_at` (todas as linhas), `followed_recommendation`
(a partir de `AGUARDANDO_DECISAO` em diante) e `outcome` (só nos 2 casos já
`ENCERRADO`) às linhas mockadas.

`api/cases.ts`: `summarize()` ganha os 4 cálculos novos.

## Fora de escopo (não fazer agora)

- Autenticação real / nome do advogado dinâmico.
- Dashboard de aderência/efetividade do banco (`/dashboard`) — público e escopo
  diferentes, fica para depois.
- Paginação real no backend — o "mostrar mais" é só client-side.
- Filtro dos KPIs por período (mês atual vs. anterior) — fica para uma iteração
  futura se fizer falta.

## Verificação

- `npm run build` (tsc + vite) sem erros.
- Visual no preview: hero centralizado com saudação + 4 KPIs + hot-topics em
  lista de bolinhas; lista de processos abaixo mostrando 5 linhas + "mostrar
  mais"; clicar num hot-topic filtra a tabela e a colapsa de volta para 5 linhas;
  clicar em "mostrar mais" revela o resto.
- Tema claro (`data-theme="light"`) continua legível (cores vêm dos tokens
  semânticos existentes, nenhuma cor nova hardcoded fora de `tokens.css`).
