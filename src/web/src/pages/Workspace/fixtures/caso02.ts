import type { Workspace } from '../../../types/workspace';

/*
 * DADOS DE EXEMPLO — Caso 02 (data/Caso_02_...).
 * Trechos e páginas vêm dos PDFs fornecidos. Probabilidades, custos, faixa,
 * pesos e confiança são ILUSTRATIVOS e não são resultados do pipeline.
 */
export const caso02: Workspace = {
  case: {
    case_id: 'caso-02',
    cnj: '0654321-09.2024.8.04.0001',
    court: '5ª Vara Cível · Manaus/AM',
    uf: 'AM',
    thesis: 'Golpe',
    claim_value: 25000,
    status: 'AGUARDANDO_DECISAO',
    plaintiff: 'José Raimundo Oliveira Costa',
    contract_number: '603827451',
  },
  documents: [
    { document_id: 'c2-autos', filename: '01_Autos_Processo.pdf', type: 'autos', pages: 8 },
    { document_id: 'c2-comprovante', filename: '02_Comprovante_de_Credito_BACEN.pdf', type: 'comprovante_credito', pages: 2 },
    { document_id: 'c2-demonstrativo', filename: '03_Demonstrativo_Evolucao_Divida.pdf', type: 'demonstrativo_divida', pages: 3 },
    { document_id: 'c2-laudo', filename: '04_Laudo_Referenciado.pdf', type: 'laudo_referenciado', pages: 2 },
  ],
  subsidy_flags: {
    contrato: false,
    extrato: false,
    comprovante_credito: true,
    dossie: false,
    demonstrativo_divida: true,
    laudo_referenciado: true,
  },
  risk: {
    probabilities: { extincao: 0.12, improcedencia: 0.2, parcial: 0.43, procedencia: 0.25 },
    cohort_size: 1870,
  },
  recommendation: {
    action: 'ACORDO',
    confidence_percent: 64,
    confidence_method_version: 'exemplo-v0',
    reason:
      'O banco não tem contrato, extrato nem dossiê, e o risco de condenação chega a 68%. Um acordo até R$ 7.900 custa bem menos que a defesa esperada de R$ 13.500.',
    reason_codes: ['EVIDENCIA_CONTRADITORIA', 'INTERVALOS_SOBREPOSTOS'],
    expected_defense_cost: 13500,
    defense_cost_range: [7800, 22000],
    settlement_range: { opening: 3200, target: 4300, ceiling: 7900 },
    expected_savings: 9200,
    what_changes: [
      'Contraproposta acima de R$ 7.900 (teto econômico): defesa passa a ser preferível.',
      'Contrato assinado ou dossiê disponível no inventário exige nova análise e tende a mudar para DEFESA.',
      'Dano moral histórico da coorte AM · Golpe abaixo de R$ 3.000 reduz a exposição e o teto.',
    ],
    assumptions: [
      'Custo operacional da defesa: R$ 900 (premissa configurada, não observada).',
      'Custo de negociação: R$ 400 e margem de segurança: R$ 1.100.',
      'Oferta candidata considerada aceita; não há curva de aceite histórica.',
    ],
  },
  facts: [
    {
      id: 'FAT-001',
      fact_type: 'credit_transfer',
      description: 'R$ 8.500,00 liberados em 19/07/2023 em conta da Caixa Econômica Federal, não na conta de benefício.',
      weight: 5,
      weights_version: 'exemplo-v0',
      relation: 'supports',
      claim: 'Valores foram direcionados a terceiro',
      sources: [
        { document_id: 'c2-comprovante', page: 1, excerpt: 'Instituição depositária Caixa Econômica Federal - Ag. 3245 - CC 00012345-6' },
        { document_id: 'c2-autos', page: 2, excerpt: 'o Autor não possui conta corrente na referida instituição' },
      ],
    },
    {
      id: 'FAT-002',
      fact_type: 'contracting_statement',
      description: 'Contratação por aplicativo com device fingerprint, geolocalização em Manaus e senha de 6 dígitos.',
      weight: 4,
      weights_version: 'exemplo-v0',
      relation: 'refutes',
      claim: 'O autor nunca usou canal digital do banco',
      sources: [
        { document_id: 'c2-laudo', page: 1, excerpt: 'Dispositivo: identificado por device fingerprint (hash DFP-9A43E1B7)' },
        { document_id: 'c2-laudo', page: 1, excerpt: 'Geolocalização do dispositivo no momento da contratação: latitude -3.1019, longitude -60.0261' },
      ],
    },
    {
      id: 'FAT-003',
      fact_type: 'installment_payments',
      description: '8 de 84 parcelas de R$ 180,00 foram descontadas: R$ 1.440,00 (R$ 2.880,00 em dobro).',
      weight: 3,
      weights_version: 'exemplo-v0',
      relation: 'neutral',
      claim: 'Restituição em dobro dos valores descontados',
      sources: [
        { document_id: 'c2-demonstrativo', page: 3, excerpt: 'Resumo: 8 de 84 parcelas liquidadas' },
      ],
    },
    {
      id: 'FAT-004',
      fact_type: 'moral_damage_claim',
      description: 'O autor pede R$ 18.000,00 de danos morais; valor da causa de R$ 25.000,00.',
      weight: 2,
      weights_version: 'exemplo-v0',
      relation: 'supports',
      claim: 'Indenização por danos morais',
      sources: [
        { document_id: 'c2-autos', page: 4, excerpt: 'indenização por danos morais no valor de R$ 18.000,00 (dezoito mil reais)' },
      ],
    },
    {
      id: 'FAT-005',
      fact_type: 'material_damage_claim',
      description: 'Boletim de ocorrência e reclamação no Banco Central registrados antes da ação.',
      weight: null,
      weights_version: 'exemplo-v0',
      relation: 'supports',
      claim: 'Contratação fraudulenta por terceiro',
      sources: [
        { document_id: 'c2-autos', page: 2, excerpt: 'Boletim de Ocorrência nº 2024.005432' },
        { document_id: 'c2-autos', page: 2, excerpt: 'Banco Central do Brasil (RDR nº 12345678-9)' },
      ],
    },
  ],
  contradictions: [
    {
      id: 'CON-001',
      description: 'O laudo registra autenticação por biometria facial, mas informa que o vídeo de liveness não foi localizado.',
      sources: [
        { document_id: 'c2-laudo', page: 1, excerpt: 'Autenticação: biometria facial (liveness) + senha eletrônica 6 dígitos' },
        { document_id: 'c2-laudo', page: 2, excerpt: 'não foi localizado nos arquivos digitais o vídeo de liveness (biometria facial)' },
      ],
    },
    {
      id: 'CON-002',
      description: 'O autor diz não ter smartphone compatível; o laudo registra contratação pelo app com dispositivo identificado.',
      sources: [
        { document_id: 'c2-autos', page: 1, excerpt: 'não possuindo sequer smartphone compatível com as exigências tecnológicas usuais' },
        { document_id: 'c2-laudo', page: 1, excerpt: 'Canal: Digital - Aplicativo Mobile (self-service)' },
      ],
    },
    {
      id: 'CON-003',
      description: 'O saldo devedor do resumo é o da última parcela do cronograma, não o de hoje (após a 8ª parcela o saldo é R$ 8.241,28).',
      note: 'Inconsistência aritmética: prevalece o cálculo reproduzível.',
      sources: [
        { document_id: 'c2-demonstrativo', page: 3, excerpt: 'Saldo devedor em aberto na data de referência: aproximadamente R$ 2.748,38' },
        { document_id: 'c2-demonstrativo', page: 1, excerpt: '8 18/03/2024 8.275,63 145,65 34,35 180,00 8.241,28 PAGA' },
      ],
    },
  ],
  gaps: [
    {
      id: 'LAC-001',
      description: 'Contrato indisponível no inventário.',
      impact: 'Entra no modelo de risco como subsídio indisponível (flag 0) e aumenta a probabilidade de perda.',
      sources: [],
    },
    {
      id: 'LAC-002',
      description: 'Extrato indisponível: a TED citada no laudo não pode ser conferida.',
      impact: 'Flag 0 no modelo. Sem extrato, não há como mostrar quem movimentou o crédito.',
      sources: [
        { document_id: 'c2-laudo', page: 2, excerpt: 'mediante Transferência Eletrônica Disponível (TED) identificada na fatura/extrato do período' },
      ],
    },
    {
      id: 'LAC-003',
      description: 'Dossiê indisponível e sem verificação grafotécnica por terceiro.',
      impact: 'Flag 0 no modelo. O laudo confirma que a verificação complementar não foi feita.',
      sources: [
        { document_id: 'c2-laudo', page: 2, excerpt: 'Não foi providenciada, até o momento, verificação grafotécnica complementar por empresa terceira.' },
      ],
    },
  ],
  versions: { pipeline: '0.1.0-exemplo', policy: 'v1.0', weights: 'exemplo-v0' },
  analyzed_at: '2026-09-12T11:05:00-03:00',
  decision: null,
  negotiation: null,
  outcome: null,
};
