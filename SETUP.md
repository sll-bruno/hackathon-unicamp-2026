# Setup e execução

O MVP contém uma API FastAPI com SQLite, persistência de documentos, fluxo de
decisão e métricas. A engine de decisão é um componente separado e ainda deve
ser conectada pela equipe de IA/dados em `decision_engine.run_pipeline()`.

## Caminho recomendado: Docker

Pré-requisitos: Docker com o plugin Compose e os dois diretórios de casos em
`data/`.

```bash
cp -f .env.example .env
docker compose up --build
```

- API: <http://localhost:8000/api/health>
- OpenAPI: <http://localhost:8000/docs>
- SQLite: volume nomeado `app_db`, montado em `/app/db`
- uploads: volume nomeado `app_storage`, montado em `/app/storage`
- PDFs seedados: `./data`, somente leitura em `/app/data`

O container usa um único worker Uvicorn porque os jobs locais dependem de
`BackgroundTasks` e o banco é SQLite. `docker compose restart api` preserva o
banco e os uploads. O reset explícito da demonstração remove os volumes:

```bash
docker compose down -v
```

Não execute esse comando se precisar conservar decisões ou uploads locais.

## Execução local

Python 3.11 ou superior:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
DATABASE_URL=sqlite:///./db/app.db \
STORAGE_DIR=./storage \
DATA_DIR=./data \
uvicorn app.main:app --reload
```

O banco e `storage/` são criados automaticamente. Não há migrações: o startup
executa `SQLModel.metadata.create_all()`.

## Dados de demonstração

Com `DEMO_SEED=true`, o seed é idempotente pelo número CNJ:

- caso 1: ciclo fechado de acordo, marcado `DEMO_FIXTURE`;
- caso 2: `DOCUMENTOS_ENVIADOS`, pronto para chamar a engine real.

Os PDFs não são copiados ou processados pelo seed; os registros apenas apontam
para `DATA_DIR`. Use `DEMO_SEED=false` para iniciar com o banco vazio.

## Engine

A API envia o contrato `contracts.pipeline.CaseInput` e valida a resposta como
`PipelineOutput`. O backend não calcula pesos, probabilidades, confiança, custo
esperado ou oferta. Se a engine ainda não estiver implementada, o job termina
como `FAILED`, o caso volta para `DOCUMENTOS_ENVIADOS` e pode ser reenviado.

Cada reanálise anterior à decisão cria uma recomendação imutável e marca apenas
a nova como atual. Jobs `QUEUED` ou `RUNNING` encontrados após restart são
marcados como falhos e podem ser repetidos.

## Chatbot

Defina `OPENAI_API_KEY` para habilitar `POST /api/cases/{id}/chat/messages`.
O modelo padrão é configurado por `OPENAI_MODEL`. O chatbot recebe somente a
recomendação atual, evidências e as 20 mensagens recentes; PDFs e caminhos
locais nunca são enviados. Sem chave, a API retorna `503`; falha da OpenAI
retorna `502`.

## Validação e smoke test

```bash
ruff check src/api src/contracts src/pipeline
./scripts/smoke_backend.sh
```

O smoke test constrói o container, verifica health, seeds e download de PDF,
reinicia a API e confirma que os IDs persistiram. Ele deixa a API em execução
para inspeção.

## Limitações deliberadas do hackathon

- sem autenticação ou múltiplos perfis;
- sem Alembic, Redis, Celery ou múltiplos workers;
- dinheiro em `float`;
- sem OCR no backend e sem leitura de PDFs pelo chatbot;
- sem feedback por evidência, alertas avançados ou streaming do chat;
- `BackgroundTasks` não é uma fila durável: jobs interrompidos falham com retry
  manual, sem retomada automática.

## Frontend

```bash
cd src/web
npm ci
npm run dev
```

O Vite encaminha `/api` para a API local. `npm run build` valida o frontend.

## Deploy: Railway + Vercel

A implantação do hackathon mantém o mesmo container do desenvolvimento:

```text
Vercel (React/Vite) -> HTTPS -> Railway (FastAPI) -> volume /app/persist
                                                   |- app.db
                                                   `- storage/
```

### Backend na Railway

Crie um serviço a partir da raiz deste repositório e configure:

- Dockerfile: `src/api/Dockerfile`;
- health check: `/api/health`;
- domínio público HTTPS;
- exatamente uma réplica;
- volume persistente único montado em `/app/persist`.

Variáveis do serviço:

```env
DATABASE_URL=sqlite:////app/persist/app.db
STORAGE_DIR=/app/persist/storage
DATA_DIR=/app/data
DEMO_SEED=true
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5
CORS_ORIGINS=https://SEU-PROJETO.vercel.app
MAX_UPLOAD_BYTES=20971520
```

O `PORT` é injetado pela Railway e já é consumido pelo comando da imagem. Os
11 PDFs de `data/` entram na imagem como arquivos seedados somente para leitura;
CSVs e planilhas são excluídos do contexto Docker. SQLite e uploads ficam no
volume e sobrevivem a restart e novo deploy.

Com a Railway CLI, depois de vincular o projeto e o serviço, o smoke remoto é:

```bash
./scripts/smoke_deployed.sh https://SEU-SERVICO.up.railway.app
```

Não configure autoscaling ou múltiplas réplicas: o serviço usa SQLite, um único
worker Uvicorn e jobs locais. Um serviço Railway com volume pode ter uma breve
indisponibilidade durante redeploy; isso é aceitável para a demonstração.

### Frontend na Vercel

Importe o mesmo repositório e use `src/web` como **Root Directory**. O
`vercel.json` desse diretório já define Vite, `npm run build`, saída `dist` e o
fallback da SPA. Configure em Production e Preview:

```env
VITE_API_URL=https://SEU-SERVICO.up.railway.app
```

Depois do primeiro deploy da Vercel, copie seu domínio definitivo para
`CORS_ORIGINS` na Railway. Para aceitar mais de uma origem, separe-as por
vírgulas, por exemplo o domínio de produção e um domínio de preview estável.

Ordem recomendada: Railway, domínio da API, Vercel, domínio do frontend, ajuste
final de CORS e smoke remoto.

### Ambiente de demonstração atual

- frontend: <https://enter-hackathon-unicamp.vercel.app>;
- API: <https://api-production-d8e3.up.railway.app/api/health>;
- OpenAPI: <https://api-production-d8e3.up.railway.app/docs>.

O primeiro deploy foi enviado pelas CLIs a partir da árvore de trabalho local.
A conexão automática da Vercel com `AndreiQP/hackathon-unicamp-2026` não foi
autorizada pela integração GitHub da conta atual. Até esse acesso ser liberado
e a branch ser publicada, novos deploys podem ser enviados manualmente:

```bash
railway up --detach --service api
npx --yes vercel@latest deploy src/web --prod --yes
```

`OPENAI_API_KEY` ainda precisa ser cadastrada como variável selada no serviço
Railway para habilitar o chatbot. A ausência dessa chave não afeta health,
casos, documentos, decisões ou dashboard.
