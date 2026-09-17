# Cashya Backend

API do Cashya para gerenciamento de despesas pessoais, construída com FastAPI, SQLAlchemy e SQLite. O repositório também contém o aplicativo mobile Expo/React Native que consome esta API.

## Visão geral

O backend oferece:

- Cadastro e autenticação de usuários com JWT.
- Hash de senhas usando Argon2 via `pwdlib`.
- CRUD de despesas e transações.
- Sincronização incremental para o aplicativo mobile.
- Caixa de entrada para transações pendentes.
- Categorias personalizadas e orçamentos mensais.
- Estatísticas por pessoa, tag e mês.
- Análise de gastos, previsão e recomendações de economia.
- Documentação OpenAPI interativa.
- SQLite por padrão, com suporte a bancos compatíveis com SQLAlchemy.
- CORS configurável, limite de requisição, rate limit de autenticação e cabeçalhos HTTP de segurança.

## Estrutura do projeto

```text
Cashya/
├── app/                       # Aplicativo Expo/React Native
├── components/                # Componentes e telas mobile
├── contexts/                  # Estado compartilhado
├── api.ts                    # Cliente TypeScript da API
├── package.json
├── README.md                 # Esta documentação
└── cashya-api/
    ├── app/
    │   ├── core/             # Configuração, banco e segurança
    │   ├── models/           # Modelos SQLAlchemy
    │   ├── routers/          # Rotas HTTP
    │   ├── schemas/          # Schemas Pydantic
    │   ├── services/         # Regras de negócio
    │   └── main.py           # Aplicação FastAPI
    ├── migrations/           # Configuração e versões Alembic
    ├── tests/                # Testes automatizados
    ├── Dockerfile
    ├── requirements.txt
    └── README.md
```

## Requisitos

- Python 3.12 ou superior.
- `pip` e `venv`.
- Git.
- Docker opcional.

O SQLite já está incluído no Python. Para produção, recomenda-se um banco gerenciado e a configuração de `DATABASE_URL` correspondente.

## Instalação local

### Windows PowerShell

```powershell
cd cashya-api
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Linux ou macOS

```bash
cd cashya-api
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## Configuração de ambiente

A aplicação lê `cashya-api/.env` e também aceita variáveis de ambiente do sistema. Crie esse arquivo com:

```dotenv
DATABASE_URL=sqlite:///./cashya.db
SECRET_KEY=troque-por-uma-chave-aleatoria-com-pelo-menos-32-caracteres
ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_ISSUER=cashya-api
JWT_AUDIENCE=cashya-app
CORS_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
MAX_REQUEST_BODY_BYTES=1048576
```

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./cashya.db` | URL de conexão do SQLAlchemy. |
| `SECRET_KEY` | vazio | Chave para assinar JWT; exige pelo menos 32 caracteres imprevisíveis. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Expiração do token, entre 5 e 1440 minutos. |
| `JWT_ISSUER` | `cashya-api` | Emissor validado no JWT. |
| `JWT_AUDIENCE` | `cashya-app` | Público validado no JWT. |
| `CORS_ORIGINS` | `http://localhost:8081,http://127.0.0.1:8081` | Origens permitidas separadas por vírgula. |
| `MAX_REQUEST_BODY_BYTES` | `1048576` | Tamanho máximo do corpo de requisições de escrita. |

Gere uma chave segura com:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Nunca versione `.env`, chaves secretas ou bancos locais. Esses arquivos são protegidos pelo `.gitignore`.

## Executando a API

Com o ambiente virtual ativado e o `.env` criado:

```powershell
cd cashya-api
uvicorn app.main:app --reload
```

Endereços padrão:

- API: <http://127.0.0.1:8000>
- Health check: <http://127.0.0.1:8000/>
- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>
- OpenAPI JSON: <http://127.0.0.1:8000/openapi.json>

O health check retorna:

```json
{
  "status": "ok",
  "service": "cashya-api"
}
```

As tabelas são criadas durante o startup. Para alterações estruturais versionadas, use o Alembic.

## Docker

```powershell
cd cashya-api
docker build -t cashya-api .
docker run --rm -p 8000:8000 --env-file .env -v "${PWD}\data:/app/data" cashya-api
```

Para persistir o SQLite no container:

```dotenv
DATABASE_URL=sqlite:///./data/cashya.db
```

Em produção, forneça secrets por variáveis do ambiente ou pelo provedor de deploy, nunca dentro da imagem.

## Integração com o aplicativo mobile

O cliente está em `api.ts` e utiliza `EXPO_PUBLIC_API_URL` quando definida. Sem ela, os endereços padrão são:

| Ambiente | URL |
| --- | --- |
| Expo Web | `http://127.0.0.1:8000` |
| Simulador iOS | `http://127.0.0.1:8000` |
| Emulador Android | `http://10.0.2.2:8000` |
| Celular físico | IP local do computador, como `http://192.168.0.10:8000` |

Exemplo:

```powershell
$env:EXPO_PUBLIC_API_URL="http://192.168.0.10:8000"
npm start
```

O aplicativo gera credenciais locais do dispositivo, registra o usuário automaticamente e armazena o JWT para as próximas requisições.

## Autenticação

Rotas protegidas exigem:

```http
Authorization: Bearer <token>
```

### Cadastro

```http
POST /auth/register
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "uma-senha-forte",
  "name": "Usuário Cashya"
}
```

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "uma-senha-forte"
}
```

As respostas incluem o token em `data.token`:

```http
GET /auth/me
Authorization: Bearer <token>
```

O JWT valida emissor, audiência, expiração e usuário associado. Login e cadastro possuem rate limit por IP.

## Endpoints

Todas as rotas abaixo, exceto health check, cadastro e login, exigem autenticação.

### Saúde e autenticação

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/` | Verifica se a API está disponível. |
| `POST` | `/auth/register` | Cria usuário e retorna JWT. |
| `POST` | `/auth/login` | Autentica usuário e retorna JWT. |
| `GET` | `/auth/me` | Retorna o usuário autenticado. |

### Despesas

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/expenses` | Lista despesas com filtros e paginação. |
| `POST` | `/expenses` | Cria ou restaura uma despesa. |
| `GET` | `/expenses/{expense_id}` | Consulta uma despesa. |
| `PUT` | `/expenses/{expense_id}` | Atualiza uma despesa. |
| `PATCH` | `/expenses/{expense_id}/toggle-paid` | Alterna o pagamento. |
| `DELETE` | `/expenses/{expense_id}` | Exclui logicamente. |
| `GET` | `/expenses/summary` | Total, pagos, pendentes, quantidade e média mensal. |
| `GET` | `/expenses/by-person` | Agrupa por pessoa. |
| `GET` | `/expenses/by-tag` | Agrupa por tag. |
| `GET` | `/expenses/monthly-trend` | Retorna tendência mensal. |

Filtros de `GET /expenses`: `month`, `year`, `date`, `person`, `tag`, `paid`, `since`, `until`, `page` e `limit`. O limite padrão é 50 e o máximo é 100.

Exemplo de criação:

```bash
curl -X POST http://127.0.0.1:8000/expenses \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Mercado",
    "amount": 125.90,
    "person": "Família",
    "date": "2026-09-11T18:30:00Z",
    "tags": ["alimentação"],
    "paid": true,
    "source": "manual"
  }'
```

Campos: `description` (1-255 caracteres), `amount` (positivo, duas casas decimais), `person` (1-120 caracteres), `date` (ISO 8601), `tags` (até 30), `paid` e `source` (`manual`, `notification` ou `import`). O `id` é opcional e permite sincronização idempotente.

### Sincronização e caixa de entrada

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/sync` | Envia alterações locais e recebe alterações do servidor. |
| `GET` | `/inbox` | Lista transações pendentes. |
| `POST` | `/inbox/{pending_id}/confirm` | Confirma uma pendência como despesa. |
| `DELETE` | `/inbox/{pending_id}` | Descarta uma pendência. |

Payload de sincronização:

```json
{
  "lastSyncedAt": "2026-09-11T15:00:00Z",
  "created": [],
  "updated": [],
  "deletedIds": []
}
```

A resposta contém `serverTime`, `pulled.createdOrUpdated` e `pulled.deletedIds`. Exclusões são lógicas para que clientes offline recebam a remoção na próxima sincronização.

### Transações

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/transactions` | Lista, opcionalmente filtrando `month=YYYY-MM`. |
| `POST` | `/transactions` | Cria uma transação. |
| `GET` | `/transactions/{transaction_id}` | Consulta uma transação. |
| `PATCH` | `/transactions/{transaction_id}` | Atualiza uma transação. |
| `DELETE` | `/transactions/{transaction_id}` | Remove uma transação. |
| `POST` | `/transactions/{transaction_id}/paid` | Alterna o pagamento. |

### Categorias e orçamentos

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/categories` | Lista categorias do usuário. |
| `POST` | `/categories` | Cria uma categoria. |
| `DELETE` | `/categories/{category_id}` | Remove uma categoria. |
| `GET` | `/budgets` | Lista orçamentos com gasto calculado. |
| `POST` | `/budgets` | Cria orçamento mensal. |
| `PATCH` | `/budgets/{budget_id}` | Atualiza orçamento. |
| `DELETE` | `/budgets/{budget_id}` | Remove orçamento. |

### Estatísticas

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/statistics` | Resumo, agrupamentos e histórico mensal. |

## Respostas e erros

Rotas de despesas e sincronização usam envelopes:

```json
{
  "success": true,
  "data": {},
  "message": "Optional message"
}
```

Erros são normalizados assim:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{
      "field": "body.amount",
      "issue": "Input should be greater than 0"
    }]
  }
}
```

Códigos comuns: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `NOT_FOUND` (404), `CONFLICT` (409), `PAYLOAD_TOO_LARGE` (413), `VALIDATION_ERROR` (422) e `RATE_LIMITED` (429).

## Banco de dados e migrações

O banco padrão fica em `cashya-api/cashya.db` e não deve ser versionado. Para aplicar migrações:

```powershell
cd cashya-api
alembic upgrade head
```

Para criar uma revisão após alterar os modelos:

```powershell
alembic revision --autogenerate -m "describe schema change"
alembic upgrade head
```

O startup garante a existência das tabelas, mas em produção prefira executar `alembic upgrade head` como etapa explícita de deploy.

## Testes

```powershell
cd cashya-api
pytest -q
```

Os testes cobrem autenticação, despesas, transações, endpoints de IA e módulos de análise. Para executar grupos específicos:

```powershell
pytest tests/test_expenses_api.py -q
pytest tests/test_ai_modules.py -q
```

## Segurança e produção

- Senhas nunca são armazenadas em texto puro.
- JWT possui expiração, emissor e audiência validados.
- Consultas protegidas filtram recursos pelo usuário autenticado.
- Login e cadastro possuem rate limit em memória.
- Requisições de escrita possuem limite de tamanho.
- Respostas incluem cabeçalhos contra MIME sniffing, framing e uso indevido de recursos do navegador.
- Use `SECRET_KEY` longa e aleatória, diferente entre ambientes.
- Em produção, use HTTPS, banco gerenciado, secrets do provedor e rate limit compartilhado entre réplicas.

## Aplicativo mobile

Para instalar e executar o cliente Expo a partir da raiz:

```powershell
npm install
npm start
```

Comandos disponíveis: `npm run android`, `npm run ios`, `npm run web` e `npm run lint`.

## Licença

Este projeto ainda não possui um arquivo de licença definido. Consulte o mantenedor antes de redistribuir ou utilizar o código fora do projeto.
