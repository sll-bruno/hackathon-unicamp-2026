# HACKATHON UFMG 2026 — Enter AI Challenge

**17 e 18 de Abril de 2026**

> Aplique IA para resolver, em equipe, um problema real que toda grande empresa do Brasil enfrenta.

---

## Premiação

**R$ 10.000** para a equipe vencedora

---

## 1. Contexto

A **Enter** é uma empresa de Enterprise AI — a maior empresa nativa de IA do país — focada em soluções para processos jurídicos cíveis massificados: casos repetitivos em que pessoas físicas processam grandes empresas (ex: consumidor que processa uma companhia aérea por atraso de voo).

Seu produto principal, o **EnterOS**, é um modelo de operação jurídico onde uma empresa centraliza a gestão de todos os seus escritórios de advocacia, aprimorando a qualidade das peças jurídicas e a produtividade dos advogados. O EnterOS é construído sobre agentes de IA que automatizam e agregam inteligência a todas as etapas de um processo judicial — do recebimento da ação até o encerramento do caso.

---

## 2. Problema: Política de Acordos

O **Banco UFMG** recebe, em média, **~15 mil novos processos por mês**. Desses, cerca de **~5 mil** envolvem um cenário específico: a pessoa que está processando o banco alega que **não reconhece a contratação de um empréstimo** — ela afirma estar sofrendo descontos referentes ao pagamento de um empréstimo que nunca contratou.

Diante de cada processo, o Banco precisa tomar uma decisão estratégica: **defender-se no judiciário ou propor um acordo**.

O fluxo atual funciona assim:

1. Um advogado externo recebe o processo pela plataforma da Enter.
2. Na plataforma, ele acessa os **Autos** (petição inicial, procuração, etc.) e os **Subsídios** (documentos do banco: extrato, contrato, comprovante de crédito, etc.).
3. Com base nesses documentos e na política do banco, decide: **defesa ou acordo?**
4. Se optar por acordo, entra em contato com a parte autora para negociar.
5. Após a decisão, reporta: se optou por acordo ou defesa; o valor proposto; e o resultado da negociação.

O desafio é triplo:
- Definir uma **boa política de acordos**
- Garantir que os advogados a sigam de forma **consistente**
- **Monitorar continuamente** os resultados para avaliar se a política está sendo efetiva

---

## 3. Sua Missão

Construir uma solução que:

- **Defina uma política de acordos** para o Banco UFMG em casos de não reconhecimento de contratação de empréstimo
- **Garanta a implementação** dessa política pelo advogado que está analisando cada caso
- **Monitore os resultados** para avaliar se a política de acordos está sendo efetiva

---

## 4. Requisitos da Solução

A solução deve conter, no mínimo:

| # | Requisito |
|---|-----------|
| 1 | **Regra de decisão** — lógica que analise o processo e determine: acordo ou defesa |
| 2 | **Sugestão de valor** — caso a recomendação seja acordo, sugerir qual valor oferecer |
| 3 | **Acesso à recomendação** — meio prático do advogado acessar a recomendação para o caso que está analisando |
| 4 | **Monitoramento de aderência** — forma do banco acompanhar se a política está sendo seguida pelos advogados |
| 5 | **Monitoramento de efetividade** — forma do banco avaliar se a política está gerando os resultados esperados |

> Fique à vontade para usar quaisquer ferramentas e tecnologias.

---

## 5. O Que Você Está Recebendo

Cada equipe receberá:

- **Chave da OpenAI** com créditos carregados
- **Base de dados** (`.csv`) com o resultado de 60.000 sentenças judiciais dos últimos meses do Banco UFMG em casos de não reconhecimento de contratação de empréstimo (número do caso, valor da causa, resultado, valor de condenação)
- **Base de documentos** (subsídios) disponibilizados pelo Banco UFMG nos últimos 12 meses
- **2 pastas de processos exemplo** para simulação, cada uma contendo:
  - Autos na íntegra (petição inicial, procuração e demais documentos)
  - Subsídios do cliente (documentos de defesa do banco)

### Descrição dos Subsídios

| Documento | Descrição |
|-----------|-----------|
| **Contrato** | Contrato firmado entre o Banco UFMG e a parte autora |
| **Extrato** | Extrato da conta corrente da parte autora com o banco |
| **Comprovante de crédito** | Documento regulatório junto ao BACEN atestando a legitimidade da operação |
| **Dossiê** | Verificação de autenticidade das assinaturas e documentos pessoais do contrato |
| **Demonstrativo de evolução da dívida** | Extrato mês a mês do saldo de dívida e pagamentos |
| **Laudo referenciado** | Síntese da operação de crédito (data, valores, prazos, canal de contratação, etc.) |

---

## 6. Formato de Entrega

Cada equipe deve submeter **neste repositório**:

```
├── src/                  # código-fonte da solução
├── data/                 # dados de exemplo (não inclua dados sensíveis)
├── docs/                 # apresentação final e documentação
│   └── presentation.*    # slides ou documento para a apresentação
├── SETUP.md              # instruções de instalação e execução
└── README.md             # este arquivo (pode ser complementado)
```

Além do repositório, submeter:

1. **Repositório no GitHub** com o código-fonte completo
2. **Arquivos auxiliares** necessários para executar a solução (dependências, setup, dados de exemplo)
3. **Vídeo de até 2 minutos** demonstrando o funcionamento da ferramenta do ponto de vista do advogado
4. **Apresentação** (slides ou outro formato) para a apresentação final — máx. 15 min — cobrindo:
   - Explicação da política de acordos (linguagem acessível ao time jurídico)
   - Potencial financeiro da iniciativa
   - Experiência do usuário advogado
   - Arquitetura e solução técnica
   - Limitações conhecidas da solução
   - Próximos passos (considerando 1 mês adicional de desenvolvimento)

---

## 7. Critérios de Avaliação

| # | Critério | Descrição |
|---|----------|-----------|
| 1 | **Leitura do problema** | Entendimento do caso, priorização correta e impacto no negócio |
| 2 | **Criatividade e usabilidade** | Criatividade na abordagem e qualidade da experiência de uso |
| 3 | **Colaboração** | Divisão de responsabilidades, colaboração e clareza na apresentação |
| 4 | **Execução** | Acurácia do output, funcionalidades embarcadas, consistência e viabilidade |
| 5 | **Uso de IA** | Aplicação de IA para acelerar, melhorar ou diferenciar a solução |

---

## Arquitetura da solução

A arquitetura proposta combina extração probatória rastreável, risco judicial, estimação do custo da condenação e comparação financeira entre acordo e defesa. Os fatos dos documentos entram na decisão atual por cenários probatórios e análise de sensibilidade, sem tratar a confiança da LLM como probabilidade de vitória.

Consulte [`docs/architecture_engine.md`](docs/architecture_engine.md) para os fluxos, contratos de entrada e saída, fórmulas e regras de revisão humana.

---

## 8. Prazo

| Evento | Data/Hora |
|--------|-----------|
| **Submissão** | 18/04 às **04:00** (da manhã) |
| **Apresentações finais** | 18/04 às **07:00** |

> Boa sorte — e bom café e/ou energético! ☕

---

## Como Submeter

### 1. Crie o repositório da sua equipe

Acesse [github.com/talismanai/hackathon-ufmg-2026](https://github.com/talismanai/hackathon-ufmg-2026) e clique em **"Use this template" → "Create a new repository"**.

- **Nome do repositório:** `hackathon-ufmg-2026-grupo<N>` — substitua `<N>` pelo número do seu grupo  
  _Exemplo: `hackathon-ufmg-2026-grupo7`_
- **Visibilidade:** `Public`

### 2. Clone e desenvolva

```bash
# Clone o repositório da sua equipe
git clone https://github.com/<seu-usuario>/hackathon-ufmg-2026-grupo<N>.git
cd hackathon-ufmg-2026-grupo<N>

# Configure o ambiente seguindo o SETUP.md
```

### 3. Submeta

Envie a URL do seu repositório público para o formulário de entrega presente no site [hackathon.getenter.ai](https://hackathon.getenter.ai) até **18/04 às 04:00**.



A URL deve seguir o formato:
```
https://github.com/<usuario-ou-org>/hackathon-ufmg-2026-grupo<N>
```
