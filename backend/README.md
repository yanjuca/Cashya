# Cashya Backend

API do Cashya para despesas pessoais e compartilhadas, construída com FastAPI, SQLAlchemy e SQLite (PostgreSQL em produção). Implementa o contrato descrito em `BACKEND_SPEC.md`: autenticação multi-dispositivo, cartões, despesas com tags, grupos, sincronização offline-first (`sync/batch`) e importação/exportação de backup. O repositório também contém o aplicativo mobile Expo/React Native que consome esta API.

## Visão geral

- Contas com e-mail + senha (Argon2 via `pwdlib`), `accessToken` JWT e `refreshToken` opaco com rotação e revogação.
- Perfil: troca de nome, e-mail (exige senha atual), avatar, senha e exclusão de conta.
- Cartões de crédito/débito com limite, arquivamento e soft delete (despesas vinculadas ficam com `cardId = null`).
- Despesas com `person`, `tags[]`, `paid`, `source`, `cardId`, `groupId`, UUID gerado pelo cliente, soft delete e Last-Write-Wins.
- Grupos para despesas compartilhadas (casal, república, viagem) com saldo por pessoa.
- Sincronização: `POST /sync/batch` (mutations + `serverChanges` + `conflicts`), `since` nas listagens, `import-backup` e `export-backup`.
- Telas do app: `dashboard/summary` (Home/Carteira), `expenses/calendar` (Calendário), `expenses` com filtros (Despesas), `users/me` (Perfil/Configurações).
- Caixa de entrada de transações capturadas de notificações e estatísticas por pessoa/tag/mês.
- E-mails transacionais via SMTP: verificação de endereço, recuperação de senha, lembretes semanais e relatórios mensais com preferências por usuário.
- Todas as rotas em `/api/v1`, envelope `{ success, data, message }`, erros normalizados, OpenAPI em `/docs`.
- CORS configurável, limite de corpo de requisição, rate limit de autenticação e cabeçalhos HTTP de segurança.

## Novidades desta versão (contrato `/api/v1`)

Esta versão adapta o backend ao `BACKEND_SPEC.md` (modelo local-first → nuvem com sincronização) e aos requisitos funcionais do app.

### O que foi adicionado

| Área | Mudança |
| --- | --- |
| Autenticação | `refreshToken` com rotação (`POST /auth/refresh`), `POST /auth/logout`, `deviceName` opcional por sessão. |
| Perfil | `GET/PATCH /users/me`, `POST /users/me/change-password`, `DELETE /users/me`; campos `avatarUrl` e `updatedAt` no usuário. |
| Cartões | Nova entidade `Card` (`/cards`) com limite, marca, tipo, arquivamento, soft delete e `GET /cards/:id/summary`. |
| Despesas | Campos `cardId` e `groupId`; método `PATCH` parcial; filtros `searchText`, `status`, `cardId`, `groupId`, `startDate`, `endDate`; paginação com `totalPages`/`hasNext`; `GET /expenses/calendar`. |
| Grupos | Entidades `Group`/`GroupMember` (`/groups`) para despesas compartilhadas, com saldo por pessoa. |
| Sincronização | `POST /sync/batch` (mutations + `serverChanges` + `conflicts` com Last-Write-Wins), `POST /sync/import-backup`, `GET /sync/export-backup`. |
| Home / Carteira | `GET /dashboard/summary` com limite total, disponível, gasto, pendente, pago e resumo por cartão. |
| Caixa de entrada | `POST /inbox` para enfileirar transações capturadas de notificações. |
| Banco | Migrações `20260921_0002` e `20261114_0003`: cartões, grupos, refresh tokens, verificação de e-mail, preferências e rastreamento de entregas. |

### Mudanças que quebram compatibilidade

| Antes | Agora |
| --- | --- |
| Rotas na raiz (`/auth/login`, `/expenses`, `/sync`, `/inbox`, `/statistics`) | Todas as rotas sob `/api/v1` (configurável por `API_V1_PREFIX`). |
| Login/cadastro retornavam `data.token` | Retornam `data.accessToken`, `data.refreshToken`, `data.tokenType`, `data.expiresIn` e `data.user`. |
| `POST /sync` com `created`/`updated`/`deletedIds` e resposta `pulled` | `POST /sync/batch` com `mutations[]` e resposta `serverChanges`/`conflicts`. |
| `GET /expenses` com `paid=true|false` e `until` | `status=all|pending|paid`; use `startDate`/`endDate` para intervalo e `since` para delta sync. |
| `category_id` na despesa | Removido; use `tags[]`, `cardId` e `groupId`. |
| Rotas `/transactions`, `/categories` e `/budgets` | Removidas (não fazem parte do contrato). A migração 0002 apaga as tabelas `categories` e `budgets`. |
| `DELETE /expenses/:id` retornava só `message` | Retorna `{ id, deletedAt }`. |
| Senha: mínimo 8 caracteres | Mínimo 8 caracteres com letras **e** números. |
| Rate limit em login e cadastro | Também em `refresh`; limites configuráveis por variáveis de ambiente. |
| OpenAPI em `/openapi.json` | `/api/v1/openapi.json` (Swagger continua em `/docs`). |

### Como migrar um ambiente existente

1. Atualize as dependências: `pip install -r requirements.txt` (FastAPI 0.141 e `python-jose` 3.5, que corrige CVEs da 3.3).
2. Adicione `REFRESH_TOKEN_EXPIRE_DAYS` ao `.env` (veja `.env.example`).
3. Rode `alembic upgrade head` (testado com upgrade e downgrade sobre o banco da versão anterior).
4. Atualize o app: o cliente em `services/api/` (raiz do repositório) já usa `/api/v1`, guarda `accessToken`/`refreshToken` e o `services/sync.ts` aplica a resposta de `sync/batch` nos Contexts.
5. Usuários já cadastrados continuam válidos; apenas precisam fazer login novamente para receber um `refreshToken`.

### Mapa de telas do app → endpoints

| Tela | Endpoints |
| --- | --- |
| Login | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` |
| Perfil / Configurações | `GET /users/me`, `PATCH /users/me` (nome, e-mail), `POST /users/me/change-password`, `POST /auth/logout`, `DELETE /users/me` |
| Home / Carteira | `GET /dashboard/summary`, `GET /cards`, `GET /cards/:id/summary`, `POST/PATCH/DELETE /cards/:id` |
| Calendário | `GET /expenses/calendar?month&year`, `GET /expenses?date=YYYY-MM-DD` |
| Despesas | `GET /expenses` (filtros), `POST /expenses`, `PUT/PATCH /expenses/:id`, `PATCH /expenses/:id/toggle-paid`, `DELETE /expenses/:id` |
| Estatísticas | `GET /statistics`, `GET /expenses/by-person`, `GET /expenses/by-tag`, `GET /expenses/monthly-trend` |
| Offline / backup | `POST /sync/batch`, `GET /expenses?since=`, `POST /sync/import-backup`, `GET /sync/export-backup` |

## Estrutura do projeto

```text
Cashya/                        # raiz do repositório = aplicativo Expo/React Native
├── app/, components/, contexts/
├── services/api/              # Cliente TypeScript da API (/api/v1), sessão e conversões
├── services/sync.ts           # Fila offline enviada por POST /sync/batch
├── package.json
└── backend/                   # esta API
    ├── app/
    │   ├── core/             # Configuração, banco, segurança e serialização
    │   ├── models/           # User, Card, Expense, Group, GroupMember, RefreshToken, PendingTransaction, e-mail
    │   ├── routers/          # auth, users, cards, expenses, groups, sync, inbox, dashboard, statistics
    │   ├── schemas/          # Contratos Pydantic (camelCase)
    │   ├── services/         # Regras de negócio (auth, cards, expenses, groups, sync, e-mail)
    │   └── main.py           # Aplicação FastAPI
    ├── migrations/           # Alembic (0001 → 0004)
    ├── tests/                # Testes de API e unitários (pytest)
    ├── .env.example
    ├── Dockerfile
    ├── docker-compose.yml
    ├── requirements.txt
    └── README.md
```

## Requisitos

- Python 3.12 ou superior.
- `pip` e `venv`.
- Docker opcional.

## Instalação local

### Windows PowerShell

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Linux ou macOS

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## Configuração de ambiente

Copie `.env.example` para `.env` e ajuste os valores:

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./cashya.db` | URL de conexão do SQLAlchemy (ex.: `postgresql+psycopg://...`). |
| `SECRET_KEY` | vazio | Chave de assinatura do JWT; exige pelo menos 32 caracteres imprevisíveis. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Vida do `accessToken`, entre 5 e 1440 minutos. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Vida do `refreshToken`, entre 1 e 365 dias. |
| `JWT_ISSUER` / `JWT_AUDIENCE` | `cashya-api` / `cashya-app` | Emissor e público validados no JWT. |
| `CORS_ORIGINS` | `http://localhost:8081,http://127.0.0.1:8081` | Origens permitidas separadas por vírgula. |
| `MAX_REQUEST_BODY_BYTES` | `1048576` | Tamanho máximo do corpo de requisições de escrita. |
| `AUTH_RATE_LIMIT_ATTEMPTS` / `AUTH_RATE_LIMIT_WINDOW_SECONDS` | `10` / `60` | Rate limit por IP em login, cadastro e refresh. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | vazio / `587` | Servidor de saída SMTP; usuário e senha devem ser configurados juntos. |
| `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | vazio / `Cashya` | Endereço e nome do remetente. E-mails ficam desativados até configurar host e remetente. |
| `SMTP_STARTTLS`, `SMTP_USE_SSL` | `true` / `false` | Transporte SMTP; use SSL implícito ou STARTTLS conforme o provedor. |
| `EMAIL_SCHEDULE_HOUR_UTC` | `12` | Hora UTC para processar os lembretes semanais e relatórios mensais. |
| `MONTHLY_REPORT_PROMPT` | mensagem padrão | Texto configurável incluído no relatório mensal. |
| `API_V1_PREFIX` | `/api/v1` | Prefixo de todas as rotas. |
| `ENVIRONMENT`, `EXPOSE_DOCS`, `GLOBAL_RATE_LIMIT_PER_MINUTE`, `REQUEST_SIGNING_SECRET`, `MIN_CLIENT_VERSION`, `TRUST_PROXY_HEADERS`, `HSTS_ENABLED` | ver seção de hardening | Camada anti engenharia reversa. |

Gere uma chave segura com:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Nunca versione `.env`, chaves secretas ou bancos locais.

## Executando a API

```powershell
cd backend
alembic upgrade head
uvicorn app.main:app --reload
```

- Health check: <http://127.0.0.1:8000/api/v1/health> (ou `/`)
- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>
- OpenAPI JSON: <http://127.0.0.1:8000/api/v1/openapi.json>

O startup também cria tabelas/colunas ausentes em bancos SQLite locais, mas em produção execute `alembic upgrade head` como etapa de deploy.

## Docker

A imagem usa build em duas etapas, roda como usuário sem privilégios (`cashya`), tem healthcheck em `/api/v1/health` e grava o SQLite em `/app/data` (volume). O `.dockerignore` impede que `.env` e bancos locais entrem na imagem.

### Com Docker Compose (recomendado)

```powershell
cd backend
Copy-Item .env.example .env   # e preencha SECRET_KEY etc.
docker compose up -d --build
docker compose logs -f api
```

A API fica em <http://127.0.0.1:8000>. Os dados ficam no volume `cashya-data` e sobrevivem a `docker compose down` (use `docker compose down -v` para apagar).

Migrações (deploy em produção ou banco vindo de versão anterior):

```powershell
docker compose run --rm api alembic upgrade head
```

### Só com Docker

```powershell
cd backend
docker build -t cashya-api .
docker run -d --name cashya-api -p 8000:8000 --env-file .env -e DATABASE_URL=sqlite:////app/data/cashya.db -v cashya-data:/app/data cashya-api
```

> No Android Emulator a API continua em `http://10.0.2.2:8000`; em aparelho físico use o IP da máquina na rede local.

## Integração com o aplicativo mobile

O cliente está em `services/api/` (raiz do repositório), já apontando para `/api/v1`, e usa `EXPO_PUBLIC_API_URL` (arquivo `.env.local` na raiz) quando definida:

| Ambiente | URL |
| --- | --- |
| Expo Web / Simulador iOS | `http://127.0.0.1:8000` |
| Emulador Android | `http://10.0.2.2:8000` |
| Celular físico | IP local do computador, como `http://192.168.0.10:8000` |

O app continua offline-first: despesas e cartões ficam no AsyncStorage e cada alteração entra numa fila (`services/sync.ts`) enviada por `POST /sync/batch` quando há conta logada e rede; a mesma chamada traz o que mudou em outros aparelhos. `accessToken`/`refreshToken` ficam no armazenamento seguro do dispositivo (`expo-secure-store`; na Web, no armazenamento do navegador) e a sessão é renovada via `/auth/refresh`.

## Autenticação

Rotas protegidas exigem `Authorization: Bearer <accessToken>`.

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Cria a conta. Body: `email`, `name`, `password` (mín. 8, letras e números), `deviceName?`. |
| `POST` | `/api/v1/auth/login` | Retorna `accessToken`, `refreshToken`, `expiresIn` e `user`. |
| `POST` | `/api/v1/auth/refresh` | Troca `refreshToken` por um novo par (o anterior é revogado; reuso revoga todos). |
| `POST` | `/api/v1/auth/logout` | Revoga o `refreshToken` informado ou, com `allDevices: true`, todos. |
| `POST` | `/api/v1/auth/password-reset/request` | Solicita um código de recuperação; a resposta não revela se o e-mail possui conta. |
| `POST` | `/api/v1/auth/password-reset/confirm` | Confirma `email`, código de 6 dígitos e `newPassword`; invalida sessões existentes. |
| `POST` | `/api/v1/auth/email-verification/request` / `confirm` | Envia e confirma o código de verificação do usuário autenticado. |
| `GET` | `/api/v1/auth/me` | Alias de `/users/me`. |

Resposta de `register`/`login`/`refresh`:

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<opaco>",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "user": { "id": "...", "email": "...", "name": "...", "avatarUrl": null, "emailVerified": false, "emailNotificationsEnabled": true, "emailReportsEnabled": true, "createdAt": "...", "updatedAt": null }
  }
}
```

## Endpoints

### Usuário / Perfil (`/api/v1/users`)

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/users/me` | Perfil do usuário logado. |
| `PATCH` | `/users/me` | Altera `name`, `avatarUrl` ou `email` (este exige `currentPassword`). |
| `POST` | `/users/me/change-password` | `currentPassword` + `newPassword`; encerra as sessões dos outros dispositivos. |
| `GET` / `PATCH` | `/users/me/email-preferences` | Consulta e atualiza `emailNotificationsEnabled` e `emailReportsEnabled`. |
| `DELETE` | `/users/me` | Exclui a conta e todos os dados (exige `password`). |

### Notificações por e-mail

O envio é feito pelo backend via SMTP; não depende do SQL Server Database Mail e não exige migrar o banco SQLite/PostgreSQL. Configure as variáveis `SMTP_*` no ambiente de execução, nunca no código versionado. Os códigos de verificação e recuperação expiram em 15 minutos, são de uso único e ficam armazenados como hash. E-mails financeiros só são enviados para endereços verificados. O usuário pode desativar lembretes e relatórios em Configurações.

Com SMTP configurado, o backend envia um lembrete semanal somente quando existem despesas pendentes, um relatório mensal (inclusive quando não houve despesas), um aviso após o primeiro cartão e mensagens de segurança para recuperação/troca de senha ou e-mail. A entrega agendada é deduplicada por usuário e período, com tentativas limitadas. Em produção, aplique `alembic upgrade head`; o agendador executa em cada instância da API, enquanto a restrição única no banco evita envio repetido entre réplicas.

### Cartões (`/api/v1/cards`)

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/cards?includeArchived=false` | Lista os cartões do usuário. |
| `POST` | `/cards` | Cadastra cartão (`id` do cliente opcional). |
| `GET` | `/cards/:id` | Detalhes. |
| `GET` | `/cards/:id/summary?month&year` | `limit`, `spent`, `pending`, `paid`, `available`, `usagePercent`. |
| `PUT` / `PATCH` | `/cards/:id` | Substitui ou atualiza parcialmente (`limit`, `holderName`, `isArchived`...). |
| `DELETE` | `/cards/:id` | Soft delete; despesas vinculadas ficam com `cardId = null`. |

Campos: `holderName`, `brand` (`visa|mastercard|elo|generic`), `type` (`Credit|Debit`), `lastDigits` (até 4 dígitos), `expiryDate` (`MM/YY`), `limit`, `colorAccent` (hex, padrão `#ff453a`), `isArchived`.

### Despesas (`/api/v1/expenses`)

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/expenses` | Lista paginada. Filtros: `page`, `limit`, `searchText`, `person`, `tag`, `status` (`all|pending|paid`), `cardId`, `groupId`, `startDate`, `endDate`, `since` (delta sync, inclui `deletedAt`), `month`, `year`, `date`. |
| `POST` | `/expenses` | Cria (idempotente quando o `id` do cliente é reenviado). |
| `GET` | `/expenses/:id` | Detalhes. |
| `PUT` / `PATCH` | `/expenses/:id` | Substitui ou atualiza parcialmente. |
| `PATCH` | `/expenses/:id/toggle-paid` | Alterna `paid` e retorna `{ id, paid, updatedAt }`. |
| `DELETE` | `/expenses/:id` | Soft delete (`deletedAt`). |
| `GET` | `/expenses/summary?month&year` | `total`, `paid`, `pending`, `count`, `average`. |
| `GET` | `/expenses/calendar?month&year` | Totais por dia para a tela Calendário. |
| `GET` | `/expenses/by-person`, `/expenses/by-tag`, `/expenses/monthly-trend` | Agrupamentos. |

Regras: `amount > 0` (armazenado como `numeric(12,2)`), `tags` sem duplicatas (máx. 30), `cardId` precisa ser um cartão ativo do usuário, `groupId` precisa ser um grupo do qual o usuário é membro. Despesas de grupo são visíveis a todos os membros.

### Grupos (`/api/v1/groups`)

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` / `POST` | `/groups` | Lista ou cria grupo (criador vira `owner`). |
| `GET` / `PATCH` / `DELETE` | `/groups/:id` | Detalhes, renomear (owner) e excluir (owner; despesas voltam a ser pessoais). |
| `POST` | `/groups/:id/members` | Adiciona membro por `email` (owner). |
| `DELETE` | `/groups/:id/members/:userId` | Owner remove um membro ou o próprio membro sai. |
| `GET` | `/groups/:id/expenses?status&page&limit` | Despesas compartilhadas. |
| `GET` | `/groups/:id/balance` | Totais por pessoa (quem deve o quê). |

### Sincronização e backup (`/api/v1/sync`)

`POST /sync/batch`

```json
{
  "lastSyncTimestamp": "2026-09-20T10:00:00Z",
  "mutations": [
    { "type": "CREATE_EXPENSE", "data": { "id": "uuid", "description": "...", "amount": 10, "person": "...", "date": "..." } },
    { "type": "UPDATE_EXPENSE", "id": "uuid", "data": { "paid": true }, "clientUpdatedAt": "2026-09-21T12:00:00Z" },
    { "type": "DELETE_EXPENSE", "id": "uuid" },
    { "type": "TOGGLE_PAID", "id": "uuid" },
    { "type": "CREATE_CARD", "data": { "...": "..." } },
    { "type": "UPDATE_CARD", "id": "uuid", "data": { "limit": 6000 } },
    { "type": "DELETE_CARD", "id": "uuid" }
  ]
}
```

Resposta: `{ "syncedAt", "applied": [{type,id}], "serverChanges": { "expenses": [...], "cards": [...] }, "conflicts": [{type,id,reason,server}] }`. Conflitos seguem Last-Write-Wins por `updatedAt`: se `clientUpdatedAt` for mais antigo que a versão do servidor, a mutação é rejeitada e a cópia do servidor vem em `server`. `serverChanges` inclui registros com `deletedAt` para propagar exclusões.

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/sync/import-backup` | Recebe o JSON `BackupData` (`version`, `exportedAt`, `cards`, `expenses`) e faz upsert por `id`. |
| `GET` | `/sync/export-backup` | Exporta os dados no mesmo formato. |

### Caixa de entrada (`/api/v1/inbox`)

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` / `POST` | `/inbox` | Lista ou enfileira transação capturada de notificação. |
| `POST` | `/inbox/:id/confirm` | Converte em despesa (`source = notification`). |
| `DELETE` | `/inbox/:id` | Descarta. |

### Dashboard e estatísticas

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/v1/dashboard/summary?month&year&recent` | Home/Carteira: `totalLimit`, `availableLimit`, `totalSpent`, `pending`, `paid`, `cards[]` com resumo e `recentExpenses`. |
| `GET` | `/api/v1/statistics` | Resumo, agrupamentos por pessoa/tag e histórico mensal. |

## Camada anti engenharia reversa (`app/core/hardening.py`)

Um backend público pode ser "mapeado" por quem tenta clonar o app, replicar requisições ou enumerar contas. Esta camada eleva o custo desses ataques. Tudo é configurado por variáveis de ambiente e desligado por padrão em desenvolvimento (exceto headers e rate limit global).

| Defesa | Como funciona | Configuração |
| --- | --- | --- |
| Assinatura de requisições (HMAC-SHA256) | O app envia `X-Cashya-Signature`, `X-Cashya-Timestamp` e `X-Cashya-Nonce`. A assinatura cobre `MÉTODO
PATH
TIMESTAMP
NONCE
SHA256(BODY)` com um segredo compartilhado; requisições sem assinatura, com corpo alterado ou fora da janela de tempo recebem `401 INVALID_SIGNATURE`. Nonces são lembrados para bloquear **replay**. | `REQUEST_SIGNING_SECRET` (≥ 32 chars) no backend e `EXPO_PUBLIC_API_SIGNING_KEY` no app (`signing.ts`). `REQUEST_SIGNATURE_MAX_SKEW_SECONDS` define a janela. |
| Versão mínima do cliente | Builds antigas/vazadas do app são recusadas com `426 UPGRADE_REQUIRED`. O app envia `X-Client-Version` a partir do `app.json`. | `MIN_CLIENT_VERSION=1.2.0` |
| Docs ocultos em produção | `/docs`, `/redoc` e `/api/v1/openapi.json` não existem quando `ENVIRONMENT=production` (ou `EXPOSE_DOCS=false`). | `ENVIRONMENT`, `EXPOSE_DOCS` |
| Rate limit global | Limite por IP em todas as rotas `/api/v1` (além do limite específico de auth). | `GLOBAL_RATE_LIMIT_PER_MINUTE` (0 desliga); `TRUST_PROXY_HEADERS=true` só atrás de proxy confiável. |
| Sem fingerprint / sem vazamento | Header `Server: cashya` no lugar de `uvicorn`; erros inesperados retornam `500 INTERNAL_ERROR` genérico (detalhes só no log); CSP `default-src 'none'`, `X-Robots-Tag: noindex`, `Cross-Origin-Resource-Policy`. | Automático; `HSTS_ENABLED=true` quando houver HTTPS. |
| Anti-enumeração por tempo | O login verifica um hash fictício quando o e-mail não existe, então "usuário inexistente" e "senha errada" demoram o mesmo e respondem igual. | Automático. |

### Como ativar a assinatura

1. Gere um segredo: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
2. Backend: `REQUEST_SIGNING_SECRET=<segredo>` no `.env`.
3. App: `EXPO_PUBLIC_API_SIGNING_KEY=<segredo>` no `.env` do Expo (veja `.env.example` na raiz do app) e gere um novo build.
4. Para rotacionar um segredo vazado, troque os dois valores e publique o app; builds antigas podem ser bloqueadas com `MIN_CLIENT_VERSION`.

### Limites (seja realista)

- O segredo fica dentro do app; alguém com ferramentas de análise consegue extraí-lo. A assinatura barra scripts, replay e clientes genéricos, não um atacante dedicado. Para atestar que o binário é o oficial use **Play Integrity** (Android) / **App Attest** (iOS) — pontos de extensão naturais para o mesmo middleware.
- Rate limit e cache de nonces são em memória (por processo). Com várias réplicas use Redis.
- Sempre sirva a API com HTTPS; sem TLS, nenhuma dessas camadas impede a leitura do tráfego.

## Respostas e erros

Sucesso:

```json
{ "success": true, "data": {}, "message": "Optional message" }
```

Erro:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "amount", "issue": "Input should be greater than 0" }]
  }
}
```

Códigos: `BAD_REQUEST` (400), `UNAUTHORIZED` / `INVALID_SIGNATURE` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `PAYLOAD_TOO_LARGE` (413), `VALIDATION_ERROR` (422), `UPGRADE_REQUIRED` (426), `RATE_LIMITED` (429) e `INTERNAL_ERROR` (500). Datas são ISO 8601 em UTC com sufixo `Z`; valores monetários são números com duas casas.

## Banco de dados e migrações

```powershell
cd backend
alembic upgrade head
```

Revisões: `20260909_0001` (contrato de despesas; num banco vazio cria o schema completo), `20260921_0002` (cartões, grupos, refresh tokens, `card_id`/`group_id`, remoção de categorias/orçamentos), `20261114_0003` (verificação de e-mail, códigos de redefinição e envios) e `20261126_0004` (despesas recorrentes). Para criar uma revisão após alterar os modelos:

```powershell
alembic revision --autogenerate -m "describe schema change"
alembic upgrade head
```

## Testes unitários

A suíte está dividida entre testes de API (requisições HTTP e contrato dos endpoints) e testes unitários dos serviços, regras de negócio, schemas, serialização, segurança e sincronização.

Os testes unitários utilizam um banco SQLite em memória, isolado por teste. O argumento `--confcutdir=tests/unit` impede que a configuração dos testes de API em `tests/conftest.py` seja carregada durante a execução isolada dos testes unitários.

**Executar somente os testes unitários:**

```powershell
python -m pytest --confcutdir=tests/unit -q tests/unit
```

**Executar toda a suíte (testes unitários + testes de API):**

```powershell
python -m pytest -q
```

**Verificar a cobertura de linhas e ramificações:**

Instale a ferramenta de cobertura:

```powershell
python -m pip install pytest-cov
```

Execute:

```powershell
python -m pytest --confcutdir=tests/unit tests/unit --cov=app.services --cov=app.core --cov=app.schemas --cov=app.models --cov-branch --cov-report=term-missing --cov-report=html
```

O relatório HTML é gerado em `htmlcov/index.html`.

A cobertura considera os módulos `services`, `core`, `schemas` e `models`. Os resultados devem ser analisados em conjunto com a qualidade dos casos de teste e das verificações realizadas.

## Segurança e produção

- Senhas com Argon2; política mínima de 8 caracteres com letras e números.
- `accessToken` curto com `iss`/`aud`/`typ` validados; `refreshToken` opaco armazenado apenas como hash SHA-256, com rotação e detecção de reuso.
- Troca de senha revoga todas as sessões; troca de e-mail exige senha atual.
- Toda consulta filtra pelo usuário autenticado (ou pelos grupos dos quais ele participa).
- Rate limit em login/cadastro/refresh, limite de corpo de requisição e cabeçalhos contra MIME sniffing e framing.
- Em produção: HTTPS, PostgreSQL, secrets do provedor e rate limit compartilhado entre réplicas (ex.: Redis).

## Aplicativo mobile

O app fica na raiz do repositório:

```powershell
cd ..
npm install
npm start
```

Comandos disponíveis: `npm run android`, `npm run ios`, `npm run web` e `npm run lint`.

## Licença

Este projeto ainda não possui um arquivo de licença definido. Consulte o mantenedor antes de redistribuir ou utilizar o código fora do projeto.
