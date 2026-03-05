# Production Connectivity Verification — Market4U

> Run `scripts/verify-production.sh` after every deployment to confirm that all Azure resources are reachable and correctly configured.

---

## Overview

`scripts/verify-production.sh` is an Azure CLI–based verification script that checks every layer of the Market4U Azure stack and produces a colour-coded pass / fail / warn report followed by a **Fix List** of any issues found.

### What it validates

| Section | Checks performed |
|---------|-----------------|
| **1 — Resource Inventory** | All required resources exist in the resource group |
| **2 — Static Web App** | Default hostname, linked repo/branch, required app settings present (values masked), Managed Identity enabled |
| **3 — Key Vault** | RBAC authorization enabled, SWA Managed Identity has *Key Vault Secrets User* role, which app settings use `@Microsoft.KeyVault` references |
| **4 — Azure SQL** | Server + database exist, `AllowAzureServices` firewall rule (0.0.0.0), `SqlConnectionString` references correct server |
| **5 — Blob Storage** | HTTPS-only enforced, `allowBlobPublicAccess=true`, `product-images` container exists with `publicAccess=blob`, SWA MI has *Storage Blob Data Contributor* role |
| **6 — Redis Cache** | Cache exists, SSL port is 6380, non-TLS port disabled, `RATE_LIMIT_REDIS_URL` uses `rediss://` scheme and port 6380 |
| **7 — Application Insights** | Resource exists and connection string is available, `APPLICATIONINSIGHTS_CONNECTION_STRING` app setting is set with correct format |
| **8 — Connectivity** | Live HTTP checks: `GET /`, `GET /api/health`, `GET /api/ads`, `POST /api/auth/login` (empty body → 400), `GET /api/notifications` (no auth → 200), security headers present |

### Required backend app settings checked

| Setting | Purpose |
|---------|---------|
| `AUTH_SECRET` | JWT signing secret (must be ≥ 32 random characters) |
| `SqlConnectionString` | Azure SQL connection string or Key Vault reference |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob Storage connection string or Key Vault reference |
| `AZURE_STORAGE_CONTAINER` | Blob container name (must be `product-images`) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Application Insights telemetry |
| `RATE_LIMIT_REDIS_URL` | Redis connection URL (`rediss://` scheme, port 6380) |

---

## Prerequisites

1. **Azure CLI** ≥ 2.50 installed and logged in:
   ```bash
   az login
   # or for CI/CD:
   az login --service-principal -u <clientId> -p <clientSecret> --tenant <tenantId>
   ```

2. **staticwebapp** extension:
   ```bash
   az extension add --name staticwebapp --upgrade
   ```

3. **curl** (standard on Linux/macOS; use Git Bash on Windows).

4. The script uses Python 3 (built-in `python3`) for JSON parsing — available on all Azure-hosted runners and most developer machines.

5. The identity running the script needs at minimum **Reader** access to the resource group and **Key Vault Reader** + **Storage Blob Data Reader** to inspect settings.

---

## Usage

### Minimal (auto-discover all resource names)

```bash
bash scripts/verify-production.sh --rg <ResourceGroupName>
```

The script will auto-discover the first resource of each type in the resource group. This works when there is exactly one SWA, SQL server, storage account, etc., in the RG.

### Explicit resource names (recommended for production)

```bash
bash scripts/verify-production.sh \
  --rg    Market4U-RG \
  --swa   market4u-app \
  --sql-server  market4u-sql-<suffix> \
  --sql-db      market4u-db \
  --storage     market4ustor<suffix> \
  --kv    market4u-kv \
  --redis market4u-redis \
  --insights market4u-insights
```

Resource names with auto-generated suffixes (`<suffix>`) can be found in the Azure Portal or in the outputs of the Bicep deployment:

```bash
az deployment group show \
  --resource-group Market4U-RG \
  --name main \
  --query properties.outputs
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--rg` | *(required)* | Azure resource group name |
| `--swa` | auto-discover | Azure Static Web App name |
| `--sql-server` | auto-discover | Azure SQL Server name |
| `--sql-db` | `market4u-db` | Azure SQL Database name |
| `--storage` | auto-discover | Azure Storage Account name |
| `--kv` | auto-discover | Azure Key Vault name |
| `--redis` | auto-discover | Azure Cache for Redis name |
| `--insights` | auto-discover | Application Insights component name |

---

## Reading the output

```
═══ 2 — Azure Static Web App ═══

  ✔ PASS  Default hostname: amazing-sky-0001.azurestaticapps.net
  ✔ PASS  Linked repo: https://github.com/Arshad233600/market4u-af
  ✔ PASS  Branch: main
  ✔ PASS  Managed Identity: SystemAssigned (principalId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  ℹ INFO  Checking required app settings (values masked — only presence and length shown):
  ✔ PASS  App setting 'AUTH_SECRET' is SET (length=64)
  ✔ PASS  App setting 'SqlConnectionString' is SET (length=212)
  ✗ FAIL  App setting 'RATE_LIMIT_REDIS_URL' is MISSING or empty
  ✔ PASS  App setting 'APPLICATIONINSIGHTS_CONNECTION_STRING' is SET (length=151)
```

- `✔ PASS` — check passed; no action needed.
- `✗ FAIL` — critical issue; **must be resolved** before production traffic. The script exits with code **1**.
- `⚠ WARN` — non-blocking issue or manual check required. The script exits with code **0** but prints the warning in the Fix List.

---

## Fix List

At the end of every run the script prints a numbered Fix List of all FAILs and WARNs with remediation commands where possible. Example:

```
Fix List (1 FAIL, 2 WARN):
  1. FAIL: App setting 'RATE_LIMIT_REDIS_URL' is MISSING or empty
  2. WARN: No app settings use @Microsoft.KeyVault references — secrets are stored as plain text.
  3. WARN: Redis non-TLS port may be enabled (enableNonSslPort=True). Disable it for security.
```

---

## Common fixes

### Missing `RATE_LIMIT_REDIS_URL`

```bash
# Get the Redis access key (do NOT commit this value)
KEY=$(az redis list-keys --name <redis-name> --resource-group <rg> --query primaryKey -o tsv)
HOSTNAME=$(az redis show --name <redis-name> --resource-group <rg> --query hostName -o tsv)

az staticwebapp appsettings set \
  --name <swa-name> \
  --resource-group <rg> \
  --setting-names "RATE_LIMIT_REDIS_URL=rediss://:${KEY}@${HOSTNAME}:6380"
```

### Missing `APPLICATIONINSIGHTS_CONNECTION_STRING`

```bash
CONN=$(az monitor app-insights component show \
  --app <insights-name> --resource-group <rg> --query connectionString -o tsv)

az staticwebapp appsettings set \
  --name <swa-name> --resource-group <rg> \
  --setting-names "APPLICATIONINSIGHTS_CONNECTION_STRING=${CONN}"
```

### Enable SWA System-Assigned Managed Identity

```bash
az staticwebapp identity assign \
  --name <swa-name> --resource-group <rg>
```

### Grant SWA MI Key Vault Secrets User role

```bash
PRINCIPAL=$(az staticwebapp identity show \
  --name <swa-name> --resource-group <rg> --query principalId -o tsv)
KV_ID=$(az keyvault show --name <kv-name> --resource-group <rg> --query id -o tsv)

az role assignment create \
  --assignee "$PRINCIPAL" \
  --role "Key Vault Secrets User" \
  --scope "$KV_ID"
```

### Enable SQL AllowAzureServices firewall rule

```bash
az sql server firewall-rule create \
  --server <sql-server> --resource-group <rg> \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Set product-images container public access to blob

```bash
az storage container set-permission \
  --account-name <storage-name> \
  --name product-images \
  --public-access blob \
  --auth-mode login
```

---

## Running in CI/CD

Add a post-deploy step in your GitHub Actions workflow:

```yaml
- name: Verify production connectivity
  env:
    AZURE_CREDENTIALS: ${{ secrets.AZURE_CREDENTIALS }}
  run: |
    az login --service-principal \
      -u ${{ secrets.AZURE_CLIENT_ID }} \
      -p ${{ secrets.AZURE_CLIENT_SECRET }} \
      --tenant ${{ secrets.AZURE_TENANT_ID }}
    az extension add --name staticwebapp --upgrade --yes
    bash scripts/verify-production.sh \
      --rg "${{ vars.AZURE_RG }}" \
      --swa "${{ vars.SWA_NAME }}"
```

The script exits with code 1 on any FAIL, which will fail the CI step and alert the team.

---

## Relationship to other scripts

| Script | Purpose |
|--------|---------|
| `scripts/smoke-test.mjs` | End-to-end API smoke test (login → post ad → verify) |
| `scripts/verify-production.sh` | Azure-layer infrastructure verification (this script) |

Run `verify-production.sh` first to confirm all Azure resources are reachable, then run `smoke-test.mjs` to exercise the application logic.
