# Motor de Decisão Econômica — Fluxo Consolidado

## 1. Objetivo

Construir uma política operacional que recomende uma entre duas ações, sempre com um nível de confiança:

- **Acordo**;
- **Defesa**.

Quando a análise for inconclusiva, houver baixa confiança ou faltarem informações relevantes, a recomendação é emitida com **confiança baixa** e os motivos ficam visíveis para o advogado.

O núcleo da solução não é prever se historicamente um caso “parece acordo ou defesa”. O objetivo é estimar as consequências judiciais e financeiras de cada alternativa e recomendar a ação economicamente preferível, com justificativa verificável para o advogado.

O advogado deve receber uma decisão que consiga entender, contestar e executar. O banco deve conseguir acompanhar aderência, eficiência e evolução da política.

## 2. Decisões consolidadas

1. O modelo histórico estima **probabilidades de desfecho judicial**, não a decisão final.
2. A decisão final é produzida pelo **motor financeiro + política determinística**, e não pelo LLM.
3. O valor histórico de condenação é usado como **target de severidade**, nunca como feature disponível antes da decisão.
4. Os 280 acordos históricos não são ground truth da melhor decisão. Eles refletem uma política anterior desconhecida e representam somente cerca de 0,47% da base.
5. Acordo não deve ser tratado como derrota judicial nem misturado ao modelo de resultado da defesa.
6. O LLM extrai, valida e explica evidências. Ele não inventa pesos estatísticos nem decide sozinho.
7. A sugestão inicial deve ser uma **faixa ou teto econômico de acordo**, não um valor pontual com falsa precisão.
8. “Inconclusivo” é um motivo que reduz a **confiança** da recomendação, não uma terceira ação.
9. Explicabilidade e retroalimentação são componentes centrais, não funcionalidades posteriores.
10. A principal métrica de negócio é economia esperada e realizada versus uma política de referência; accuracy é uma métrica técnica intermediária.

## 3. Dados disponíveis e limites

A base analisada possui duas abas com vínculo 1:1 entre 60 mil processos.

### Resultados dos processos

- número do processo;
- UF;
- assunto;
- subassunto;
- resultado macro;
- resultado micro;
- valor da causa;
- valor da condenação/indenização.

Resultados micro observados:

- 27.935 improcedências;
- 13.798 extinções;
- 12.248 procedências parciais;
- 5.739 procedências;
- 280 acordos.

### Subsídios disponíveis

Seis indicadores binários por processo:

- contrato;
- extrato;
- comprovante de crédito;
- dossiê;
- demonstrativo da dívida;
- laudo referenciado.

Os 60 mil casos contêm indicadores de disponibilidade, não o conteúdo integral dos documentos. Existem somente dois processos completos para demonstração documental.

### Informações econômicas ausentes

- custo da defesa;
- honorários, sucumbência, juros e correção;
- custo e duração da negociação;
- valor inicialmente ofertado;
- contraproposta;
- aceite ou recusa;
- alçadas e limites de oferta;
- política vigente;
- custo total realizado por processo.

Com os dados atuais é possível estimar exposição judicial. A comparação completa entre acordo e defesa depende de premissas explícitas até que essas informações sejam coletadas.

## 4. Diagrama executivo

O fluxo possui seis blocos operacionais. Os detalhes internos de cada bloco aparecem nas seções seguintes.

```text
┌──────────────────────────────────────────────────────────┐
│ 1. EXTRAÇÃO DE DADOS                                     │
└──────────────────────────────────────────────────────────┘

Autos + Subsídios
        ↓
Inventário documental + OCR
        ├──→ Vetor binário dos subsídios
        │     contrato, extrato, comprovante,
        │     dossiê, demonstrativo e laudo
        │
        └──→ LLM Extrator
                    ↓
              LLM Validador
                    ↓
              Evidências estruturadas
              ├─ fatos relevantes
              ├─ documentos e trechos
              ├─ validade e consistência
              ├─ contradições
              └─ lacunas probatórias

Vetor binário ───────────────────────────┐
Evidências estruturadas ─────────────────┼──→ Pacote do caso
UF, assunto, subassunto e valor da causa ┘

                            ↓

┌──────────────────────────────────────────────────────────┐
│ 2. JULGAMENTO DO RISCO                                   │
└──────────────────────────────────────────────────────────┘

Dados tabulares do pacote
        ├──→ Modelo de Risco Judicial
        │     treinado nos 60 mil processos
        │               ↓
        │     P(extinção, improcedência,
        │       parcial e procedência)
        │     + confiança calibrada
        │
        └──→ Modelo de Severidade
              treinado com as condenações históricas
                        ↓
              Condenação esperada
              + intervalo de valores

                            ↓

┌──────────────────────────────────────────────────────────┐
│ 3. ESTIMATIVA FINANCEIRA                                 │
└──────────────────────────────────────────────────────────┘

Probabilidades de desfecho ──────────────┐
Condenação esperada ─────────────────────┼──→ Motor Financeiro
Custos, alçadas, margem e premissas ─────┘           ↓
                                            ┌─────────────────┐
                                            │ Custo esperado  │
                                            │ da defesa       │
                                            ├─────────────────┤
                                            │ Faixa econômica │
                                            │ para acordo     │
                                            ├─────────────────┤
                                            │ Economia e      │
                                            │ incerteza       │
                                            └─────────────────┘

                            ↓

┌──────────────────────────────────────────────────────────┐
│ 4. DECISÃO                                               │
└──────────────────────────────────────────────────────────┘

Resultado financeiro ─────────────────────┐
Evidências e alertas de validação ─────────┼──→ Política de Decisão
Regras, alçadas e critérios de confiança ──┘           ↓
                                      ACORDO | DEFESA + confiança

                            ↓

┌──────────────────────────────────────────────────────────┐
│ 5. EXPERIÊNCIA DO ADVOGADO                               │
└──────────────────────────────────────────────────────────┘

Explicação da recomendação
├─ comparação financeira e probabilidades
├─ evidências utilizadas
├─ premissas e incerteza
├─ condição que muda a decisão
└─ seguir ou fazer override justificado

                            ↓

┌──────────────────────────────────────────────────────────┐
│ 6. MONITORAMENTO E RETROALIMENTAÇÃO                      │
└──────────────────────────────────────────────────────────┘

Decisão + ação do advogado + negociação + resultado final
                            ↓
        Aderência | Eficiência | Efetividade
                            ↓
        Validação e retreinamento versionado
                            ↓
        Nova versão de extração, modelos ou política
```

### Leitura dos blocos

| Bloco | O que entra | O que sai |
|---|---|---|
| Processo | Autos, subsídios e metadados do processo | Pacote documental do caso |
| Extração de dados | Documentos e pacote do caso | Flags binárias, fatos, evidências, contradições e qualidade |
| Julgamento do risco | Dados estruturados disponíveis antes da decisão | Probabilidades de desfecho, condenação esperada e incerteza |
| Estimativa financeira | Risco, severidade, custos, alçadas e margem | Comparação econômica e faixa de acordo |
| Decisão | Comparação econômica e alertas probatórios | Acordo ou Defesa, com confiança e motivo |
| Experiência do advogado | Recomendação e evidências | Ação executada ou override justificado |
| Monitoramento e aprendizado | Recomendação, ação, negociação, custos e resultado final | Aderência, eficiência e nova versão validada do sistema |

## 5. Extração e validação

### Entrada

- autos do processo;
- subsídios do banco;
- metadados do processo;
- inventário dos documentos disponíveis.

### Processamento

1. Identificar quais dos seis subsídios estão presentes e gerar o vetor binário compatível com a base histórica.
2. Executar OCR somente quando necessário.
3. Extrair fatos relevantes, valores, datas, partes, assinaturas, canais e referências.
4. Validar consistência entre autos e subsídios.
5. Preservar documento, página e trecho de origem de cada conclusão.
6. Sinalizar documento ilegível, ausente, inválido ou contraditório.

### Responsabilidade do LLM

O LLM pode:

- estruturar informações;
- comparar documentos;
- identificar contradições e lacunas;
- gerar uma explicação jurídica com citações;
- sinalizar quando a evidência não for confiável, reduzindo a confiança da recomendação.

O LLM não deve:

- criar probabilidades sem suporte do modelo histórico;
- atribuir pesos livres aos documentos;
- calcular a política econômica sozinho;
- transformar presença documental em validade comprovada;
- tomar a decisão final sem regras e controles.

### Saída da extração

Um JSON versionado contendo:

- metadados do caso;
- seis flags de subsídios;
- qualidade da extração;
- fatos extraídos;
- evidências e respectivas fontes;
- contradições;
- lacunas;
- alertas que reduzem a confiança da recomendação.

Os sinais semânticos dos dois processos completos ajudam na demonstração e na explicação, mas não possuem histórico suficiente para receber pesos estatísticos aprendidos.

## 6. Cálculo e decisão

### 6.1 Modelo de risco judicial

O modelo recebe UF, assunto, subassunto, valor da causa e os seis flags binários. A saída deve ser a distribuição completa:

```text
P(extinção)
P(improcedência)
P(procedência parcial)
P(procedência)
```

A saída deve ser calibrada e acompanhada de incerteza. Uma simples classe “ganha/perde” eliminaria diferenças relevantes entre parcial e procedência total.

O resultado macro atual não deve ser o alvo principal porque mistura resultado jurídico com interpretação de êxito e classifica acordo como “Não Êxito”.

### 6.2 Estimativa de severidade

A severidade responde quanto o banco provavelmente pagará caso haja procedência parcial ou total.

Treinar modelos condicionais usando como features somente informações disponíveis antes da decisão. O valor de condenação é o target histórico.

```text
m_parcial(x) = E[condenação | parcial, x]
m_procedente(x) = E[condenação | procedência, x]
```

Uma abordagem inicial adequada:

1. baseline por subassunto e faixa de valor da causa;
2. modelo tabular, como CatBoost ou LightGBM;
3. estimativas de média e quantis;
4. intervalo calibrado ou conformal.

O motor financeiro usa a média esperada. A interface também apresenta P50/P80 ou intervalo para comunicar risco de cauda.

```text
Exposição judicial esperada =
P(parcial) × m_parcial(x)
+ P(procedência) × m_procedente(x)
```

Os acordos históricos devem ficar fora do treinamento da severidade judicial, salvo se o campo for comprovadamente o valor final do acordo e for modelado como outro fenômeno.

### 6.3 Motor financeiro

Versão inicial:

```text
C_defesa = exposição judicial esperada
          + custo operacional da defesa
          + honorários, juros e demais custos configurados

C_acordo(v) = valor ofertado v
             + custo de negociação
```

A expressão de acordo acima assume aceite. Essa hipótese deve aparecer claramente.

Quando houver histórico de negociação:

```text
C_acordo(v) = custo de negociação
             + P(aceite | v, caso) × v
             + P(recusa | v, caso) × C_defesa_após_recusa
```

```text
Economia esperada(v) = C_defesa - C_acordo(v)
```

A saída inicial deve ser o teto ou a faixa em que acordo permanece economicamente vantajoso, acompanhado das premissas e de análise de sensibilidade.

### 6.4 Política de decisão

**Acordo** quando o custo do acordo for materialmente menor em cenários plausíveis, respeitando alçadas, margem mínima e evidência necessária.

**Defesa** quando o custo esperado da defesa for menor ou quando o acordo não respeitar as alçadas.

A ação é sempre Acordo ou Defesa. A **confiança é reduzida** quando ocorrer ao menos uma condição:

- baixa confiança ou caso fora da distribuição;
- intervalos financeiros sobrepostos;
- decisão muda conforme premissas plausíveis;
- documento inválido ou contraditório;
- extração/OCR com baixa qualidade;
- dados ou provas insuficientes;
- exposição alta ou fora da alçada;
- diferença econômica abaixo da margem de segurança.

Motivos como `INCONCLUSIVO_ECONOMICO`, `BAIXA_CONFIANCA`, `EVIDENCIA_CONTRADITORIA` e `FORA_DA_ALCADA` devem ser registrados separadamente da ação.

## 7. Explicabilidade para o advogado

A explicação deve ser produzida junto com a decisão e possuir quatro camadas.

### Financeira

- custo esperado da defesa;
- faixa economicamente aceitável de acordo;
- economia esperada;
- intervalo de incerteza;
- premissas econômicas utilizadas.

### Estatística

- probabilidades por desfecho;
- fatores que mais influenciaram o risco;
- suporte e tamanho da coorte histórica;
- nível de confiança e motivos.

### Jurídica e probatória

- fatos alegados;
- fatos comprovados;
- documentos e trechos correspondentes;
- contradições e lacunas;
- consequência jurídica de cada evidência.

### Condição de mudança

O contrafactual entra como explicação subordinada ao motor:

- valor acima do qual defesa se torna preferível;
- prova ou validação que mudaria a ação;
- premissa econômica que torna a análise inconclusiva.

O cartão principal deve começar pela ação:

```text
RECOMENDAÇÃO: ACORDO
Faixa recomendada: até R$ X
Economia esperada: R$ Y
Confiança: moderada

Defesa: R$ A esperados
Acordo: R$ B esperados
Principais evidências: ...
Premissas: ...
A decisão muda se: ...
```

O advogado pode seguir ou fazer override. Todo override exige motivo estruturado e permite observação complementar.

## 8. Monitoramento de aderência

Aderência mede comportamento operacional, não resultado financeiro.

Registrar no momento da decisão:

- recomendação e faixa sugerida;
- versão do modelo, política e parâmetros;
- ação escolhida pelo advogado;
- aderiu ou fez override;
- motivo do override;
- informação nova considerada;
- data e responsável.

Métricas principais:

- aderência geral e por tipo de recomendação;
- taxa de override;
- motivos de override;
- aderência por nível de confiança;
- tempo entre recomendação e ação;
- acordos realizados dentro e fora da faixa;
- diferenças entre escritórios e regiões para treinamento e governança.

O perfil do advogado não deve alterar a recomendação jurídica. Ele serve para diagnosticar adoção, divergências e necessidades de treinamento.

## 9. Monitoramento de eficiência e efetividade

Eficiência mede custo, tempo e qualidade do fluxo. Efetividade mede se a política melhora o resultado econômico e jurídico.

### Métricas econômicas

- economia esperada versus política de referência;
- economia realizada;
- custo médio por processo;
- valor médio e distribuição dos acordos;
- condenação e desembolso realizados;
- diferença entre custo previsto e realizado;
- regret ou custo da decisão em avaliações retrospectivas controladas.

### Métricas de negociação

- taxa de aceite;
- primeira oferta, contraproposta e valor final;
- quantidade de rodadas;
- tempo até acordo;
- taxa de recusa seguida de defesa.

### Métricas dos modelos

- calibração das probabilidades;
- log loss ou Brier score;
- MAE/erro da severidade;
- cobertura dos intervalos;
- desempenho por UF, subassunto e faixa de valor;
- distribuição das recomendações por nível de confiança;
- estabilidade e drift.

Accuracy isolada não mede qualidade econômica. Um erro em caso de alta exposição deve pesar mais que um erro pequeno.

## 10. Retroalimentação

Existem dois tipos de feedback e eles não devem ser confundidos.

### Feedback imediato

Capturado no momento da decisão:

- aderência ou override;
- motivo jurídico ou operacional;
- documento novo ou correção de extração;
- oferta e contraproposta.

Esse feedback melhora regras, extração e UX. A decisão do advogado não é ground truth automática.

### Feedback final

Capturado quando negociação ou processo termina:

- acordo aceito ou recusado;
- valor final do acordo;
- resultado judicial;
- valor de condenação;
- honorários e sucumbência;
- custo jurídico e operacional;
- duração;
- recursos;
- desembolso total.

Esse feedback alimenta componentes diferentes:

| Dado observado | Componente melhorado |
|---|---|
| Resultado judicial | Modelo de risco |
| Condenação final | Modelo de severidade |
| Oferta, contraproposta e aceite | Modelo futuro de negociação |
| Custos realizados | Motor financeiro |
| Override e correções | Extração, validação, regras e UX |
| Economia realizada | Avaliação da política |

### Regras do loop

1. Registrar snapshot das entradas, evidências, probabilidades, cálculos, decisão e versões utilizadas.
2. Não atualizar pesos diretamente após cada interação.
3. Retreinar em lotes e validar antes de promover uma nova versão.
4. Comparar versão candidata com baseline e versão em produção.
5. Manter trilha de auditoria e possibilidade de rollback.
6. Avaliar somente coortes com desfecho maduro; resultados judiciais têm atraso.
7. Não rotular acordo como derrota ou resultado judicial.

Existe viés de seleção: casos acordados não revelam qual seria o resultado da defesa, e casos defendidos não revelam qual oferta teria sido aceita. A avaliação deve reconhecer esse contrafactual ausente e evitar comparações ingênuas.

## 11. Sequência recomendada de desenvolvimento

1. Definir o contrato único do JSON de caso, evidências e versões.
2. Construir baseline e modelo calibrado de risco por desfecho.
3. Construir baseline e modelo de severidade com intervalos.
4. Implementar motor financeiro determinístico com parâmetros configuráveis.
5. Implementar política das três ações e respectivos reason codes.
6. Integrar extração e validação documental aos dois processos completos.
7. Construir o cartão explicável do advogado e o fluxo de override.
8. Registrar eventos de decisão, negociação e resultado final.
9. Construir monitoramento de aderência e eficiência.
10. Validar ponta a ponta com casos conhecidos e análise de sensibilidade.

## 12. Premissas que precisam ser definidas

- custo médio e distribuição do custo de defesa;
- honorários, sucumbência, juros e correção;
- custo de negociação;
- alçadas e limites de oferta;
- margem mínima para decidir automaticamente;
- apetite a risco;
- tratamento econômico da extinção;
- baseline atual do banco;
- curva inicial de probabilidade de aceite;
- política após recusa;
- horizonte temporal e valor do dinheiro.

Enquanto esses parâmetros não forem confirmados, a solução deve declarar-se como **estimativa de exposição judicial e simulação econômica sob premissas**, não como previsão exata de ROI.

## 13. Fora do núcleo inicial

- geração integral de petição;
- chatbot jurídico genérico;
- decisão final atribuída ao LLM;
- personalização da recomendação conforme o advogado;
- fraude em grafo ou inteligência externa ampla sem impacto direto na decisão;
- download de grandes corpora jurídicos sem recorte;
- uso de dados demográficos individuais como proxies de risco.

Dados externos podem apoiar etapas específicas: jurisprudência para fundamentação e explicação, DataJud para metadados quando houver vínculo real e bases de reclamação para monitoramento agregado. Eles não substituem o histórico interno nem criam um target econômico confiável.

---

**Estado do documento:** consolidação funcional para guiar desenvolvimento. A função econômica permanece condicionada à definição das premissas listadas na seção 12. Referência de acompanhamento: Beads `enter-fba.8` e memória `enter-motor-decisao-economico`; sincronização da última formulação pendente enquanto o terminal local estiver indisponível.
