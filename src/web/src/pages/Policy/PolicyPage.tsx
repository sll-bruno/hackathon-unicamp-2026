import styles from './PolicyPage.module.css';

const decisionCriteria = [
  ['1', 'Economia do acordo', 'Compara o custo total do acordo no alvo com o custo esperado da defesa.'],
  ['2', 'Risco de cauda', 'Considera o pior cenário da defesa e a alçada disponível para acordo.'],
  ['3', 'Qualidade da prova', 'Pondera provas fortes, contradições, indícios de fraude e lacunas probatórias.'],
  ['4', 'Contexto histórico', 'Usa UF, subassunto, documentos disponíveis e valor da causa.'],
  ['5', 'Confiabilidade', 'Reduz a confiança quando os sinais divergem ou a evidência é insuficiente.'],
];

const regionalSignals = [
  { uf: 'AP', rate: '48,0%', delta: '+17,9 p.p.', width: 100 },
  { uf: 'AM', rate: '47,7%', delta: '+17,5 p.p.', width: 99 },
  { uf: 'GO', rate: '37,4%', delta: '+7,2 p.p.', width: 78 },
  { uf: 'RS', rate: '37,2%', delta: '+7,1 p.p.', width: 77 },
  { uf: 'BA', rate: '35,1%', delta: '+4,9 p.p.', width: 73 },
];

const differentiators = [
  {
    number: '01',
    title: 'Qualidade da prova',
    body: 'A presença de um PDF não basta. A engine separa prova da contratação, autenticação forte, metadados, contradições e lacunas.',
    meta: '+3 prova forte · −3 lacuna crítica',
  },
  {
    number: '02',
    title: 'Explicabilidade',
    body: 'Todo fato usado na recomendação conserva categoria, peso, documento, página e trecho de origem para revisão do advogado.',
    meta: 'pesos_embasamento_v1',
  },
  {
    number: '03',
    title: 'Confiabilidade',
    body: 'A confiança mede concordância econômica em simulações e recebe tetos por coorte pequena, divergência ou falha de extração.',
    meta: '1.000 simulações · tetos de 60% e 70%',
  },
  {
    number: '04',
    title: 'Valores acionáveis',
    body: 'O advogado recebe custo esperado da defesa, cenários e uma faixa de acordo com abertura, alvo e teto — sem usar condenação futura como entrada.',
    meta: 'sem leakage · alçada explícita',
  },
];

const requirements = [
  ['Regra', 'Acordo ou Defesa'],
  ['Valor', 'Abertura, alvo e teto'],
  ['Acesso', 'Workspace com fontes'],
  ['Aderência', 'Aceite ou divergência'],
  ['Efetividade', 'Resultado e custo observado'],
];

export default function PolicyPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="policy-title">
        <div className={styles.heroCopy}>
          <span className={styles.version}>engine_v1</span>
          <h1 id="policy-title" className={styles.heroTitle}>Política de acordo vigente</h1>
          <p className={styles.heroText}>
            Política operacional para casos de empréstimo não reconhecido. A recomendação combina risco histórico,
            qualidade da prova e comparação econômica, sempre com fonte, confiança e supervisão do advogado.
          </p>
        </div>

        <aside className={styles.ruleCard} aria-label="Saídas da política">
          <span className={styles.cardLabel}>Saída obrigatória</span>
          <div className={styles.actions}>
            <div className={styles.actionAgreement}>
              <span aria-hidden="true" />
              <strong>ACORDO</strong>
              <small>com valor-alvo</small>
            </div>
            <span className={styles.or}>ou</span>
            <div>
              <span aria-hidden="true" />
              <strong>DEFESA</strong>
              <small>com teses prioritárias</small>
            </div>
          </div>
          <p>Baixa confiança é um alerta para o advogado, não uma terceira decisão.</p>
        </aside>
      </section>

      <section className={styles.decisionGrid} aria-label="Critérios e contexto regional">
        <article className={styles.criteriaCard}>
          <span className={styles.eyebrow}>Ordem de decisão</span>
          <h2>O que pesa, e em qual ordem</h2>
          <ol className={styles.criteriaList}>
            {decisionCriteria.map(([number, title, body]) => (
              <li key={number}>
                <span>{number}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>

        <article className={styles.regionalCard}>
          <div className={styles.regionalHeader}>
            <div>
              <span className={styles.eyebrow}>Sinal histórico por UF</span>
              <h2>Faixa de maior risco</h2>
            </div>
            <div className={styles.nationalRate}>
              <span>Nacional</span>
              <strong>30,1%</strong>
            </div>
          </div>
          <div className={styles.regionBars}>
            {regionalSignals.map((region) => (
              <div key={region.uf} className={styles.regionRow}>
                <strong>{region.uf}</strong>
                <div className={styles.barTrack} aria-hidden="true"><span style={{ width: `${region.width}%` }} /></div>
                <span>{region.rate}</span>
                <small>{region.delta}</small>
              </div>
            ))}
          </div>
          <p className={styles.contextNote}>
            Destaque operacional: UFs com taxa histórica de derrota ≥ 35%. A engine usa as 26 UFs do treino como variável contínua;
            esta faixa não é gatilho automático de acordo. RR está fora da distribuição e limita a confiança a 60%.
          </p>
        </article>
      </section>

      <section className={styles.originSection} aria-labelledby="origin-title">
        <header className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Origem da decisão</span>
            <h2 id="origin-title">Responsabilidade de cada sinal</h2>
          </div>
          <p>Política configurada, aprendizado histórico e evidência do processo aparecem separados na recomendação.</p>
        </header>

        <div className={styles.originGrid}>
          <article className={styles.originPolicy}>
            <span className={styles.originTag}>Decisão nossa</span>
            <h3>Política configurada</h3>
            <ul>
              <li>A saída é sempre Acordo ou Defesa.</li>
              <li>Economia é o primeiro critério da decisão.</li>
              <li>Alçada: 60% do valor da causa.</li>
              <li>Custo de defesa: 5% da perda esperada.</li>
              <li>Custo de negociação: R$ 500 <em>premissa</em>.</li>
            </ul>
          </article>

          <article>
            <span className={styles.originTag}>Vem do histórico</span>
            <h3>Modelo e calibração</h3>
            <ul>
              <li>Probabilidade dos quatro desfechos judiciais.</li>
              <li>Severidade: 62,24% na parcial e 89,95% na procedência.</li>
              <li>Referência de valor obtida em 280 acordos.</li>
              <li>Efeito da UF e dos subsídios disponíveis.</li>
              <li>59.720 casos judiciais; validação binária de 87,3%.</li>
            </ul>
          </article>

          <article>
            <span className={styles.originTag}>Vem do processo</span>
            <h3>Evidência do caso</h3>
            <ul>
              <li>Alegações e pedidos da parte autora.</li>
              <li>Provas favoráveis ao banco e ao autor.</li>
              <li>Contradições e lacunas probatórias.</li>
              <li>Valores, cronologia e qualidade de extração.</li>
              <li>Documento, página e trecho de cada fato.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className={styles.economicSection} aria-labelledby="economy-title">
        <header className={styles.economicHeader}>
          <div>
            <span className={styles.eyebrow}>Régua econômica do acordo</span>
            <h2 id="economy-title">Quando o acordo preserva mais valor que a defesa</h2>
          </div>
          <p>
            Acordo é a recomendação econômica quando seu custo total no alvo fica abaixo do custo esperado da defesa
            de forma robusta. Prova, risco de cauda ou baixa confiabilidade podem justificar decisão contrária.
          </p>
        </header>

        <div className={styles.economicBody}>
          <div className={styles.comparison}>
            <div className={styles.formulaBlock}>
              <span>Custo esperado da defesa</span>
              <div>
                <strong>P(derrota)</strong><b>×</b><strong>perda se condenado</strong><b>+</b><strong>custo de defesa</strong>
              </div>
            </div>
            <span className={styles.versus}>versus</span>
            <div className={`${styles.formulaBlock} ${styles.agreementFormula}`}>
              <span>Custo total do acordo no alvo</span>
              <div><strong>valor-alvo oferecido</strong><b>+</b><strong>R$ 500 de negociação</strong></div>
            </div>
          </div>

          <aside className={styles.robustness}>
            <strong>1.000</strong>
            <span>cenários simulados</span>
            <p>A confiança reflete em quantos cenários a ação escolhida continua economicamente preferível.</p>
          </aside>
        </div>

        <div className={styles.agreementRange}>
          <div className={styles.rangeIntro}>
            <span className={styles.cardLabel}>Se a recomendação for acordo</span>
            <h3>Faixa de negociação</h3>
            <p>Percentuais aplicados à perda estimada se houver condenação.</p>
          </div>
          <div className={styles.rangeStep}><span>Abertura</span><strong>34,89%</strong><small>P25 histórico</small></div>
          <div className={`${styles.rangeStep} ${styles.rangeTarget}`}><span>Oferta-alvo</span><strong>40,97%</strong><small>Mediana histórica</small></div>
          <div className={styles.rangeStep}><span>Teto calculado</span><strong>54,43%</strong><small>P90, limitado pela alçada</small></div>
        </div>
        <p className={styles.rangeNote}>
          Os três multiplicadores vieram dos 280 acordos históricos. A escolha de usar uma faixa, o custo de negociação
          e a alçada de 60% são decisões configuradas por nós.
        </p>
      </section>

      <section className={styles.differentials} aria-labelledby="differentials-title">
        <header className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>Diferenciais do fluxo</span>
            <h2 id="differentials-title">A recomendação vem pronta para ser verificada e executada</h2>
          </div>
        </header>
        <div className={styles.differentialGrid}>
          {differentiators.map((item) => (
            <article key={item.number}>
              <span className={styles.differentialNumber}>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <small>{item.meta}</small>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.inputsSection} aria-labelledby="inputs-title">
        <div>
          <span className={styles.eyebrow}>Entradas ex ante</span>
          <h2 id="inputs-title">O modelo só usa informação disponível antes da decisão</h2>
        </div>
        <div>
          <ul className={styles.inputList} aria-label="Entradas do modelo de risco">
            {['UF', 'Subassunto', 'Valor da causa', 'Contrato', 'Extrato', 'Comprovante', 'Dossiê', 'Demonstrativo', 'Laudo'].map((input) => (
              <li key={input}>{input}</li>
            ))}
          </ul>
          <p className={styles.excludedInput}>
            <strong>Condenação não é feature.</strong> Ela é usada somente como alvo histórico para estimar a severidade.
          </p>
        </div>
      </section>

      <section className={styles.requirements} aria-label="Cobertura dos requisitos do desafio">
        <span className={styles.cardLabel}>Cobertura do desafio</span>
        <div>
          {requirements.map(([title, value]) => (
            <p key={title}><strong>{title}</strong><span>{value}</span></p>
          ))}
        </div>
      </section>

      <section className={styles.limits} aria-labelledby="limits-title">
        <div>
          <span className={styles.eyebrow}>Limites conhecidos</span>
          <h2 id="limits-title">Premissas que ainda precisam de dados reais</h2>
        </div>
        <ul>
          <li>Disponibilidade de documento não comprova autenticidade.</li>
          <li>Não há curva histórica de aceite ou contraproposta.</li>
          <li>Honorários, duração e custo de negociação não vieram na base.</li>
          <li>A distribuição quase uniforme por UF sugere uma base sintética ou balanceada.</li>
        </ul>
      </section>

      <footer className={styles.registry} aria-label="Versões da política">
        <span>engine-v1</span><span>risco_v1</span><span>pesos_embasamento_v1</span><span>mc-economic-agreement-v1</span>
      </footer>
    </div>
  );
}
