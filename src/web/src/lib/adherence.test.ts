import { describe, expect, it } from 'vitest';
import { bucketFromPercent, buildAdherenceOverview, type AdherenceRecord } from './adherence';

describe('bucketFromPercent', () => {
  it('retorna null quando não há confiança calculada', () => {
    expect(bucketFromPercent(null)).toBeNull();
  });

  it('classifica alta a partir de 80', () => {
    expect(bucketFromPercent(85)).toBe('alta');
    expect(bucketFromPercent(80)).toBe('alta');
  });

  it('classifica média entre 50 e 79', () => {
    expect(bucketFromPercent(79)).toBe('media');
    expect(bucketFromPercent(50)).toBe('media');
  });

  it('classifica baixa abaixo de 50', () => {
    expect(bucketFromPercent(49)).toBe('baixa');
    expect(bucketFromPercent(0)).toBe('baixa');
  });
});

describe('buildAdherenceOverview', () => {
  const NOW = new Date('2026-09-12T12:00:00.000Z');
  const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

  const records: AdherenceRecord[] = [
    { action: 'ACORDO', accepted: true, divergence_reason: null, confidence_percent: 85, office_id: 'o1', office_name: 'Nome A', thesis: 'GOLPE', policy_version: 'v1.0', decided_at: daysAgo(5) },
    { action: 'ACORDO', accepted: false, divergence_reason: 'VALOR_IRREAL', confidence_percent: 90, office_id: 'o1', office_name: 'Nome A', thesis: 'GOLPE', policy_version: 'v1.0', decided_at: daysAgo(5) },
    { action: 'DEFESA', accepted: true, divergence_reason: null, confidence_percent: 60, office_id: 'o2', office_name: 'Nome B', thesis: 'GENERICO', policy_version: 'v1.0', decided_at: daysAgo(10) },
    { action: 'DEFESA', accepted: false, divergence_reason: 'FATO_NOVO', confidence_percent: 40, office_id: 'o2', office_name: 'Nome B', thesis: 'GOLPE', policy_version: 'v1.0', decided_at: daysAgo(40) },
    { action: 'ACORDO', accepted: true, divergence_reason: null, confidence_percent: null, office_id: 'o3', office_name: 'Nome C', thesis: 'GOLPE', policy_version: 'v0.9', decided_at: daysAgo(2) },
  ];

  it('retorna tudo zerado/null para dataset vazio', () => {
    const overview = buildAdherenceOverview([], { period: 'all' }, NOW);
    expect(overview.overall_percent).toBeNull();
    expect(overview.total_decisions).toBe(0);
    expect(overview.by_action).toEqual([
      { action: 'ACORDO', adherence_percent: null, total: 0 },
      { action: 'DEFESA', adherence_percent: null, total: 0 },
    ]);
    expect(overview.by_office).toEqual([]);
    expect(overview.by_confidence).toEqual([
      { band: 'alta', accepted: 0, diverged: 0 },
      { band: 'media', accepted: 0, diverged: 0 },
      { band: 'baixa', accepted: 0, diverged: 0 },
    ]);
    expect(overview.divergence_reasons).toEqual([
      { reason: 'DOCUMENTO_INVALIDO', count: 0 },
      { reason: 'FATO_NOVO', count: 0 },
      { reason: 'ERRO_EXTRACAO', count: 0 },
      { reason: 'VALOR_IRREAL', count: 0 },
      { reason: 'OUTRO', count: 0 },
    ]);
  });

  it('retorna tudo zerado/null quando o filtro não bate com nenhum registro', () => {
    const overview = buildAdherenceOverview(records, { period: 'all', officeId: 'nao-existe' }, NOW);
    expect(overview.total_decisions).toBe(0);
    expect(overview.overall_percent).toBeNull();
  });

  it('agrega aderência geral, por tipo, por escritório, por confiança e motivos de divergência', () => {
    const overview = buildAdherenceOverview(records, { period: 'all' }, NOW);

    expect(overview.total_decisions).toBe(5);
    expect(overview.overall_percent).toBeCloseTo(60, 5); // 3 aceitos de 5

    expect(overview.by_action).toEqual([
      { action: 'ACORDO', adherence_percent: expect.closeTo(66.666, 2), total: 3 },
      { action: 'DEFESA', adherence_percent: 50, total: 2 },
    ]);

    expect(overview.by_office).toEqual([
      { office_id: 'o1', office_name: 'Nome A', adherence_percent: 50, total: 2 },
      { office_id: 'o2', office_name: 'Nome B', adherence_percent: 50, total: 2 },
      { office_id: 'o3', office_name: 'Nome C', adherence_percent: 100, total: 1 },
    ]);

    expect(overview.by_confidence).toEqual([
      { band: 'alta', accepted: 1, diverged: 1 },
      { band: 'media', accepted: 1, diverged: 0 },
      { band: 'baixa', accepted: 0, diverged: 1 },
    ]);

    const reasonCounts = Object.fromEntries(overview.divergence_reasons.map((r) => [r.reason, r.count]));
    expect(reasonCounts).toEqual({
      DOCUMENTO_INVALIDO: 0,
      FATO_NOVO: 1,
      ERRO_EXTRACAO: 0,
      VALOR_IRREAL: 1,
      OUTRO: 0,
    });
  });

  it('aplica o filtro de período usando o parâmetro now', () => {
    // registro de o2/DEFESA/FATO_NOVO foi decidido há 40 dias — fora da janela de 30d
    const overview = buildAdherenceOverview(records, { period: '30d' }, NOW);
    expect(overview.total_decisions).toBe(4);
    expect(overview.overall_percent).toBeCloseTo(75, 5); // 3 aceitos de 4 (o1/ACORDO, o2/DEFESA, o3/ACORDO)
  });

  it('não soma em nenhuma banda de confiança um registro com confidence_percent null (comportamento intencional)', () => {
    const overview = buildAdherenceOverview(records, { period: 'all' }, NOW);
    // o registro o3/ACORDO tem confidence_percent: null — total_decisions inclui ele,
    // mas a soma das bandas de confiança fica menor que total_decisions.
    const bucketed = overview.by_confidence.reduce((sum, d) => sum + d.accepted + d.diverged, 0);
    expect(overview.total_decisions).toBe(5);
    expect(bucketed).toBe(4);
    expect(overview.total_decisions - bucketed).toBe(1);
  });

  it('aplica os filtros de escritório, tese, confiança e versão de política', () => {
    expect(buildAdherenceOverview(records, { period: 'all', officeId: 'o1' }, NOW).total_decisions).toBe(2);
    expect(buildAdherenceOverview(records, { period: 'all', thesis: 'GENERICO' }, NOW).total_decisions).toBe(1);
    expect(buildAdherenceOverview(records, { period: 'all', confidenceBand: 'alta' }, NOW).total_decisions).toBe(2);
    expect(buildAdherenceOverview(records, { period: 'all', policyVersion: 'v0.9' }, NOW).total_decisions).toBe(1);
  });
});
