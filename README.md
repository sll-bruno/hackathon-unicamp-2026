# Enter Decision Platform

> Política inteligente de acordos para ações de empréstimo não reconhecido.

A Enter Decision Platform transforma autos, subsídios bancários e histórico
judicial em uma recomendação operacional: **ACORDO ou DEFESA**, com valor
sugerido, confiança, justificativa econômica e evidências verificáveis. O
advogado continua responsável pela decisão e pode seguir ou divergir da
recomendação com motivo registrado.

## Acessos rápidos

> Substitua os três links abaixo antes da entrega final.

- [Assistir à demonstração no YouTube](https://www.youtube.com/watch?v=SUBSTITUIR)
- [Abrir os slides da apresentação](https://SUBSTITUIR-PELO-LINK-DOS-SLIDES)
- [Acessar a aplicação publicada](https://SUBSTITUIR-PELO-LINK-DO-DEPLOY)

Para executar o projeto localmente, consulte o [guia de setup](SETUP.md).

## O problema

O Banco UFMG recebe cerca de 15 mil novos processos por mês. Aproximadamente
5 mil discutem empréstimos que a parte autora afirma não ter contratado. Em
cada processo, o banco e seu escritório externo precisam decidir rapidamente
se é economicamente melhor propor um acordo ou apresentar defesa.

O desafio não termina na recomendação. A política precisa ser compreensível
para o advogado, aplicada de maneira consistente e acompanhada pelo banco para
medir aderência, resultado e impacto financeiro.

## A solução

A plataforma cobre os cinco requisitos centrais do desafio:

| Requisito | Como a plataforma responde |
|---|---|
| Regra de decisão | Combina risco histórico, evidência do processo e comparação econômica para recomendar Acordo ou Defesa. |
| Sugestão de valor | Calcula abertura, oferta-alvo e teto de negociação, respeitando a alçada configurada. |
| Acesso à recomendação | Entrega um workspace para o advogado analisar decisão, confiança, custos, riscos e fontes. |
| Monitoramento de aderência | Registra se o advogado seguiu ou divergiu da recomendação e o motivo da divergência. |
| Monitoramento de efetividade | Registra negociação e desfecho para comparar recomendação, custo esperado e resultado observado. |

### Jornada do advogado

1. Envia o PDF dos autos e, quando disponíveis, os subsídios do banco.
2. Confirma ou corrige os dados extraídos antes de criar o processo.
3. Acompanha as etapas de ingestão, extração, risco, análise financeira e decisão.
4. Recebe a recomendação com confiança, cenários, teses e faixa de negociação.
5. Verifica fatos, contradições e lacunas diretamente no documento, na página e no trecho citados.
6. Consulta o chatbot sobre a recomendação sem sair do contexto do processo.
7. Segue ou diverge da recomendação, registrando sua justificativa.
8. Registra negociação e desfecho para alimentar aderência e efetividade.

## Como a política decide

A saída operacional é sempre **ACORDO** ou **DEFESA**. Baixa confiança funciona
como alerta para revisão humana, não como uma terceira decisão.

```text
Autos e subsídios
        |
        v
Ingestão seletiva e extração rastreável
        |
        +----> fatos, contradições, lacunas e fontes
        |
        v
Risco judicial + severidade da perda
        |
        v
Custo esperado da defesa x custo total do acordo
        |
        v
Recomendação + confiança + faixa de negociação
        |
        v
Decisão humana -> negociação -> desfecho observado
```

### Entradas

- UF, subassunto e valor da causa;
- disponibilidade de contrato, extrato, comprovante de crédito, dossiê,
  demonstrativo da dívida e laudo;
- alegações, pedidos, valores e cronologia extraídos dos documentos;
- evidências favoráveis e contrárias ao banco, contradições e lacunas.

O valor da condenação nunca é usado como entrada da decisão. Ele aparece
somente como alvo histórico para estimar a severidade, evitando vazamento de
informação futura.

### Componentes da decisão

- **Risco histórico:** estima quatro desfechos judiciais a partir de informação
  disponível antes da decisão.
- **Qualidade probatória:** classifica evidências com pesos versionados e
  preserva sua origem.
- **Motor financeiro:** compara o custo esperado da defesa com o custo do
  acordo e calcula uma faixa de negociação.
- **Análise de robustez:** simula 1.000 cenários e reduz a confiança quando os
  sinais divergem, a coorte é pequena ou a extração é incerta.
- **Decisão assistida:** apresenta motivos e teses ao advogado, que mantém a
  palavra final.

## Principais diferenciais

- **Explicabilidade acionável:** cada evidência aponta documento, página e
  trecho, e a citação abre o PDF no ponto correspondente.
- **IA cercada por regras determinísticas:** modelos e LLMs extraem e sintetizam;
  contratos, estados, custos, alçadas e validações permanecem controláveis.
- **Ingestão eficiente:** tenta texto nativo primeiro e reserva OCR para páginas
  sem conteúdo suficiente.
- **Human-in-the-loop real:** decisão do advogado, resposta da parte autora e
  desfecho são eventos distintos e auditáveis.
- **Chatbot com contexto restrito:** responde a partir do snapshot processado e
  das evidências do caso, com citações para as fontes utilizadas.
- **Política versionada:** parâmetros, pesos, prompts e artefatos do modelo
  ficam identificados na recomendação produzida.

## Demonstração incluída

O repositório contém dois casos completos fornecidos para simulação:

- **Caso 1:** conjunto documental completo e recomendação de defesa já
  processada, pronto para explorar evidências e registrar o desfecho.
- **Caso 2:** conjunto parcial de subsídios, pronto para executar a jornada de
  análise e revelar a recomendação de acordo produzida pela engine.

As saídas jurídicas exibidas nesses casos foram geradas pela engine e
persistidas como artefatos de demonstração. A reprodução controlada do progresso
mantém a demo previsível sem alterar fatos, evidências, valores ou recomendação.

## Arquitetura

```text
React + Vite (web)
        |
        | HTTP / JSON
        v
FastAPI (API e workflow)
        |
        +----> SQLite (casos, decisões, conversas e resultados)
        +----> arquivos locais (PDFs e uploads)
        +----> engine Python
                   |
                   +----> extração PDF / OCR seletivo
                   +----> modelo de risco XGBoost
                   +----> scoring e motor financeiro
                   +----> OpenAI para extração e síntese estruturada
```

### Tecnologias

- React 19, TypeScript, Vite, TanStack Query, Recharts e React PDF;
- FastAPI, SQLModel, SQLite e Pydantic;
- XGBoost, scikit-learn, pdfplumber, Tesseract e OpenAI Responses API;
- Docker Compose para execução local;
- Vercel no frontend e Railway no backend da demonstração publicada.

## Estrutura do repositório

```text
.
├── data/                         # PDFs dos dois casos de demonstração
├── src/
│   ├── api/                      # API, persistência, workflow e chatbot
│   ├── contracts/                # contratos compartilhados entre API e engine
│   ├── pipeline/                 # ingestão, risco, finanças e decisão
│   └── web/                      # interface React para advogado e banco
├── .env.example                  # configuração de ambiente do backend/engine
├── docker-compose.yml            # execução local da API
├── pyproject.toml                # pacote e dependências Python
├── README.md                     # apresentação do projeto
└── SETUP.md                      # instruções de execução local
```

## Limitações e premissas

- A disponibilidade de um documento não comprova sua autenticidade.
- A base não fornece curva de aceite, contraproposta, duração do processo,
  honorários separados ou custo real de negociação.
- Custos e alçadas ausentes na base são premissas configuradas e aparecem como
  tais na interface.
- O frontend atual usa dados explicitamente marcados como simulados na tela de
  histórico e nos dashboards visuais; a API já calcula agregados dos eventos
  operacionais persistidos.
- O MVP usa SQLite, um worker e tarefas em processo; não implementa fila durável,
  autenticação ou isolamento entre organizações.
- O chatbot e análises de novos casos fora da reprodução da demo exigem uma
  chave válida da OpenAI.

## Próximos passos

- substituir os conjuntos simulados dos dashboards pelos agregados da API;
- validar custos, alçadas e curva de aceite com dados reais do banco;
- avaliar o modelo continuamente por coorte, UF e qualidade documental;
- adicionar autenticação, autorização, trilha de auditoria expandida e fila
  durável para processamento;
- executar piloto controlado e medir economia, aderência e erro de previsão.

## Execução local

O caminho completo, incluindo requisitos, configuração, inicialização e reset
da demonstração, está em [SETUP.md](SETUP.md).
