# Setup e execução

Base mínima para desenvolver as três frentes. Não há dados simulados, modelo treinado, banco configurado ou fluxo de negócio implementado.

## Pré-requisitos

- Python 3.11 ou superior.
- Node.js 22 ou superior e npm.

Execute os comandos a partir da raiz do repositório.

## Backend e engine

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .
uvicorn app.main:app --reload
```

API: http://127.0.0.1:8000/api/health

Documentação: http://127.0.0.1:8000/docs

A engine é importável com `from decision_engine import run_pipeline`, mas a função lança `NotImplementedError` até ser implementada. Os contratos ficam em `contracts.pipeline`.

## Frontend

Em outro terminal:

```bash
cd src/web
npm ci
npm run dev
```

Frontend: http://localhost:5173. O Vite encaminha `/api` para a API local.

```bash
npm run build
```

O build verifica TypeScript e gera os arquivos em `src/web/dist/`.

## Organização

- `src/pipeline/`: extração, risco, financeiro e treinamento — duas pessoas.
- `src/api/`: API, serviços, modelos e monitoramento — uma pessoa.
- `src/web/`: frontend — duas pessoas.
- `src/contracts/`: contratos compartilhados; alinhar alterações entre as frentes.

`requirements.txt` mantém as dependências da análise exploratória anterior. Para a base da aplicação, use `pip install -e .`.

Nenhuma chave externa é necessária para iniciar a base. A configuração de OpenAI, banco e armazenamento será adicionada pelas frentes quando essas integrações forem implementadas. Não versionar `.env`, dados privados ou dependências instaladas.
