// DADOS SIMULADOS para a área de trabalho (Tela 3) enquanto a API não expõe
// o formato esperado — mesma motivação de ../mocks/cases.ts. Cada processo
// mockado reaproveita a estrutura de um dos dois casos de exemplo (caso01/
// caso02), só substituindo os dados de identificação e recomendação pelos
// valores já usados na lista de Processos, para manter as duas telas coerentes.
import { caso01 } from '../../pages/Workspace/fixtures/caso01';
import { caso02 } from '../../pages/Workspace/fixtures/caso02';
import type { CaseListItem, Thesis } from '../../types/case';
import type { Recommendation, Workspace } from '../../types/workspace';

const THESIS_LABEL: Record<Thesis, string> = { GOLPE: 'Golpe', GENERICO: 'Genérico' };

function buildRecommendation(base: Recommendation, item: CaseListItem): Recommendation {
  const rec = item.recommendation;
  if (!rec) return base;

  if (rec.action === 'ACORDO' && rec.suggested_range && rec.economic_ceiling !== null) {
    const [opening, target] = rec.suggested_range;
    return {
      ...base,
      action: 'ACORDO',
      confidence_percent: rec.confidence_percent,
      expected_defense_cost: rec.defense_cost_central,
      settlement_range: { opening, target, ceiling: rec.economic_ceiling },
      expected_savings: Math.max(rec.defense_cost_central - target, 0),
    };
  }

  return {
    ...base,
    action: 'DEFESA',
    confidence_percent: rec.confidence_percent,
    expected_defense_cost: rec.defense_cost_central,
    expected_savings: 0,
  };
}

/** Reaproveita um caso de exemplo completo, com os dados do item da lista mockada por cima. */
export function buildMockWorkspace(item: CaseListItem): Workspace {
  const template = item.thesis === 'GENERICO' ? caso02 : caso01;

  return {
    ...template,
    case: {
      ...template.case,
      case_id: item.id,
      cnj: item.cnj,
      uf: item.uf,
      thesis: THESIS_LABEL[item.thesis],
      claim_value: item.claim_value,
      status: item.status,
      plaintiff: item.plaintiff_name,
    },
    recommendation: buildRecommendation(template.recommendation, item),
  };
}
