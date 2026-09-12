# Divisão de trabalho — três frentes, cinco pessoas

A equipe se organiza em três frentes com distribuição **2 + 1 + 2**. As pessoas abaixo são papéis, ainda sem nomes atribuídos. O acompanhamento de tarefas e status permanece no Beads; este documento define responsabilidades e pontos de integração.

| Frente | Pessoas | Entrega principal |
|---|---:|---|
| Engine de decisão | 2 | Função que transforma as entradas do caso em recomendação explicável |
| Backend e dados | 1 | API, persistência, execução da análise e métricas |
| Frontend e experiência | 2 | Jornada do advogado e acompanhamento dos resultados |

## 1. Engine de decisão

**Pessoa A — extração:** leitura de PDFs, OCR seletivo, extração estruturada, classificação dos fatos, deduplicação e fontes com documento, página e trecho. A aplicação atribui pesos por categoria consultando uma configuração versionada; a LLM não gera confiança por fato.

**Pessoa B — risco e política financeira:** preparação dos dados históricos, modelo de probabilidades de desfecho, estimação de custos, comparação econômica, valor sugerido e confiança final percentual. Esta pessoa conduz com a equipe a definição dos pesos e do método de confiança ainda pendentes.

A frente entrega uma função `run_pipeline(case)` e seus artefatos/configurações. Não precisa implementar endpoints ou telas. O modelo usa metadados e seis flags de disponibilidade, sem validar documentos nem criar cenários de contestação. A saída é acordo ou defesa, com `confidence_percent` entre 0 e 100 quando calculável.

Referência: [arquitetura da engine](architecture_engine.md). Os pesos numéricos e a fórmula de confiança ainda precisam ser definidos; os números dos exemplos não são resultados reais.

## 2. Backend e dados

**Pessoa C — integração e persistência:** cadastro, upload e armazenamento dos documentos; execução assíncrona da função da engine; status da análise; armazenamento do resultado com versões; registro da decisão do advogado, motivo de divergência, negociação e encerramento; consultas e métricas para acompanhamento.

A frente entrega a API e a persistência. A engine chega como função importável; o frontend consome os contratos da API. A decisão do advogado e o aceite do acordo pela parte autora devem ser registrados como eventos distintos.

Referência: [arquitetura da aplicação](ARCHITECTURE.md). Para os campos de confiança e pesos, prevalece o contrato atualizado da engine; adaptar os DTOs correspondentes na implementação.

## 3. Frontend e experiência

**Pessoa D — entrada e acompanhamento:** lista de processos, cadastro, upload, estado da análise, histórico geral e dashboard de resultados, usando métricas fornecidas pelo backend.

**Pessoa E — trabalho no caso:** recomendação, valor sugerido, confiança percentual, fatos e seus pesos, fontes, visualizador de documentos, decisão do advogado, negociação e registro do desfecho.

A frente entrega a interface integrada à API. As duas pessoas podem começar com respostas de exemplo do contrato compartilhado enquanto backend e engine são implementados. Dados simulados devem ser identificados durante o desenvolvimento e não apresentados como resultados reais.

## Contratos e fronteiras

Reservar uma sessão inicial de aproximadamente 30 minutos para fechar o formato dos dados entre as três frentes. Backend conduz o contrato de API; engine define o significado das entradas e saídas; frontend verifica se os campos permitem completar a jornada.

| Interface | Conteúdo acordado |
|---|---|
| Caso → engine | Identificador, metadados, inventário binário, documentos e parâmetros da política |
| Engine → backend | Ação, confiança percentual e versão do método, probabilidades de desfecho, custos, sugestão de acordo, premissas, fatos classificados com pesos/fontes e versões |
| Backend → frontend | Resultado persistido, status da análise, documentos, histórico e métricas |
| Frontend → backend | Cadastro, documentos, ação do advogado, motivo de divergência, negociação e desfecho |

Compartilhar uma resposta de exemplo única entre as frentes. Os nomes dos campos, unidades monetárias, representação das probabilidades, estados e tratamento de campos ausentes devem ser idênticos. Probabilidades judiciais usam a escala 0–1; `confidence_percent` usa 0–100 e admite `null` quando ainda não calculável, conforme a arquitetura da engine.

Cada frente trabalha em sua branch e evita editar arquivos de outra frente sem alinhamento. Alterações de contrato precisam ser comunicadas às três frentes antes de mudar campos consumidos pelas demais.

## Primeira integração

A primeira entrega conjunta é cadastrar um caso, executar uma resposta provisória da engine, mostrar a recomendação e salvar a decisão do advogado. Esse fluxo deve funcionar cedo, sem esperar o modelo definitivo ou o acabamento visual.

Depois, substituir a resposta provisória pela engine real, conectar fontes dos documentos, registrar negociação/desfecho e atualizar as métricas. Verificar os dois casos de exemplo e situações de falha de extração ou dados incompletos. O responsável pelo backend coordena a integração, mas cada frente corrige os problemas do seu componente.

Chatbot e funcionalidades adicionais vêm após o fluxo principal funcionar. A demonstração deve distinguir claramente resultados calculados, premissas configuradas e valores ilustrativos.
