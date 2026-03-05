# Azure Deployment Guide — Market4U

> **Complete production deployment and connectivity guide for the Market4U marketplace application on Microsoft Azure.**

---

## Table of Contents

1. [Required Azure Services](#section-1--required-azure-services)
2. [Azure Architecture Diagram](#section-2--azure-architecture-diagram)
3. [Azure SQL Setup](#section-3--azure-sql-setup)
4. [Azure Storage Setup](#section-4--azure-storage-setup)
5. [Environment Variables Configuration](#section-5--environment-variables-configuration)
6. [Security Best Practices](#section-6--security-best-practices)
7. [Monitoring & Logging](#section-7--monitoring--logging)
8. [Deployment Process](#section-8--deployment-process)
9. [Production Readiness Checklist](#section-9--production-readiness-checklist)

---

## Section 1 — Required Azure Services

### 1. Azure Static Web Apps

| Property | Value |
|----------|-------|
| **Purpose** | Hosts the React 19 + TypeScript + Vite + Tailwind PWA frontend and serves as the unified entry point that proxies `/api/*` requests to the embedded Azure Functions backend |
| **Why required** | Provides zero-configuration global CDN, free SSL, automatic PR preview environments, and native integration with Azure Functions v4 without cross-origin issues |
| **Plan** | Free tier is sufficient to start; upgrade to Standard for custom authentication, SLA guarantees, and private endpoints |
| **Key configuration** | `app_location: dist`, `api_location: api`, `skip_app_build: true` (build happens in CI), `apiRuntime: node:20` in `staticwebapp.config.json` |

### 2. Azure Functions (v4, Node.js TypeScript)

| Property | Value |
|----------|-------|
| **Purpose** | Runs the entire API surface: authentication (`/api/auth/*`), ads CRUD (`/api/ads/*`), image upload (`/api/upload`), messaging (`/api/messages/*`), admin (`/api/admin/*`), and health check (`/api/health`) |
| **Why required** | Serverless compute eliminates the need to manage servers. Azure Functions v4 with the Node.js TypeScript model is already configured in `api/` |
| **Key configuration** | Node.js runtime 20, `host.json` sets function timeout and logging; `FUNCTIONS_WORKER_RUNTIME=node` |

### 3. Azure SQL Database

| Property | Value |
|----------|-------|
| **Purpose** | Relational database for all persistent data: users, ads, categories, messages, notifications, and admin tables |
| **Why required** | The backend uses `mssql` (v12) with connection pooling; schema is defined in `api/sql/init.sql` |
| **Key configuration** | Basic (5 DTU) is sufficient for development; scale to Standard S1+ for production traffic. Enable **Transparent Data Encryption** (on by default) |

### 4. Azure Storage Account (Blob Storage)

| Property | Value |
|----------|-------|
| **Purpose** | Stores ad product images uploaded via the `POST /api/upload` endpoint using `@azure/storage-blob` |
| **Why required** | The upload function writes blobs to a container whose name is read from `AZURE_STORAGE_CONTAINER`. A missing connection string causes `POST /api/upload` to return HTTP 500 |
| **Key configuration** | Standard LRS is cheapest. Container `product-images` with Blob-level public read access (images are served directly by URL). Enable soft delete for accidental-deletion recovery |

### 5. Azure Application Insights

| Property | Value |
|----------|-------|
| **Purpose** | Distributed tracing, performance monitoring, error tracking, and custom metrics for both the Static Web App frontend and the Azure Functions backend |
| **Why required** | The backend already imports `applicationinsights` (v3.13). Setting `APPLICATIONINSIGHTS_CONNECTION_STRING` activates automatic request/dependency/exception collection |
| **Key configuration** | Create an Application Insights workspace-based resource. Copy the **Connection String** (not the Instrumentation Key) into application settings |

### 6. Azure Cache for Redis

| Property | Value |
|----------|-------|
| **Purpose** | Distributed rate-limit store shared across all horizontally-scaled Function App instances. Without Redis, each instance has its own in-memory counter and the rate limit can be bypassed by hitting different instances |
| **Why required** | `ioredis` (v5.10) is already a production dependency. The `RATE_LIMIT_REDIS_URL` environment variable activates the distributed store. In-memory fallback is used for local development only |
| **Key configuration** | Azure Cache for Redis — **Basic C0** for development, **Standard C1** for production. Use TLS (`rediss://`) on port 6380. Copy the primary connection string in ioredis URL format |

### 7. Azure Key Vault

| Property | Value |
|----------|-------|
| **Purpose** | Central secrets store for `AUTH_SECRET`, connection strings, API keys, and other sensitive values. Replaces plain-text application settings |
| **Why required** | Prevents secrets from appearing in GitHub Action logs, deployment outputs, or Azure Portal browser history. Enables secret rotation without redeployment |
| **Key configuration** | Grant the Static Web App's **system-assigned Managed Identity** a **Key Vault Secrets User** role. Reference secrets using `@Microsoft.KeyVault(SecretUri=...)` syntax in Application Settings |

### 8. Azure CDN / Front Door (Optional but Recommended)

| Property | Value |
|----------|-------|
| **Purpose** | Global content delivery, DDoS protection, WAF rules, custom domain with managed TLS, and geo-routing |
| **Why required** | The built-in Static Web Apps CDN is sufficient at launch. Azure Front Door Premium adds WAF, rate limiting at the edge, and private link to the backend, all of which are valuable once traffic grows |
| **Key configuration** | Create an Azure Front Door profile with the Static Web App hostname as origin. Enable WAF policy with OWASP 3.2 ruleset in **Prevention** mode |

---

## Section 2 — Azure Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser / PWA                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               Azure CDN / Front Door (optional)                  │
│   • Global edge caching    • WAF / DDoS protection              │
│   • Custom domain + TLS    • Geo-routing                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Azure Static Web Apps                          │
│   • Serves React 19 + Vite + Tailwind PWA (dist/)              │
│   • Routes /api/* → embedded Azure Functions                    │
│   • Automatic SSL  •  PR preview environments                   │
└───────────────┬─────────────────────────────────────────────────┘
                │ /api/* (same-origin proxy)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Azure Functions v4 (Node.js)                   │
│   POST /api/auth/*    GET|POST /api/ads/*                       │
│   POST /api/upload    GET|POST /api/messages/*                  │
│   GET  /api/health    GET|POST /api/admin/*                     │
└────────┬──────────────────────┬──────────────────────┬──────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐
│  Azure SQL DB   │  │  Azure Blob       │  │ Azure Cache Redis  │
│  (mssql v12)   │  │  Storage          │  │ (rate limiting)    │
│                 │  │  product-images   │  │                    │
│  • Users        │  │  container        │  │  • Distributed     │
│  • Ads          │  │                   │  │    rate limit      │
│  • Messages     │  │  • Ad images      │  │    counters        │
│  • Notifications│  │  • Public read    │  │                    │
└─────────────────┘  └──────────────────┘  └────────────────────┘

                 ┌────────────────────────────────────────┐
                 │  Cross-cutting Services (all layers)    │
                 │                                        │
                 │  ┌──────────────────────────────────┐  │
                 │  │   Azure Application Insights      │  │
                 │  │   • Request tracing               │  │
                 │  │   • Error tracking                │  │
                 │  │   • Performance metrics           │  │
                 │  └──────────────────────────────────┘  │
                 │                                        │
                 │  ┌──────────────────────────────────┐  │
                 │  │   Azure Key Vault                 │  │
                 │  │   • AUTH_SECRET                   │  │
                 │  │   • Connection strings            │  │
                 │  │   • API keys                      │  │
                 │  └──────────────────────────────────┘  │
                 └────────────────────────────────────────┘
```

### Data Flow

1. **User request** arrives at CDN / Front Door (or directly at Static Web Apps).
2. **Static files** (HTML, JS, CSS, service worker) are served from the CDN edge — no round-trip to the origin.
3. **API requests** (`/api/*`) are proxied by Static Web Apps to the co-deployed Azure Functions. The same-origin proxy means no CORS headers are needed and cookies flow naturally.
4. **Azure Functions** validate the JWT (`AUTH_SECRET`), then query **Azure SQL Database** via `mssql` connection pool or write/read blobs from **Azure Blob Storage**.
5. **Rate limiting** counters are stored in **Azure Cache for Redis** so all Function instances share the same limits.
6. **Application Insights** automatically captures every HTTP request, SQL dependency call, and unhandled exception via the `applicationinsights` SDK.
7. **Key Vault** references in Application Settings are resolved at runtime by the Functions host using the Managed Identity — the secret value is never stored in plaintext.

---

## Section 3 — Azure SQL Setup

### Step 1 — Create a Resource Group

```bash
az group create \
  --name Market4U-RG \
  --location uaenorth     # UAE North — closest region to Afghanistan
```

### Step 2 — Create the SQL Server

```bash
az sql server create \
  --name market4u-sql-<unique-suffix> \
  --resource-group Market4U-RG \
  --location uaenorth \
  --admin-user market4uadmin \
  --admin-password "<YourStrongPassword>"
```

> **Recommended:** Enable **Microsoft Entra-only authentication** and disable SQL authentication after initial setup to remove the password-based attack surface (see Managed Identity section below).

### Step 3 — Create the Database

```bash
az sql db create \
  --resource-group Market4U-RG \
  --server market4u-sql-<unique-suffix> \
  --name Market4U \
  --service-objective Basic   # ~$5/month; upgrade to S1 for production
```

**Best performance settings:**

| Setting | Value | Reason |
|---------|-------|--------|
| **Service tier** | Standard S1 (for production) | Consistent DTU allocation; upgrade to General Purpose vCore for auto-scaling |
| **Collation** | `SQL_Latin1_General_CP1_CI_AS` (default) | Compatible with the `init.sql` schema |
| **Max size** | 250 GB | Default; sufficient for most marketplace workloads |
| **Backup LTR** | Weekly / Monthly | Protects against accidental data loss |
| **Read replica** | Not required at launch | Add a geo-replica when read traffic grows |

### Step 4 — Configure Firewall Rules

```bash
# Allow all Azure services (required for Azure Functions)
az sql server firewall-rule create \
  --resource-group Market4U-RG \
  --server market4u-sql-<unique-suffix> \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Allow your developer workstation (replace with your IP)
az sql server firewall-rule create \
  --resource-group Market4U-RG \
  --server market4u-sql-<unique-suffix> \
  --name DeveloperIP \
  --start-ip-address <your-ip> \
  --end-ip-address <your-ip>
```

> **Production hardening:** Use **Private Endpoint** instead of a public firewall rule so Azure Functions connect over the VNet without exposing the SQL server to the internet.

### Step 5 — Run the Schema Script

Use **Azure Data Studio**, **SQL Server Management Studio**, or the Azure Portal Query Editor:

```sql
-- File: api/sql/init.sql
-- Run this against the Market4U database to create all tables and seed data
```

1. Open the Azure Portal → **SQL databases** → `Market4U` → **Query editor (preview)**
2. Authenticate with the SQL admin credentials
3. Paste the full contents of `api/sql/init.sql` and click **Run**

### Step 6 — Connection String Configuration

The backend reads the connection string via environment variable (first match wins):

```
SqlConnectionString   →   SQLCONNECTIONSTRING   →   AZURE_SQL_CONNECTION_STRING
```

**ADO.NET format (SQL authentication):**

```
Server=tcp:<server>.database.windows.net,1433;
Initial Catalog=Market4U;
Persist Security Info=False;
User ID=market4uadmin;
Password=<YourStrongPassword>;
MultipleActiveResultSets=False;
Encrypt=True;
TrustServerCertificate=False;
Connection Timeout=30;
ApplicationName=market4u-api;
```

> **Note:** `Connection Timeout=30` is in seconds in the connection string; `db.ts` maps this to `connectionTimeout: 30000` milliseconds internally.

### Connection Pooling

The `mssql` library uses connection pooling by default. Key pool settings configured in `db.ts`:

| Setting | Value | Notes |
|---------|-------|-------|
| `pool.max` | 10 | Maximum simultaneous connections |
| `pool.min` | 0 | Allow pool to drain when idle |
| `pool.idleTimeoutMillis` | 30000 | Release idle connections after 30 s |
| `connectionTimeout` | 30000 | Abort connection attempt after 30 s |
| `requestTimeout` | 15000 | Abort query after 15 s |

### Secure Authentication — Managed Identity (Recommended)

Using Managed Identity removes all SQL passwords from the configuration surface.

**Step 1 — Enable system-assigned identity on the Static Web App:**
```bash
az staticwebapp identity assign \
  --name market4u-app \
  --resource-group Market4U-RG \
  --system-assigned
```

**Step 2 — Create a contained database user for the identity:**
```sql
-- Run in the Market4U database
CREATE USER [market4u-app] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [market4u-app];
ALTER ROLE db_datawriter ADD MEMBER [market4u-app];
```

**Step 3 — Use the `@azure/identity` DefaultAzureCredential in `db.ts`:**
```typescript
import { DefaultAzureCredential } from '@azure/identity';

const credential = new DefaultAzureCredential();
const tokenResponse = await credential.getToken(
  'https://database.windows.net/.default'
);
config.options = { token: tokenResponse.token };
```

**Connection string without password (Managed Identity):**
```
Server=tcp:<server>.database.windows.net,1433;
Initial Catalog=Market4U;
Authentication=Active Directory Managed Identity;
Encrypt=True;
```

---

## Section 4 — Azure Storage Setup

### Step 1 — Create the Storage Account

```bash
az storage account create \
  --name market4uimages<suffix>  \  # lowercase, 3-24 chars, globally unique
  --resource-group Market4U-RG \
  --location uaenorth \
  --sku Standard_LRS \
  --kind StorageV2 \
  --https-only true \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access true    # required for direct-URL image serving
```

### Step 2 — Create the Blob Container

```bash
az storage container create \
  --name product-images \
  --account-name market4uimages<suffix> \
  --public-access blob               # blob = anonymous read, no list
```

### Step 3 — Retrieve the Connection String

```bash
az storage account show-connection-string \
  --name market4uimages<suffix> \
  --resource-group Market4U-RG \
  --query connectionString \
  --output tsv
```

Store the output as the `AZURE_STORAGE_CONNECTION_STRING` secret.

### Environment Variables

| Variable | Example Value | Where Set |
|----------|---------------|-----------|
| `AZURE_STORAGE_CONNECTION_STRING` | `DefaultEndpointsProtocol=https;AccountName=market4uimages...` | Azure Static Web App → Configuration, GitHub Secrets |
| `AZURE_STORAGE_CONTAINER` | `product-images` | Azure Static Web App → Configuration, GitHub Secrets |

### SAS Token Usage

The `POST /api/upload` endpoint in the Functions backend generates a short-lived **Service SAS** per upload rather than exposing the account key to the client. This limits the blast radius if a token is leaked.

```typescript
// Conceptual — the backend generates a SAS URL the client uses directly
const sasUrl = await generateBlobSasUrl(containerClient, blobName, {
  expiresOn: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
  permissions: BlobSASPermissions.parse('cw'),       // create + write
});
```

### File Security Best Practices

| Practice | Implementation |
|----------|----------------|
| **Content-type validation** | Validate `Content-Type` header on the server side before writing the blob; reject anything that is not `image/jpeg`, `image/png`, `image/webp`, or `image/gif` |
| **File size limit** | Enforce a max upload size (e.g. 10 MB) in the Functions middleware before streaming to Blob Storage |
| **Filename sanitization** | Generate a UUID-based blob name; never use the original client-supplied filename as the blob path |
| **Virus scanning** | Enable **Microsoft Defender for Storage** which scans new blobs and quarantines malware within seconds |
| **CORS** | Configure CORS on the Storage account to allow only your Static Web App hostname |
| **Soft delete** | Enable blob soft-delete with a 7-day retention period to recover accidentally deleted images |

### Cost Optimization

- **LRS** (Locally Redundant Storage) is cheapest; switch to **ZRS** for production resilience.
- Enable **Storage lifecycle management** to delete blobs older than X days for rejected/deleted ads.
- Use **Blob tiers**: move old blobs to Cool or Archive tier if rarely accessed.

---

## Section 5 — Environment Variables Configuration

### Frontend Variables (`VITE_*`)

These are inlined at **build time** by Vite — they are not runtime secrets. Never put sensitive values in `VITE_*` variables.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_API_BASE_URL` | ✅ | `/api` | Base URL for all API calls. Must be `/api` in production so requests are routed through the Static Web Apps same-origin proxy. Setting this to an absolute `azurewebsites.net` URL bypasses SWA auth middleware and causes CORS/401 errors |
| `VITE_USE_MOCK_DATA` | ❌ | unset | Set to `false` to use the real database. Omit or set to `true` for the demo/mock mode. **Never set to `true` in a production build** — `vite.config.ts` throws a build error if this is detected |
| `VITE_DEBUG_AUTH` | ❌ | `false` | Enables console auth diagnostics. Never enable in production unless actively debugging a live incident |

### Backend Variables

These are read at **runtime** by Azure Functions.

| Variable | Required | Purpose |
|----------|----------|---------|
| `SqlConnectionString` | ✅ | Azure SQL connection string (canonical name read first by `db.ts`). Also accepts `SQLCONNECTIONSTRING` or `AZURE_SQL_CONNECTION_STRING` |
| `AUTH_SECRET` | ✅ | JWT signing/verification secret. Minimum 32 characters. Generate with `openssl rand -hex 32`. **All instances must share the same value** — mismatched secrets cause 401 on every authenticated request |
| `AZURE_STORAGE_CONNECTION_STRING` | ✅ | Blob Storage connection string for image uploads |
| `AZURE_STORAGE_CONTAINER` | ✅ | Blob container name (e.g. `product-images`) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Recommended | Application Insights connection string. Activates distributed tracing and error reporting |
| `GEMINI_API_KEY` | Optional | Google Gemini AI API key for AI-assisted features |
| `RATE_LIMIT_REDIS_URL` | Recommended | ioredis URL for the distributed rate-limit store (`rediss://:<key>@<host>.redis.cache.windows.net:6380`). Without this, in-memory rate limiting is used, which does not work across multiple Function instances |
| `AUTH_DIAG_ENABLED` | ❌ | Set to `true` to expose `GET /api/auth/diag`. Disable in production |
| `DIAG_ALLOWLIST` | ❌ | Comma-separated allowed `X-Diag-Allowlist` header values for the diag endpoint |

### Where to Configure

#### Azure Static Web Apps Application Settings

Go to: **Azure Portal → Static Web Apps → market4u-app → Configuration → Application settings**

Add every backend variable listed above. These are synced to the embedded Functions host at deploy time.

> ⚠️ **Important:** `VITE_*` variables in Application Settings are only used if you trigger a new build from Azure. Since CI builds are done in GitHub Actions (`skip_app_build: true`), the `VITE_*` values must be set as **GitHub Secrets** (see below).

#### GitHub Secrets

Go to: **GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Maps To |
|-------------|---------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Static Web App deployment token |
| `AUTH_SECRET` | JWT secret |
| `SqlConnectionString` | SQL connection string (or `SQLCONNECTIONSTRING`) |
| `AZURE_SQL_CONNECTION_STRING` | SQL connection string alias |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob Storage connection string |
| `AZURE_STORAGE_CONTAINER` | Blob container name |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights connection string |
| `GEMINI_API_KEY` | Gemini AI key |
| `VITE_API_BASE_URL` | `/api` |

> The CI workflow validates that `AUTH_SECRET`, `SqlConnectionString`, `AZURE_STORAGE_CONNECTION_STRING`, and `AZURE_STORAGE_CONTAINER` are present and non-empty before every deploy. A missing or placeholder value causes the workflow to fail before any deployment token is written to Azure.

#### Local Development (`.env` file)

Copy `.env.example` to `.env` in the repository root:

```bash
cp .env.example .env
```

Copy `api/local.settings.json.example` to `api/local.settings.json`:

```bash
cp api/local.settings.json.example api/local.settings.json
```

Fill in real values for local development. These files are git-ignored and must never be committed.

---

## Section 6 — Security Best Practices

### Use Azure Key Vault for Secrets

Store `AUTH_SECRET`, connection strings, and API keys in Key Vault instead of Application Settings plaintext:

```bash
# Create Key Vault
az keyvault create \
  --name market4u-kv \
  --resource-group Market4U-RG \
  --location uaenorth \
  --enable-rbac-authorization true

# Store a secret
az keyvault secret set \
  --vault-name market4u-kv \
  --name AuthSecret \
  --value "$(openssl rand -hex 32)"

# Grant the Static Web App's Managed Identity read access
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee <managed-identity-principal-id> \
  --scope /subscriptions/<sub>/resourceGroups/Market4U-RG/providers/Microsoft.KeyVault/vaults/market4u-kv
```

Reference the secret in Application Settings:

```
AUTH_SECRET = @Microsoft.KeyVault(SecretUri=https://market4u-kv.vault.azure.net/secrets/AuthSecret/)
```

### Use Managed Identity Instead of Connection Strings

- Enable **system-assigned Managed Identity** on the Static Web App.
- Grant the identity `db_datareader` + `db_datawriter` roles on the SQL database (see Section 3).
- Grant the identity `Storage Blob Data Contributor` on the Storage Account to avoid storing the account key.

```bash
az role assignment create \
  --role "Storage Blob Data Contributor" \
  --assignee <managed-identity-principal-id> \
  --scope /subscriptions/<sub>/resourceGroups/Market4U-RG/providers/Microsoft.Storage/storageAccounts/market4uimages<suffix>
```

### Enable HTTPS Only

Both the Static Web App and Storage Account are HTTPS-only by default. Enforce at the Storage level:

```bash
az storage account update \
  --name market4uimages<suffix> \
  --resource-group Market4U-RG \
  --https-only true \
  --min-tls-version TLS1_2
```

### Configure Rate Limiting

Set `RATE_LIMIT_REDIS_URL` to an Azure Cache for Redis connection string. This activates the `ioredis`-backed distributed rate limiter already implemented in the Functions backend. Without Redis, each horizontally-scaled Function instance maintains its own in-memory counter, allowing a client to bypass rate limits by hitting multiple instances.

### Protect File Uploads

- Validate `Content-Type` on the server before writing blobs.
- Reject filenames that contain path-traversal sequences (`../`, `..\\`).
- Use randomly generated UUID blob names — never trust the client-supplied filename.
- Enable **Microsoft Defender for Storage** for automatic malware scanning.
- Limit blob public access to the `product-images` container only; all other containers must be private.

### Enable SQL Threat Detection

```bash
az sql db threat-policy update \
  --resource-group Market4U-RG \
  --server market4u-sql-<suffix> \
  --database Market4U \
  --state Enabled \
  --email-addresses security@yourdomain.com \
  --email-account-admins true
```

Also enable **Microsoft Defender for SQL** for advanced threat protection and vulnerability assessment:

```bash
az sql server microsoft-support-auditing-policy update \
  --resource-group Market4U-RG \
  --server market4u-sql-<suffix> \
  --state Enabled
```

### Additional Hardening

| Control | Action |
|---------|--------|
| **Security headers** | Already configured in `staticwebapp.config.json`: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy` |
| **CORS** | Restrict `Host.CORS` in `host.json` / Function configuration to your Static Web App hostname only |
| **JWT expiry** | Keep access token TTL short (15–60 minutes) and implement refresh token rotation |
| **SQL injection** | The backend uses parameterized queries via `mssql` — never interpolate user input into SQL strings |
| **Dependency updates** | Run `npm audit` regularly and keep `mssql`, `jsonwebtoken`, `bcryptjs`, and `ioredis` up to date |

---

## Section 7 — Monitoring & Logging

### Configure Azure Application Insights

**Create the resource:**

```bash
az monitor app-insights component create \
  --app market4u-insights \
  --location uaenorth \
  --resource-group Market4U-RG \
  --workspace /subscriptions/<sub>/resourceGroups/Market4U-RG/providers/Microsoft.OperationalInsights/workspaces/market4u-logs
```

**Retrieve the connection string:**

```bash
az monitor app-insights component show \
  --app market4u-insights \
  --resource-group Market4U-RG \
  --query connectionString \
  --output tsv
```

Set the output as `APPLICATIONINSIGHTS_CONNECTION_STRING` in both Azure Application Settings and GitHub Secrets.

The `applicationinsights` SDK (already a dependency at v3.13) auto-activates when this environment variable is set. It automatically tracks:

- All HTTP requests and responses (status codes, durations)
- All SQL dependency calls (query text, duration, success/failure)
- All outbound HTTP calls (Storage, Redis, external APIs)
- Unhandled exceptions with full stack traces
- Custom events and metrics

### Request Tracing

Every Function invocation is captured as an **Application Insights request** with:
- `operation_Id` (distributed trace ID)
- `operation_ParentId` (for sub-requests)
- Custom properties: `userId`, `endpoint`, `statusCode`

To correlate a frontend error with a backend failure, use the **Transaction Search** blade in Application Insights and filter by the same `operation_Id`.

### Performance Monitoring

| Metric | Where to Find | Threshold |
|--------|---------------|-----------|
| **Server response time** | Performance → Operations | p95 < 500 ms |
| **SQL dependency duration** | Performance → Dependencies | p95 < 200 ms |
| **Failed requests rate** | Failures → Exceptions | < 1 % |
| **Availability** | Availability → URL ping tests | > 99.9 % |

Create an **Availability Test** against `https://<your-app>.azurestaticapps.net/api/health` to get uptime alerts.

### Error Alerts

**Create an alert for 5xx errors:**

```bash
az monitor metrics alert create \
  --name "High Server Error Rate" \
  --resource-group Market4U-RG \
  --scopes /subscriptions/<sub>/resourceGroups/Market4U-RG/providers/microsoft.insights/components/market4u-insights \
  --condition "count requests/failed > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action /subscriptions/<sub>/resourceGroups/Market4U-RG/providers/microsoft.insights/actionGroups/market4u-ops
```

**Recommended alerts:**

| Alert | Condition | Severity |
|-------|-----------|----------|
| High error rate | Failed requests > 10 in 5 min | 2 (Warning) |
| Slow responses | p95 response time > 2 s | 3 (Informational) |
| Database failures | SQL dependency failures > 5 in 5 min | 1 (Critical) |
| Auth failures | 401 count > 50 in 5 min | 2 (Warning) |

---

## Section 8 — Deployment Process

### Pipeline Overview

```
Developer pushes to main / opens PR
           │
           ▼
   GitHub Actions Workflow
   (.github/workflows/azure-static-web-apps.yml)
           │
  ┌────────┴────────────────────────────────────────┐
  │                                                  │
  ▼                                                  ▼
Install frontend deps                    Install API deps
   npm ci                               npm ci --prefix api --ignore-scripts
        │                                          │
        ▼                                          ▼
  Build frontend                            Run API tests
  npm run build                          npm test --prefix api
  (VITE_USE_MOCK_DATA=false)                        │
        │                                          ▼
        │                                  Build API TypeScript
        │                               npm run build --prefix api
        │                                          │
        └──────────────┬───────────────────────────┘
                       │
                       ▼
          Validate required secrets
          (AUTH_SECRET, SqlConnectionString,
           AZURE_STORAGE_CONNECTION_STRING,
           AZURE_STORAGE_CONTAINER)
                       │
                       ▼
          Azure/static-web-apps-deploy@v1
          (skip_app_build: true — uses pre-built dist/)
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
  Azure Static Web Apps      Azure Functions
   (React PWA — dist/)       (TypeScript API — api/)
```

### Step-by-Step Setup

#### 1. Create the Static Web App in Azure

```bash
az staticwebapp create \
  --name market4u-app \
  --resource-group Market4U-RG \
  --source https://github.com/<owner>/market4u-af \
  --branch main \
  --app-location "/" \
  --api-location "api" \
  --output-location "dist" \
  --login-with-github
```

Azure automatically generates a deployment token.

#### 2. Retrieve the Deployment Token

```bash
az staticwebapp secrets list \
  --name market4u-app \
  --resource-group Market4U-RG \
  --query properties.apiKey \
  --output tsv
```

#### 3. Configure GitHub Secrets

Go to **GitHub → Repository → Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Token from step 2 |
| `AUTH_SECRET` | `openssl rand -hex 32` |
| `SqlConnectionString` | Azure SQL connection string |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob Storage connection string |
| `AZURE_STORAGE_CONTAINER` | `product-images` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights connection string |
| `VITE_API_BASE_URL` | `/api` |
| `GEMINI_API_KEY` | Gemini AI key (optional) |

#### 4. Automatic Deployment

- **Push to `main`** → full build + deploy to the production environment.
- **Open a PR** → build + deploy to an isolated **preview environment** (separate URL).
- **Close a PR** → preview environment is automatically torn down.

#### 5. Manual Trigger

```bash
# Trigger a new deployment without a code change
gh workflow run "Azure Static Web Apps CI/CD" --ref main
```

Or via **GitHub → Actions → Azure Static Web Apps CI/CD → Run workflow**.

#### 6. Run Tests Before Deployment

Tests run automatically in the workflow before deployment. The workflow will fail if:

- API tests fail (`npm test --prefix api`)
- `AUTH_SECRET` is missing, too short (< 32 chars), or equals a known placeholder
- `SqlConnectionString` / `AZURE_STORAGE_CONNECTION_STRING` / `AZURE_STORAGE_CONTAINER` are missing

To run tests locally before pushing:

```bash
# Frontend tests
npm test

# API tests
cd api && npm test
```

---

## Section 9 — Production Readiness Checklist

### Infrastructure

- [ ] Resource Group `Market4U-RG` created in UAE North
- [ ] Azure SQL Server created with strong admin password
- [ ] Azure SQL Database `Market4U` created (Standard S1 or higher for production)
- [ ] Database schema initialized (`api/sql/init.sql` executed successfully)
- [ ] SQL Server firewall allows Azure services (`0.0.0.0` to `0.0.0.0`)
- [ ] SQL Private Endpoint configured (production hardening)
- [ ] Azure Storage Account created (HTTPS-only, TLS 1.2 minimum)
- [ ] Blob container `product-images` created with Blob-level public access
- [ ] Azure Cache for Redis created (Standard C1 for production)
- [ ] Azure Application Insights workspace-based resource created
- [ ] Azure Key Vault created and secrets migrated
- [ ] Azure Static Web App created and linked to GitHub repository
- [ ] CDN / Azure Front Door configured with custom domain (optional)

### Security

- [ ] `AUTH_SECRET` is a cryptographically random string of at least 32 characters (generated with `openssl rand -hex 32`)
- [ ] `AUTH_SECRET` is identical across all application settings (mismatched values cause 401 on every authenticated request)
- [ ] No placeholder values (`change-this-to-a-random-string-*`) remain in any Application Setting or GitHub Secret
- [ ] System-assigned Managed Identity enabled on the Static Web App
- [ ] Managed Identity granted `db_datareader` + `db_datawriter` roles on the SQL database
- [ ] Managed Identity granted `Storage Blob Data Contributor` on the Storage Account
- [ ] Managed Identity granted `Key Vault Secrets User` on Key Vault
- [ ] SQL authentication disabled (Managed Identity only)
- [ ] Microsoft Defender for SQL enabled (threat detection + vulnerability assessment)
- [ ] Microsoft Defender for Storage enabled (malware scanning)
- [ ] SQL Transparent Data Encryption active (on by default)
- [ ] Blob soft-delete enabled with 7-day retention
- [ ] CORS restricted to the Static Web App hostname on Storage and Functions

### Environment Variables

- [ ] `SqlConnectionString` configured in Azure Application Settings and GitHub Secrets
- [ ] `AZURE_STORAGE_CONNECTION_STRING` configured
- [ ] `AZURE_STORAGE_CONTAINER` set to `product-images`
- [ ] `AUTH_SECRET` configured
- [ ] `APPLICATIONINSIGHTS_CONNECTION_STRING` configured
- [ ] `RATE_LIMIT_REDIS_URL` configured (distributed rate limiting active)
- [ ] `VITE_API_BASE_URL` set to `/api`
- [ ] `VITE_USE_MOCK_DATA` is **not** set to `true` (would cause build failure)
- [ ] `VITE_DEBUG_AUTH` is **not** `true` in production
- [ ] `AUTH_DIAG_ENABLED` is **not** `true` in production

### CI/CD Pipeline

- [ ] `AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub Secret configured
- [ ] All required GitHub Secrets present (workflow secret validation passes)
- [ ] At least one successful build and deploy to production completed
- [ ] PR preview environments working
- [ ] API tests passing (`npm test --prefix api`)
- [ ] Frontend tests passing (`npm test`)

### Monitoring

- [ ] Application Insights connected (request traces visible in Azure Portal)
- [ ] Availability test created for `GET /api/health`
- [ ] Alert for high server error rate (> 10 failures in 5 min) configured
- [ ] Alert for slow response times (p95 > 2 s) configured
- [ ] Alert for database dependency failures configured
- [ ] Alert emails directed to the operations team

### Data & Backups

- [ ] SQL automated backups enabled (7-day point-in-time restore for Basic/Standard; configurable for General Purpose)
- [ ] Long-term backup retention policy configured (weekly/monthly)
- [ ] Storage soft-delete enabled
- [ ] Disaster recovery plan documented

### Application

- [ ] `GET /api/health` returns `{"success": true, "data": {"status": "healthy", "database": "connected"}}`
- [ ] User registration and login working
- [ ] Ad creation with image upload working
- [ ] Admin panel accessible at `/admin` with admin credentials
- [ ] Default admin password changed from `admin123`
- [ ] Default user password changed from `user123`
- [ ] PWA manifest and service worker loading correctly
- [ ] All pages load without console errors

---

*Market4U — Digital Marketplace 🇦🇫*
