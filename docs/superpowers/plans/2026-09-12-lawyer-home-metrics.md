# Lawyer Home Metrics (Hero + Hot Topics + Expandable List) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a centered "hero" section (greeting + 4 KPI cards + 3 hot-topic items) above the existing "Meus processos" table, and make the table itself show only the first 5 rows with a "mostrar mais" expansion — without hiding the list, per `docs/superpowers/specs/2026-09-12-lawyer-home-metrics-design.md`.

**Architecture:** Three new small presentational components (`WelcomeBanner`, `KpiRow`, `HotTopics`) consumed by `pages/CasesList/CasesList.tsx`. Two new pure data fields (`created_at`, `followed_recommendation`, `outcome`) added to the mock case model, and four new aggregate fields added to `CasesSummary`, computed by new pure functions in `lib/metrics.ts`.

**Tech Stack:** React 19 + TypeScript (strict) + Vite 6, CSS Modules, TanStack Query v5. No test runner exists in this project (`src/web/package.json` has no vitest/jest) — do not add one. Verification throughout this plan is: (a) `npm run build` (`tsc --noEmit && vite build`) as the type-correctness gate, used exactly like a test runner — a step that "expects FAIL" means expect a TypeScript compile error; and (b) manual visual verification of the running dev server via the Browser pane tools (`mcp__Claude_Browser__navigate`, `computer` screenshot, `read_page`), which is how every prior feature in this codebase was verified (see `git log` on `src/web`).

## Global Constraints

- Dark theme is the default and only theme that must look correct; never hardcode a color — use only the CSS custom properties already defined in `src/web/src/styles/tokens.css` (`--surface-*`, `--text-*`, `--stroke-*`, `--accent`, `--status-*`, `--space-*`, `--radius-*`, `--text-12`…`--text-48`, `--font-heading`, `--font-body`).
- Mock-data-first: this project has no backend yet. All new fields go into `src/web/src/api/mocks/cases.ts`; real values are computed by pure functions that will later run the same way against real API data.
- Do not touch `src/web/src/pages/Workspace` or route `/processos/:id` (owned by "Pessoa E") or route `/dashboard` (bank-level dashboard, separate feature, different audience).
- Every git commit message ends with: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- No dead code: if a task's change makes an existing CSS class or export unused, delete it in that same task.

---

## Task 1: Data model — new case fields and KPI summary fields

**Files:**
- Modify: `src/web/src/types/case.ts`
- Modify: `src/web/src/api/mocks/cases.ts`
- Create: `src/web/src/lib/metrics.ts`
- Modify: `src/web/src/api/cases.ts`

**Interfaces:**
- Produces: `CaseOutcome` type, `CaseListItem.created_at: string`, `CaseListItem.followed_recommendation: boolean | null`, `CaseListItem.outcome: CaseOutcome | null`, `CasesSummary.open_value_sum: number`, `CasesSummary.new_this_month: number`, `CasesSummary.adherence_percent: number | null`, `CasesSummary.effectiveness_percent: number | null`.
- Produces (from `lib/metrics.ts`): `sumOpenValue(cases: CaseListItem[]): number`, `countNewThisMonth(cases: CaseListItem[], now?: Date): number`, `adherencePercent(cases: CaseListItem[]): number | null`, `effectivenessPercent(cases: CaseListItem[]): number | null`.

- [ ] **Step 1: Add the new fields to the case types**

Edit `src/web/src/types/case.ts`. Add `CaseOutcome` after `CaseAlert`, and add three fields to `CaseListItem`, and four fields to `CasesSummary`:

```ts
// Estados do processo (docs/ARCHITECTURE.md §4).
export type CaseStatus =
  | 'RASCUNHO'
  | 'DOCUMENTOS_ENVIADOS'
  | 'EM_ANALISE'
  | 'AGUARDANDO_DECISAO'
  | 'PROPOSTA_ACEITA'
  | 'DIVERGIU'
  | 'EM_NEGOCIACAO'
  | 'AGUARDANDO_ENCERRAMENTO'
  | 'ENCERRADO';

export type Thesis = 'GOLPE' | 'GENERICO';

// Ação recomendada pela engine (contracts/pipeline.py).
export type RecommendedAction = 'ACORDO' | 'DEFESA';

// Resumo da recomendação exibido fora da área do processo.
// Campos seguem docs/architecture_engine.md §5.
export interface RecommendationSummary {
  action: RecommendedAction;
  confidence_percent: number | null; // 0–100; null quando não calculável
  suggested_range: [number, number] | null; // só em ACORDO
  economic_ceiling: number | null;
  defense_cost_central: number;
  policy_version: string;
}

// Pendência que trava a análise e exige reenvio do advogado (docs/ARCHITECTURE.md §4/§7,
// erros de analysis_jobs como ARQUIVO_ILEGIVEL).
export interface CaseAlert {
  code: 'DOCUMENTO_ILEGIVEL' | 'FALHA_EXTRACAO';
  message: string;
}

// Resultado final do caso, gravado em case_outcomes ao encerrar (docs/ARCHITECTURE.md §8).
export type CaseOutcome = 'FAVORAVEL' | 'PARCIAL' | 'DESFAVORAVEL';

export interface CaseListItem {
  id: string;
  cnj: string;
  plaintiff_name: string; // nome da parte autora — identificador amigável do caso
  uf: string;
  thesis: Thesis;
  claim_value: number;
  status: CaseStatus;
  office: string; // escritório responsável; não exibido nesta lista (um advogado só vê os próprios casos)
  created_at: string; // ISO datetime — data de cadastro do caso
  updated_at: string; // ISO datetime
  recommendation: RecommendationSummary | null;
  alert: CaseAlert | null;
  // Espelha lawyer_decisions.accepted (docs/ARCHITECTURE.md §7). null até o
  // advogado decidir; preenchido a partir de PROPOSTA_ACEITA/DIVERGIU e mantido
  // mesmo depois que o status avança (o status sozinho não distingue mais os dois
  // casos uma vez que o caso chega em AGUARDANDO_ENCERRAMENTO/ENCERRADO).
  followed_recommendation: boolean | null;
  outcome: CaseOutcome | null; // só preenchido quando status === 'ENCERRADO'
}

export interface CasesSummary {
  open: number;
  awaiting_decision: number; // precisa revisar a recomendação (aceitar/divergir)
  pending_outcome: number; // decisão tomada, falta registrar o desfecho
  document_errors: number; // documento com erro de leitura, precisa reenvio
  in_analysis: number;
  open_value_sum: number; // soma de claim_value dos casos não encerrados
  new_this_month: number; // casos com created_at nos últimos 30 dias
  adherence_percent: number | null; // % de decisões que seguiram a recomendação; null sem decisões
  effectiveness_percent: number | null; // % de desfechos favoráveis entre os que seguiram a recomendação; null sem casos encerrados elegíveis
}
```

- [ ] **Step 2: Confirm this alone breaks the build (expected)**

Run: `cd src/web && npm run build`

Expected: FAIL. `tsc` reports that `src/api/mocks/cases.ts`'s object literals are missing `created_at`, `followed_recommendation`, and `outcome`, and that `src/api/cases.ts`'s `summarize()` return value is missing `open_value_sum`, `new_this_month`, `adherence_percent`, `effectiveness_percent`. This confirms the type change is wired to real call sites (not a no-op edit).

- [ ] **Step 3: Add the new fields to the mock data**

Edit `src/web/src/api/mocks/cases.ts` in full:

```ts
// DADOS SIMULADOS para desenvolvimento do front enquanto a API não existe.
// Valores e confianças são ilustrativos — não são resultados da engine.
// Todos os casos pertencem ao mesmo escritório/advogado logado (visão do advogado
// não mostra outros escritórios — isso é assunto do Dashboard do banco).
import type { CaseAlert, CaseListItem, CaseOutcome, CaseStatus, RecommendationSummary } from '../../types/case';

const DAY_MS = 86_400_000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY_MS).toISOString();

const MY_OFFICE = 'Silva & Associados';

const acordo = (confidence: number | null, range: [number, number], ceiling: number, defense: number): RecommendationSummary => ({
  action: 'ACORDO',
  confidence_percent: confidence,
  suggested_range: range,
  economic_ceiling: ceiling,
  defense_cost_central: defense,
  policy_version: 'v1',
});

const defesa = (confidence: number | null, defense: number): RecommendationSummary => ({
  action: 'DEFESA',
  confidence_percent: confidence,
  suggested_range: null,
  economic_ceiling: null,
  defense_cost_central: defense,
  policy_version: 'v1',
});

type Row = [
  cnj: string,
  plaintiff: string,
  uf: string,
  thesis: 'GOLPE' | 'GENERICO',
  claim: number,
  status: CaseStatus,
  createdDaysAgo: number,
  updatedDaysAgo: number,
  rec: RecommendationSummary | null,
  followedRecommendation: boolean | null,
  outcome?: CaseOutcome,
  alert?: CaseAlert,
];

const rows: Row[] = [
  // CNJs dos dois casos de exemplo em data/
  ['0801234-56.2024.8.10.0001', 'Maria de Fátima Souza', 'MA', 'GOLPE', 15000, 'AGUARDANDO_DECISAO', 12, 0, acordo(75, [4300, 5200], 5600, 6100), null],
  ['0654321-09.2024.8.04.0001', 'João Carlos Pereira', 'AM', 'GOLPE', 22000, 'EM_ANALISE', 40, 0, null, null],
  ['0712345-11.2024.8.26.0100', 'Ana Beatriz Lima', 'SP', 'GENERICO', 8000, 'RASCUNHO', 4, 1, null, null],
  ['0723456-22.2024.8.13.0024', 'Carlos Eduardo Santos', 'MG', 'GOLPE', 31000, 'EM_NEGOCIACAO', 45, 2, acordo(68, [7800, 9400], 10200, 12900), true],
  ['0734567-33.2024.8.05.0001', 'Francisca das Chagas Oliveira', 'BA', 'GENERICO', 12500, 'PROPOSTA_ACEITA', 35, 0.5, defesa(82, 3100), true],
  ['0745678-44.2024.8.17.0001', 'Pedro Henrique Costa', 'PE', 'GOLPE', 18000, 'DIVERGIU', 60, 3, acordo(null, [5100, 6300], 7000, 7400), false],
  [
    '0756789-55.2024.8.19.0001',
    'Raimunda Ferreira Alves',
    'RJ',
    'GOLPE',
    9500,
    'DOCUMENTOS_ENVIADOS',
    9,
    0.3,
    null,
    null,
    undefined,
    { code: 'DOCUMENTO_ILEGIVEL', message: 'Extrato bancário com páginas ilegíveis — reenviar' },
  ],
  ['0767890-66.2024.8.10.0001', 'Antônio Marcos Ribeiro', 'MA', 'GENERICO', 6700, 'AGUARDANDO_ENCERRAMENTO', 70, 6, defesa(71, 2400), true],
  ['0778901-77.2024.8.04.0001', 'Luzia Aparecida Rocha', 'AM', 'GOLPE', 27000, 'AGUARDANDO_DECISAO', 22, 1.5, defesa(58, 8900), null],
  ['0789012-88.2024.8.26.0100', 'José Roberto Almeida', 'SP', 'GOLPE', 14200, 'ENCERRADO', 120, 12, acordo(79, [3900, 4700], 5100, 5800), true, 'FAVORAVEL'],
  ['0790123-99.2024.8.13.0024', 'Sebastiana Gomes Dias', 'MG', 'GENERICO', 11000, 'AGUARDANDO_DECISAO', 28, 0.8, acordo(64, [2900, 3600], 4000, 4500), null],
  ['0701234-10.2024.8.05.0001', 'Francisco das Neves Barbosa', 'BA', 'GOLPE', 19800, 'ENCERRADO', 150, 20, defesa(88, 6200), true, 'PARCIAL'],
];

export const mockCases: CaseListItem[] = rows.map(
  ([cnj, plaintiff, uf, thesis, claim, status, createdDaysAgo, updatedDaysAgo, rec, followedRecommendation, outcome, alert], i) => ({
    id: `mock-${i + 1}`,
    cnj,
    plaintiff_name: plaintiff,
    uf,
    thesis,
    claim_value: claim,
    status,
    office: MY_OFFICE,
    created_at: daysAgo(createdDaysAgo),
    updated_at: daysAgo(updatedDaysAgo),
    recommendation: rec,
    followed_recommendation: followedRecommendation,
    outcome: outcome ?? null,
    alert: alert ?? null,
  }),
);
```

- [ ] **Step 4: Confirm the build still fails, but only on the summary**

Run: `cd src/web && npm run build`

Expected: FAIL. The error about `mockCases` is gone; the only remaining error is that `summarize()` in `src/api/cases.ts` returns an object missing `open_value_sum`, `new_this_month`, `adherence_percent`, `effectiveness_percent`.

- [ ] **Step 5: Write the pure metric functions**

Create `src/web/src/lib/metrics.ts`:

```ts
import type { CaseListItem } from '../types/case';

const DAY_MS = 86_400_000;
const NEW_CASE_WINDOW_DAYS = 30;

// Soma do valor da causa dos processos ainda não encerrados.
export function sumOpenValue(cases: CaseListItem[]): number {
  return cases.filter((c) => c.status !== 'ENCERRADO').reduce((sum, c) => sum + c.claim_value, 0);
}

// Quantos processos foram cadastrados nos últimos 30 dias, de qualquer status.
export function countNewThisMonth(cases: CaseListItem[], now = new Date()): number {
  const cutoff = now.getTime() - NEW_CASE_WINDOW_DAYS * DAY_MS;
  return cases.filter((c) => new Date(c.created_at).getTime() >= cutoff).length;
}

// docs/ARCHITECTURE.md §7: aderência = aceitos / (aceitos + divergiu), via
// followed_recommendation (espelha lawyer_decisions.accepted). null sem decisões.
export function adherencePercent(cases: CaseListItem[]): number | null {
  const decided = cases.filter((c) => c.followed_recommendation !== null);
  if (decided.length === 0) return null;
  const followed = decided.filter((c) => c.followed_recommendation === true).length;
  return (followed / decided.length) * 100;
}

// docs/ARCHITECTURE.md §8: efetividade = desfechos favoráveis entre os casos
// encerrados que seguiram a recomendação. null sem casos elegíveis.
export function effectivenessPercent(cases: CaseListItem[]): number | null {
  const followedAndClosed = cases.filter((c) => c.status === 'ENCERRADO' && c.followed_recommendation === true);
  if (followedAndClosed.length === 0) return null;
  const favorable = followedAndClosed.filter((c) => c.outcome === 'FAVORAVEL').length;
  return (favorable / followedAndClosed.length) * 100;
}
```

- [ ] **Step 6: Wire the new functions into `summarize()`**

In `src/web/src/api/cases.ts`, add the import and extend the return object:

```ts
import { useQuery } from '@tanstack/react-query';
import { adherencePercent, countNewThisMonth, effectivenessPercent, sumOpenValue } from '../lib/metrics';
import { toDisplayStatus } from '../lib/status';
import type { CaseListItem, CasesSummary } from '../types/case';
import { USE_MOCKS, apiGet, simulateLatency } from './client';
import { mockCases } from './mocks/cases';

const isOpen = (c: CaseListItem) => c.status !== 'ENCERRADO';

function summarize(cases: CaseListItem[]): CasesSummary {
  const open = cases.filter(isOpen);
  return {
    open: open.length,
    awaiting_decision: open.filter((c) => c.status === 'AGUARDANDO_DECISAO').length,
    pending_outcome: open.filter((c) => toDisplayStatus(c.status) === 'AGUARDANDO_ENCERRAMENTO').length,
    document_errors: open.filter((c) => c.alert !== null).length,
    in_analysis: open.filter((c) => c.status === 'EM_ANALISE').length,
    open_value_sum: sumOpenValue(cases),
    new_this_month: countNewThisMonth(cases),
    adherence_percent: adherencePercent(cases),
    effectiveness_percent: effectivenessPercent(cases),
  };
}

// GET /api/cases
export const useCases = () =>
  useQuery({
    queryKey: ['cases'],
    queryFn: () => (USE_MOCKS ? simulateLatency(mockCases) : apiGet<CaseListItem[]>('/cases')),
  });

// GET /api/cases/summary
export const useCasesSummary = () =>
  useQuery({
    queryKey: ['cases', 'summary'],
    queryFn: () => (USE_MOCKS ? simulateLatency(summarize(mockCases)) : apiGet<CasesSummary>('/cases/summary')),
  });
```

- [ ] **Step 7: Confirm the build passes**

Run: `cd src/web && npm run build`

Expected: PASS (`tsc --noEmit && vite build` completes with no errors, ends in `✓ built in ...`).

- [ ] **Step 8: Sanity-check the arithmetic against the mock data by hand**

These are the values Task 5's browser verification will check against, computed from the rows in Step 3:
- `open_value_sum` = sum of `claim_value` for the 10 non-`ENCERRADO` rows = 15000+22000+8000+31000+12500+18000+9500+6700+27000+11000 = **160700** (displays as `formatBRL(160700)` = "R$ 160.700").
- `new_this_month` = rows with `createdDaysAgo <= 30`: Maria (12), Ana (4), Raimunda (9), Luzia (22), Sebastiana (28) = **5**.
- `adherence_percent`: `followed_recommendation` is non-null for Carlos(true), Francisca(true), Pedro(false), Antônio(true), José(true), Francisco(true) → 5 true / 6 total = **83.33%** (displays rounded as "83%").
- `effectiveness_percent`: `ENCERRADO` + `followed_recommendation === true`: José (`FAVORAVEL`) and Francisco (`PARCIAL`) → 1 favorable / 2 total = **50%**.

No code change in this step — just confirms the fixture data produces non-trivial, verifiable numbers before building UI on top of it.

- [ ] **Step 9: Commit**

```bash
cd src/web && git add src/types/case.ts src/api/mocks/cases.ts src/api/cases.ts src/lib/metrics.ts
git commit -m "$(cat <<'EOF'
feat(web): add KPI fields (open value, new cases, adherence, effectiveness)

Grounded in docs/ARCHITECTURE.md §7/§8 (lawyer_decisions.accepted and
case_outcomes) rather than invented — followed_recommendation mirrors the
former, outcome mirrors the latter's enum.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `HotTopics` component (dot-list, replaces the chip buttons)

**Files:**
- Create: `src/web/src/components/HotTopics/HotTopics.tsx`
- Create: `src/web/src/components/HotTopics/HotTopics.module.css`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `export interface HotTopicItem { key: string; label: string; value: number | undefined; tone: 'negative' | 'accent' | 'muted'; active: boolean; onClick: () => void }` and `export function HotTopics({ items }: { items: HotTopicItem[] }): JSX.Element`. Task 5 constructs the `HotTopicItem[]` array and renders `<HotTopics items={...} />`.

- [ ] **Step 1: Create the component**

Create `src/web/src/components/HotTopics/HotTopics.tsx`:

```tsx
import styles from './HotTopics.module.css';

export interface HotTopicItem {
  key: string;
  label: string;
  value: number | undefined;
  tone: 'negative' | 'accent' | 'muted';
  active: boolean;
  onClick: () => void;
}

export function HotTopics({ items }: { items: HotTopicItem[] }) {
  return (
    <ul className={styles.list} aria-label="Pendências">
      {items.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            className={`${styles.row} ${item.active ? styles.active : ''}`}
            onClick={item.onClick}
            aria-pressed={item.active}
          >
            <span className={`${styles.dot} ${styles[item.tone]}`} aria-hidden />
            <span className={styles.label}>{item.label}</span>
            <span className={styles.value}>{item.value ?? '–'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Create its styles**

Create `src/web/src/components/HotTopics/HotTopics.module.css`:

```css
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 15rem;
  padding: var(--space-1) 0;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
}

.dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
}

.dot.negative {
  background: var(--status-negative);
}

.dot.accent {
  background: var(--accent);
}

.dot.muted {
  background: var(--text-muted);
}

.label {
  font-size: var(--text-14);
}

.value {
  margin-left: auto;
  color: var(--text-primary);
  font-family: var(--font-heading);
  font-size: var(--text-20);
  font-weight: var(--weight-regular);
  font-variant-numeric: tabular-nums;
}

.row:hover .label {
  color: var(--text-primary);
}

.active .label {
  color: var(--accent);
  font-weight: var(--weight-medium);
}

.active .value {
  color: var(--accent);
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `cd src/web && npm run build`

Expected: PASS. `HotTopics.tsx` isn't imported anywhere yet, so this only confirms the new files themselves have no syntax/type errors (an unused file doesn't fail the build).

- [ ] **Step 4: Commit**

```bash
cd src/web && git add src/components/HotTopics
git commit -m "$(cat <<'EOF'
feat(web): add HotTopics component (dot-list pendency indicator)

Non-card treatment for the 3 pendency filters, to be wired into the
CasesList hero in a follow-up commit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `KpiRow` component + `formatPercent` helper

**Files:**
- Modify: `src/web/src/lib/format.ts`
- Create: `src/web/src/components/KpiRow/KpiRow.tsx`
- Create: `src/web/src/components/KpiRow/KpiRow.module.css`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `export const formatPercent = (value: number | null): string` from `lib/format.ts`. `export interface KpiRowProps { openValueSum: number | undefined; newThisMonth: number | undefined; adherencePercent: number | null | undefined; effectivenessPercent: number | null | undefined }` and `export function KpiRow(props: KpiRowProps): JSX.Element`. Task 5 renders `<KpiRow openValueSum={s?.open_value_sum} newThisMonth={s?.new_this_month} adherencePercent={s?.adherence_percent} effectivenessPercent={s?.effectiveness_percent} />`.

- [ ] **Step 1: Add `formatPercent` to the existing format helpers**

Edit `src/web/src/lib/format.ts` (currently only `formatBRL`/`formatDate`) — add at the end:

```ts
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatBRL = (value: number) => brl.format(value);
export const formatDate = (iso: string) => date.format(new Date(iso));

// null quando não há dado suficiente para calcular (ver lib/metrics.ts).
export const formatPercent = (value: number | null) => (value === null ? '—' : `${Math.round(value)}%`);
```

- [ ] **Step 2: Create the `KpiRow` component**

Create `src/web/src/components/KpiRow/KpiRow.tsx`:

```tsx
import { formatBRL, formatPercent } from '../../lib/format';
import styles from './KpiRow.module.css';

export interface KpiRowProps {
  openValueSum: number | undefined;
  newThisMonth: number | undefined;
  adherencePercent: number | null | undefined;
  effectivenessPercent: number | null | undefined;
}

function KpiBox({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.box}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}

export function KpiRow({ openValueSum, newThisMonth, adherencePercent, effectivenessPercent }: KpiRowProps) {
  return (
    <div className={styles.row} aria-label="Métricas do escritório">
      <KpiBox label="Valor em aberto" value={openValueSum === undefined ? '–' : formatBRL(openValueSum)} />
      <KpiBox label="Casos novos no mês" value={newThisMonth === undefined ? '–' : String(newThisMonth)} />
      <KpiBox label="Aderência à recomendação" value={formatPercent(adherencePercent ?? null)} />
      <KpiBox label="Eficácia ao seguir a recomendação" value={formatPercent(effectivenessPercent ?? null)} />
    </div>
  );
}
```

- [ ] **Step 3: Create its styles**

Create `src/web/src/components/KpiRow/KpiRow.module.css`:

```css
.row {
  display: flex;
  gap: var(--space-4);
}

.box {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 8.5rem;
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--stroke-secondary);
  border-radius: var(--radius-12);
  background: var(--surface-primary);
  text-align: center;
}

.label {
  color: var(--text-secondary);
  font-size: var(--text-12);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
}

.value {
  color: var(--text-primary);
  font-family: var(--font-heading);
  font-size: var(--text-24);
  font-weight: var(--weight-light);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 4: Verify it type-checks**

Run: `cd src/web && npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd src/web && git add src/lib/format.ts src/components/KpiRow
git commit -m "$(cat <<'EOF'
feat(web): add KpiRow component and formatPercent helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `WelcomeBanner` component

**Files:**
- Create: `src/web/src/components/WelcomeBanner/WelcomeBanner.tsx`
- Create: `src/web/src/components/WelcomeBanner/WelcomeBanner.module.css`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `export const DEFAULT_LAWYER_NAME = 'Clara Porter'` and `export function WelcomeBanner({ name }: { name?: string }): JSX.Element`. Task 5 renders `<WelcomeBanner />` (no props — uses the default).

- [ ] **Step 1: Create the component**

Create `src/web/src/components/WelcomeBanner/WelcomeBanner.tsx`:

```tsx
import styles from './WelcomeBanner.module.css';

// Nome fixo para a demo — não há autenticação real neste momento do projeto.
export const DEFAULT_LAWYER_NAME = 'Clara Porter';

export function WelcomeBanner({ name = DEFAULT_LAWYER_NAME }: { name?: string }) {
  return (
    <p className={styles.welcome}>
      Bem-vindo, <span className={styles.name}>{name}</span>
    </p>
  );
}
```

- [ ] **Step 2: Create its styles**

Create `src/web/src/components/WelcomeBanner/WelcomeBanner.module.css`:

```css
.welcome {
  margin: 0 0 var(--space-6);
  color: var(--text-primary);
  font-family: var(--font-heading);
  font-size: var(--text-24);
  font-weight: var(--weight-light);
  text-align: center;
}

.name {
  color: var(--accent);
  font-weight: var(--weight-regular);
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `cd src/web && npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd src/web && git add src/components/WelcomeBanner
git commit -m "$(cat <<'EOF'
feat(web): add WelcomeBanner component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Integrate hero into `CasesList` + expandable table

**Files:**
- Modify: `src/web/src/pages/CasesList/CasesList.tsx`
- Modify: `src/web/src/pages/CasesList/CasesList.module.css`

**Interfaces:**
- Consumes: `HotTopics`/`HotTopicItem` from Task 2, `KpiRow`/`KpiRowProps` from Task 3, `WelcomeBanner` from Task 4, `CasesSummary`'s new fields and `CaseListItem`'s new fields from Task 1.
- Produces: nothing consumed elsewhere (this is the page, the top of the tree for this route).

- [ ] **Step 1: Rewrite `CasesList.tsx`**

Replace the full contents of `src/web/src/pages/CasesList/CasesList.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCases, useCasesSummary } from '../../api/cases';
import { RecommendationTag, StatusBadge } from '../../components/Badges/Badges';
import { ButtonLink } from '../../components/Button/Button';
import { HotTopics, type HotTopicItem } from '../../components/HotTopics/HotTopics';
import { KpiRow } from '../../components/KpiRow/KpiRow';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { WelcomeBanner } from '../../components/WelcomeBanner/WelcomeBanner';
import { formatBRL } from '../../lib/format';
import { pendencyRank } from '../../lib/pendencies';
import { toDisplayStatus, type DisplayStatus } from '../../lib/status';
import type { CaseListItem } from '../../types/case';
import { STATUS_LABEL, THESIS_LABEL } from '../../types/labels';
import styles from './CasesList.module.css';

type RecFilter = 'TODAS' | 'ACORDO' | 'DEFESA' | 'SEM';
// Status que fazem sentido filtrar aqui — Encerrado já tem tela própria (Histórico).
const FILTERABLE_STATUS: Exclude<DisplayStatus, 'ENCERRADO'>[] = [
  'RASCUNHO',
  'DOCUMENTOS_ENVIADOS',
  'EM_ANALISE',
  'AGUARDANDO_DECISAO',
  'AGUARDANDO_ENCERRAMENTO',
];

const VISIBLE_ROWS = 5;

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// O que precisa de ação do advogado sobe para o topo da fila.
const byUrgency = (a: CaseListItem, b: CaseListItem) => pendencyRank(a) - pendencyRank(b);

function CaseRow({ item }: { item: CaseListItem }) {
  const navigate = useNavigate();
  const go = () => navigate(`/processos/${item.id}`);
  return (
    <tr className={styles.row} tabIndex={0} onClick={go} onKeyDown={(e) => e.key === 'Enter' && go()}>
      <td>
        <span className={styles.plaintiff}>
          {item.plaintiff_name}
          {item.alert && (
            <span className={styles.alertMark} title={item.alert.message} aria-label="Documento com erro de leitura">
              !
            </span>
          )}
        </span>
        <span className={styles.cnj}>{item.cnj}</span>
      </td>
      <td>{item.uf}</td>
      <td>{THESIS_LABEL[item.thesis]}</td>
      <td className={styles.num}>{formatBRL(item.claim_value)}</td>
      <td>
        <StatusBadge status={item.status} />
      </td>
      <td>
        <RecommendationTag recommendation={item.recommendation} />
      </td>
    </tr>
  );
}

export default function CasesList() {
  const cases = useCases();
  const summary = useCasesSummary();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<DisplayStatus | 'TODOS'>('TODOS');
  const [rec, setRec] = useState<RecFilter>('TODAS');
  const [onlyAlert, setOnlyAlert] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Estado dos hot-topics, que também funcionam como atalho de filtro.
  const isDecisao = status === 'AGUARDANDO_DECISAO' && !onlyAlert;
  const isEncerramento = status === 'AGUARDANDO_ENCERRAMENTO' && !onlyAlert;

  const resetFiltros = () => {
    setStatus('TODOS');
    setOnlyAlert(false);
  };
  const toggleQuickStatus = (target: DisplayStatus, active: boolean) => {
    if (active) return resetFiltros();
    setStatus(target);
    setOnlyAlert(false);
  };
  const toggleAlert = () => {
    if (onlyAlert) return resetFiltros();
    setOnlyAlert(true);
    setStatus('TODOS');
  };

  const rows = useMemo(() => {
    const digits = query.replace(/\D/g, '');
    const text = normalize(query.trim());
    return (cases.data ?? [])
      .filter((c) => c.status !== 'ENCERRADO') // encerrados ficam só no Histórico
      .filter((c) => {
        if (!text) return true;
        if (digits && c.cnj.replace(/\D/g, '').includes(digits)) return true;
        return normalize(c.plaintiff_name).includes(text);
      })
      .filter((c) => status === 'TODOS' || toDisplayStatus(c.status) === status)
      .filter((c) => {
        if (rec === 'TODAS') return true;
        if (rec === 'SEM') return c.recommendation === null;
        return c.recommendation?.action === rec;
      })
      .filter((c) => !onlyAlert || c.alert !== null)
      .sort(byUrgency);
  }, [cases.data, query, status, rec, onlyAlert]);

  // Qualquer mudança de filtro volta a lista para o estado colapsado.
  useEffect(() => {
    setExpanded(false);
  }, [query, status, rec, onlyAlert]);

  const visibleRows = expanded ? rows : rows.slice(0, VISIBLE_ROWS);
  const hiddenCount = rows.length - visibleRows.length;

  const s = summary.data;

  const hotTopics: HotTopicItem[] = [
    { key: 'alert', label: 'Erro de leitura', value: s?.document_errors, tone: 'negative', active: onlyAlert, onClick: toggleAlert },
    {
      key: 'decisao',
      label: 'Revisar recomendação',
      value: s?.awaiting_decision,
      tone: 'accent',
      active: isDecisao,
      onClick: () => toggleQuickStatus('AGUARDANDO_DECISAO', isDecisao),
    },
    {
      key: 'desfecho',
      label: 'Falta desfecho',
      value: s?.pending_outcome,
      tone: 'muted',
      active: isEncerramento,
      onClick: () => toggleQuickStatus('AGUARDANDO_ENCERRAMENTO', isEncerramento),
    },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <WelcomeBanner />
        <div className={styles.heroRow}>
          <KpiRow
            openValueSum={s?.open_value_sum}
            newThisMonth={s?.new_this_month}
            adherencePercent={s?.adherence_percent}
            effectivenessPercent={s?.effectiveness_percent}
          />
          <div className={styles.divider} aria-hidden />
          <HotTopics items={hotTopics} />
        </div>
      </section>

      <PageHeader
        title="Meus processos"
        description={
          s
            ? `${s.open} processos em aberto · ${s.in_analysis} em análise no momento.`
            : 'Casos de não reconhecimento de contratação de empréstimo.'
        }
        actions={<ButtonLink to="/processos/novo">Novo processo</ButtonLink>}
      />

      <section className={styles.filters} aria-label="Filtros">
        <input
          className={styles.search}
          type="search"
          placeholder="Buscar por autor ou número CNJ"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={styles.select}
          value={status}
          onChange={(e) => setStatus(e.target.value as DisplayStatus | 'TODOS')}
          aria-label="Status"
        >
          <option value="TODOS">Todos os status</option>
          {FILTERABLE_STATUS.map((st) => (
            <option key={st} value={st}>
              {STATUS_LABEL[st]}
            </option>
          ))}
        </select>
        <select className={styles.select} value={rec} onChange={(e) => setRec(e.target.value as RecFilter)} aria-label="Recomendação">
          <option value="TODAS">Todas as recomendações</option>
          <option value="ACORDO">Acordo</option>
          <option value="DEFESA">Defesa</option>
          <option value="SEM">Sem recomendação</option>
        </select>
      </section>

      {cases.isPending && <p className={styles.message}>Carregando processos…</p>}
      {cases.isError && <p className={styles.message}>Não foi possível carregar os processos. {cases.error.message}</p>}
      {cases.isSuccess && rows.length === 0 && <p className={styles.message}>Nenhum processo com esses filtros.</p>}

      {cases.isSuccess && rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Processo</th>
                <th>UF</th>
                <th>Tese</th>
                <th className={styles.num}>Valor da causa</th>
                <th>Status</th>
                <th>Recomendação</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((c) => (
                <CaseRow key={c.id} item={c} />
              ))}
            </tbody>
          </table>
          {hiddenCount > 0 && (
            <button type="button" className={styles.expandRow} onClick={() => setExpanded(true)}>
              Mostrar mais {hiddenCount} processos
            </button>
          )}
        </div>
      )}

      {cases.isSuccess && (
        <p className={styles.count}>
          {rows.length} de {cases.data.filter((c) => c.status !== 'ENCERRADO').length} processos em aberto
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update the page's stylesheet**

Replace the full contents of `src/web/src/pages/CasesList/CasesList.module.css`:

```css
.page {
  display: grid;
  gap: var(--space-8);
}

/* ── Hero ── */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-8) 0 var(--space-10);
  border-bottom: 1px solid var(--stroke-secondary);
}

.heroRow {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.divider {
  align-self: stretch;
  width: 1px;
  background: var(--stroke-secondary);
}

/* ── Filtros ── */
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.search,
.select {
  height: 2.5rem;
  padding: 0 var(--space-3);
  border: 1px solid var(--stroke-primary);
  border-radius: var(--radius-8);
  background: var(--surface-primary);
  font-size: var(--text-14);
}

.search {
  flex: 1 1 16rem;
}

.search::placeholder {
  color: var(--text-muted);
}

.select {
  cursor: pointer;
}

/* ── Tabela ── */
.tableWrap {
  overflow-x: auto;
  border: 1px solid var(--stroke-secondary);
  border-radius: var(--radius-12);
  background: var(--surface-primary);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-16);
}

.table th {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--stroke-secondary);
  color: var(--text-muted);
  font-size: var(--text-12);
  font-weight: var(--weight-regular);
  letter-spacing: var(--ls-label);
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.table td {
  padding: var(--space-5);
  border-bottom: 1px solid var(--stroke-secondary);
  vertical-align: middle;
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.row {
  cursor: pointer;
  transition: background-color 100ms;
}

.row:hover {
  background: var(--hover);
}

.row:focus-visible {
  outline-offset: -2px;
}

.plaintiff {
  display: block;
  color: var(--text-primary);
  font-size: var(--text-16);
  white-space: nowrap;
}

.alertMark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  margin-left: var(--space-2);
  border-radius: 50%;
  background: var(--status-negative-bg);
  color: var(--status-negative);
  font-size: var(--text-12);
  font-style: normal;
  font-weight: var(--weight-medium);
  vertical-align: middle;
}

.cnj {
  display: block;
  margin-top: 0.125rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-12);
  letter-spacing: 0;
  white-space: nowrap;
}

.num {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.expandRow {
  width: 100%;
  padding: var(--space-3);
  border: none;
  border-top: 1px dashed var(--stroke-secondary);
  background: none;
  color: var(--text-secondary);
  font-size: var(--text-14);
  cursor: pointer;
  text-align: center;
}

.expandRow:hover {
  color: var(--text-primary);
}

.message {
  padding: var(--space-12);
  color: var(--text-muted);
  text-align: center;
}

.count {
  margin: calc(-1 * var(--space-4)) 0 0;
  color: var(--text-muted);
  font-size: var(--text-12);
}
```

- [ ] **Step 3: Type-check and build**

Run: `cd src/web && npm run build`

Expected: PASS.

- [ ] **Step 4: Visual verification in the Browser pane**

1. Navigate to `http://localhost:5173/processos` (start the `web` preview server from `.claude/launch.json` if it isn't already running).
2. Screenshot the top of the page. Confirm, centered: "Bem-vindo, **Clara Porter**" (name in accent orange), then a row with 4 KPI boxes on the left and 3 dot-rows on the right separated by a thin vertical divider.
3. Confirm the 4 KPI values read exactly: **R$ 160.700** (Valor em aberto), **5** (Casos novos no mês), **83%** (Aderência à recomendação), **50%** (Eficácia ao seguir a recomendação).
4. Confirm the 3 hot-topic rows read: a red dot next to "Erro de leitura" with **1**, an orange dot next to "Revisar recomendação" with **3**, a gray dot next to "Falta desfecho" with **4**.
5. Scroll down: confirm "Meus processos" header, filters (no more chip buttons — those moved into the hero), and a table showing exactly **5** rows, followed by a "Mostrar mais 5 processos" row.
6. Click "Mostrar mais 5 processos". Confirm all 10 rows now render and the button disappears.
7. Click the "Revisar recomendação" hot-topic. Confirm: its label/value turn accent orange, the table filters to the 3 `AGUARDANDO_DECISAO` cases, and the table is collapsed again (no expand button needed since 3 < 5). Click it again to confirm it toggles off and the full list returns (collapsed to 5, with "Mostrar mais 5 processos" again).
8. Use `mcp__Claude_Browser__read_console_messages` and confirm no errors were logged during this interaction.

- [ ] **Step 5: Commit**

```bash
cd src/web && git add src/pages/CasesList/CasesList.tsx src/pages/CasesList/CasesList.module.css
git commit -m "$(cat <<'EOF'
feat(web): add metrics hero to Meus processos, make table expandable

Greeting + 4 KPI cards + hot-topics (now a dot-list, not cards) sit above
the fold; the table itself starts collapsed to 5 rows with a "mostrar
mais" expansion, so the full list is never hidden behind the hero.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** greeting (Task 4/5) · 4 KPI cards (Task 3/5) · hot-topics as non-card dot-list (Task 2/5) · hero occupies top, list not hidden, expandable to 5 rows (Task 5) · KPI calculations grounded in `docs/ARCHITECTURE.md` §7/§8 with `followed_recommendation`/`outcome` fields (Task 1) · dark-theme-only tokens used throughout (all CSS files) · out-of-scope items (`/dashboard`, auth, real pagination) untouched. No gaps found.
- **Placeholder scan:** none — every step has complete code or an exact command + expected output.
- **Type consistency:** `HotTopicItem` (Task 2) and its construction in Task 5 match field-for-field (`key`, `label`, `value`, `tone`, `active`, `onClick`). `KpiRowProps` (Task 3) and its usage in Task 5 match (`openValueSum`, `newThisMonth`, `adherencePercent`, `effectivenessPercent`). `WelcomeBanner`'s `name` prop (Task 4) is optional and unused in Task 5 (uses the default), consistent with the spec's "hardcoded por enquanto".
