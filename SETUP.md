# Executar localmente

Este guia inicia a API, a engine e o frontend da Enter Decision Platform em uma
máquina local.

## Resultado esperado

Ao final do setup, estarão disponíveis:

- aplicação: <http://localhost:5173>;
- health check da API: <http://localhost:8000/api/health>;
- documentação OpenAPI: <http://localhost:8000/docs>.

## Opção recomendada: Docker + Node.js

### Pré-requisitos

- Git;
- Docker com o plugin Docker Compose;
- Node.js 20 ou superior com npm;
- chave da OpenAI opcional para o chatbot e análises fora da reprodução da demo.

### 1. Clonar o repositório

```bash
git clone https://github.com/sll-bruno/hackathon-unicamp-2026.git
cd hackathon-unicamp-2026
```

### 2. Configurar o ambiente

```bash
cp -f .env.example .env
```

Para habilitar o chatbot, preencha a chave no arquivo `.env`:

```env
OPENAI_API_KEY=sua_chave_aqui
```

Sem essa chave, os dois casos de demonstração, recomendações persistidas,
documentos e fluxo operacional continuam disponíveis. O chatbot retorna erro
de configuração e análises de novos casos que precisem chamar a OpenAI não são
concluídas.

### 3. Iniciar a API

Em um terminal, na raiz do repositório:

```bash
docker compose up --build
```

A primeira execução constrói a imagem, instala as dependências Python, cria o
banco SQLite e carrega os dois casos de demonstração. Aguarde o health check:

```bash
curl --fail http://localhost:8000/api/health
```

Resposta esperada:

```json
{"status":"ok","database":"ok"}
```

### 4. Iniciar o frontend

Em outro terminal:

```bash
cd src/web
npm ci
npm run dev
```

Abra <http://localhost:5173>. Durante o desenvolvimento, o Vite encaminha as
requisições de `/api` para <http://127.0.0.1:8000>.

## Estado da demonstração

Com `DEMO_SEED=true`, a API prepara dois casos de forma idempotente:

- o primeiro contém uma recomendação de defesa já processada;
- o segundo começa em `DOCUMENTOS_ENVIADOS`, pronto para iniciar a análise.

O banco e os uploads ficam nos volumes Docker `app_db` e `app_storage`. Reiniciar
o container preserva esses dados:

```bash
docker compose restart api
```

Para reconstruir o estado inicial da demonstração, remova os volumes e suba a
API novamente:

```bash
docker compose down -v
docker compose up --build
```

O comando `docker compose down -v` apaga decisões, conversas e uploads locais.

## Execução sem Docker

Use Python 3.11 ou superior. Na raiz do repositório:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
mkdir -p db storage
```

Inicie a API:

```bash
DATABASE_URL=sqlite:///./db/app.db \
STORAGE_DIR=./storage \
DATA_DIR=./data \
DEMO_SEED=true \
ENGINE_MODE=full \
CORS_ORIGINS=http://localhost:5173 \
python -m uvicorn app.main:app --reload --port 8000
```

Depois, inicie o frontend em outro terminal:

```bash
cd src/web
npm ci
npm run dev
```

Para processar PDFs digitalizados nessa modalidade, instale também o Tesseract
com o idioma português. Os PDFs incluídos na demonstração possuem texto nativo.

## Variáveis principais

| Variável | Padrão | Finalidade |
|---|---|---|
| `DATABASE_URL` | `sqlite:////app/db/app.db` no Docker | Banco da API. |
| `STORAGE_DIR` | `/app/storage` no Docker | Uploads persistidos. |
| `DATA_DIR` | `/app/data` no Docker | PDFs dos casos de demonstração. |
| `DEMO_SEED` | `true` | Carrega o estado inicial da demo. |
| `OPENAI_API_KEY` | vazio | Habilita chatbot e chamadas online da engine. |
| `OPENAI_MODEL` | `gpt-5` | Modelo usado pela engine. |
| `OPENAI_CHAT_MODEL` | `gpt-5.6-luna` | Modelo usado pelo chatbot. |
| `ENGINE_MODE` | `full` no Compose | Executa a engine completa. |
| `ENGINE_RISK_MODEL_VERSION` | `risco_v1` | Seleciona o artefato de risco. |
| `CORS_ORIGINS` | `http://localhost:5173` | Origens autorizadas na API. |
| `MAX_UPLOAD_BYTES` | `20971520` | Limite de 20 MB por upload. |

## Comandos úteis

```bash
# Parar os containers sem apagar os dados
docker compose down

# Reconstruir a API após mudanças de dependências
docker compose up --build

# Validar o código Python
source .venv/bin/activate
ruff check src/api src/contracts src/pipeline

# Validar o build do frontend
cd src/web
npm run build
```

## Solução de problemas

### O frontend abre, mas não carrega os processos

Confirme que <http://localhost:8000/api/health> responde e que o frontend foi
iniciado com `npm run dev`. O proxy local é configurado em
`src/web/vite.config.ts`.

### O chatbot informa que a OpenAI não está configurada

Preencha `OPENAI_API_KEY` no `.env` e reinicie a API:

```bash
docker compose restart api
```

### As portas já estão ocupadas

Libere as portas 5173 e 8000 ou altere o mapeamento da API em
`docker-compose.yml` e a URL de destino em `src/web/vite.config.ts`.
