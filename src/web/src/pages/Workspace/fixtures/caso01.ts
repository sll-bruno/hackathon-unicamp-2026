import type { Workspace } from '../../../types/workspace';

/*
 * DADOS DE EXEMPLO — Caso 01 (data/Caso_01_...).
 * Trechos e páginas vêm dos PDFs fornecidos. Probabilidades, custos, faixa,
 * pesos e confiança são ILUSTRATIVOS e não são resultados do pipeline.
 */
export const caso01: Workspace = {
  case: {
    case_id: 'caso-01',
    cnj: '0801234-56.2024.8.10.0001',
    court: '3ª Vara Cível · São Luís/MA',
    uf: 'MA',
    thesis: 'Golpe',
    claim_value: 20000,
    status: 'AGUARDANDO_DECISAO',
    plaintiff: 'Maria das Graças Silva Pereira',
    contract_number: '502348719',
  },
  documents: [
    { document_id: 'c1-autos', filename: '01_Autos_Processo.pdf', type: 'autos', pages: 8 },
    { document_id: 'c1-contrato', filename: '02_Contrato_502348719.pdf', type: 'contrato', pages: 2 },
    { document_id: 'c1-extrato', filename: '03_Extrato_Bancario.pdf', type: 'extrato', pages: 1 },
    { document_id: 'c1-comprovante', filename: '04_Comprovante_de_Credito_BACEN.pdf', type: 'comprovante_credito', pages: 2 },
    { document_id: 'c1-dossie', filename: '05_Dossie_Veritas.pdf', type: 'dossie', pages: 2 },
    { document_id: 'c1-demonstrativo', filename: '06_Demonstrativo_Evolucao_Divida.pdf', type: 'demonstrativo_divida', pages: 3 },
    { document_id: 'c1-laudo', filename: '07_Laudo_Referenciado.pdf', type: 'laudo_referenciado', pages: 2 },
  ],
  subsidy_flags: {
    contrato: true,
    extrato: true,
    comprovante_credito: true,
    dossie: true,
    demonstrativo_divida: true,
    laudo_referenciado: true,
  },
  risk: {
    probabilities: { extincao: 0.18, improcedencia: 0.56, parcial: 0.19, procedencia: 0.07 },
    cohort_size: 4120,
  },
  recommendation: {
    action: 'DEFESA',
    confidence_percent: 81,
    confidence_method_version: 'exemplo-v0',
    reason:
      'O banco tem os seis subsídios e o risco de condenação é baixo. Mesmo no teto (R$ 1.400), o acordo fica quase no mesmo custo de defender (R$ 1.500): não compensa o esforço de negociar.',
    reason_codes: ['EVIDENCIA_CONTRADITORIA'],
    expected_defense_cost: 1500,
    defense_cost_range: [900, 2400],
    settlement_range: { opening: 800, target: 1100, ceiling: 1400 },
    expected_savings: 0,
    what_changes: [
      'Custo de defesa subir acima de R$ 1.500 (ex.: honorários maiores): o teto do acordo passa a ser mais barato.',
      'Custo operacional da defesa acima de R$ 1.300 por processo (premissa atual: R$ 900).',
      'Contrato ou dossiê indisponível no inventário exige nova análise e tende a mudar para ACORDO.',
    ],
    assumptions: [
      'Custo operacional da defesa: R$ 900 (premissa configurada, não observada).',
      'Custo de negociação: R$ 400 e margem de segurança: R$ 500.',
      'Oferta candidata considerada aceita; não há curva de aceite histórica.',
    ],
  },
  facts: [
    {
      id: 'FAT-001',
      fact_type: 'credit_transfer',
      description: 'Os R$ 5.000,00 do contrato foram creditados na conta da autora em 12/05/2022.',
      weight: 5,
      weights_version: 'exemplo-v0',
      relation: 'refutes',
      claim: 'Não houve contratação nem recebimento de valores',
      sources: [
        { document_id: 'c1-extrato', page: 1, excerpt: '12/05/2022 CRÉDITO - EMPRÉSTIMO CONSIGNADO Contr. 502348719 +5.000,00' },
        { document_id: 'c1-comprovante', page: 1, excerpt: 'Data da liberação do crédito 12/05/2022' },
      ],
    },
    {
      id: 'FAT-002',
      fact_type: 'contracting_statement',
      description: 'O dossiê grafotécnico aponta assinatura compatível (91%) e match facial de 97,3%.',
      weight: 4,
      weights_version: 'exemplo-v0',
      relation: 'refutes',
      claim: 'Não houve manifestação de vontade da autora',
      sources: [
        { document_id: 'c1-dossie', page: 1, excerpt: 'Assinatura manuscrita no contrato COMPATÍVEL (índice 91%)' },
        { document_id: 'c1-dossie', page: 1, excerpt: 'Selfie / liveness CONFIRMADA - match facial 97,3%' },
      ],
    },
    {
      id: 'FAT-003',
      fact_type: 'installment_payments',
      description: '21 de 72 parcelas de R$ 120,00 foram descontadas, somando R$ 2.520,00.',
      weight: 3,
      weights_version: 'exemplo-v0',
      relation: 'neutral',
      claim: 'Restituição em dobro dos valores descontados',
      sources: [
        { document_id: 'c1-demonstrativo', page: 3, excerpt: 'Resumo: 21 de 72 parcelas liquidadas' },
      ],
    },
    {
      id: 'FAT-004',
      fact_type: 'moral_damage_claim',
      description: 'A autora pede R$ 15.000,00 de danos morais; valor da causa de R$ 20.000,00.',
      weight: 2,
      weights_version: 'exemplo-v0',
      relation: 'supports',
      claim: 'Indenização por danos morais',
      sources: [
        { document_id: 'c1-autos', page: 4, excerpt: 'indenização por danos morais no valor de R$ 15.000,00 (quinze mil reais)' },
        { document_id: 'c1-autos', page: 4, excerpt: 'Dá-se à causa o valor de R$ 20.000,00 (vinte mil reais).' },
      ],
    },
    {
      id: 'FAT-005',
      fact_type: 'contract_cancellation_claim',
      description: 'Pedido de declaração de inexistência do débito do contrato 502348719.',
      weight: null,
      weights_version: 'exemplo-v0',
      relation: 'supports',
      claim: 'Cancelamento do contrato',
      sources: [
        { document_id: 'c1-autos', page: 4, excerpt: 'declarar a inexistência do débito relativo ao contrato nº 502348719' },
      ],
    },
  ],
  contradictions: [
    {
      id: 'CON-001',
      description: 'A autora diz que não houve depósito em conta, mas o extrato mostra o crédito e transferências logo em seguida.',
      sources: [
        { document_id: 'c1-autos', page: 2, excerpt: 'inexistindo nos extratos de sua conta corrente qualquer movimentação compatível com depósito ou saque' },
        { document_id: 'c1-extrato', page: 1, excerpt: '13/05/2022 TED ENVIADA - CTA TITULARIDADE -3.000,00' },
      ],
    },
    {
      id: 'CON-002',
      description: 'O canal registrado é telefônico, mas o contrato fala em assinatura manual e o dossiê em selfie no ato da contratação.',
      sources: [
        { document_id: 'c1-contrato', page: 2, excerpt: 'Correspondente bancário - Canal Telefônico (Telemarketing)' },
        { document_id: 'c1-contrato', page: 2, excerpt: 'o TOMADOR firma a presente Cédula de forma manual, em 10/05/2022' },
        { document_id: 'c1-dossie', page: 1, excerpt: 'Captura fotográfica do tomador no momento da contratação (selfie liveness)' },
      ],
    },
    {
      id: 'CON-003',
      description: 'O saldo devedor do resumo é o da última parcela do cronograma, não o de hoje (após a 21ª parcela o saldo é R$ 4.326,00).',
      note: 'Inconsistência aritmética: prevalece o cálculo reproduzível.',
      sources: [
        { document_id: 'c1-demonstrativo', page: 3, excerpt: 'Saldo devedor em aberto na data de referência: aproximadamente R$ 1.037,66' },
        { document_id: 'c1-demonstrativo', page: 1, excerpt: '21 10/02/2024 4.364,39 81,61 38,39 120,00 4.326,00 PAGA' },
      ],
    },
  ],
  gaps: [
    {
      id: 'LAC-001',
      description: 'A gravação de voz do atendimento telefônico é citada no laudo, mas não está no pacote do caso.',
      impact: 'Não altera a flag do subsídio. Vale anexar se a autoria da contratação for questionada em audiência.',
      sources: [
        { document_id: 'c1-laudo', page: 1, excerpt: 'Gravação de voz do atendimento telefônico: arquivo MP3 armazenado em cofre digital (duração 07m42s)' },
      ],
    },
    {
      id: 'LAC-002',
      description: 'O "valor total financiado" ignora IOF e seguro que o próprio contrato diz serem financiados.',
      impact: 'Afeta a memória de cálculo da restituição. Revisar antes de negociar.',
      sources: [
        { document_id: 'c1-contrato', page: 1, excerpt: 'IOF financiado R$ 186,25 Seguro prestamista R$ 87,50 Valor total financiado R$ 5.000,00' },
      ],
    },
  ],
  versions: { pipeline: '0.1.0-exemplo', policy: 'v1.0', weights: 'exemplo-v0' },
  analyzed_at: '2026-09-12T10:42:00-03:00',
  decision: null,
  negotiation: null,
  outcome: null,
};
