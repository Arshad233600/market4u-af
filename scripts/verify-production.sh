#!/usr/bin/env bash
# =============================================================================
# Market4U — Production Connectivity Verification Script
# =============================================================================
# Usage:
#   bash scripts/verify-production.sh \
#       --rg <ResourceGroupName> \
#       --swa <StaticWebAppName> \
#       --sql-server <SqlServerName> \
#       --sql-db <SqlDbName> \
#       --storage <StorageAccountName> \
#       --kv <KeyVaultName> \
#       --redis <RedisCacheName> \
#       --insights <AppInsightsName>
#
# All flags except --rg default to the auto-generated names produced by
# infrastructure/main.bicep (prefix=market4u).  Override any flag as needed.
#
# Prerequisites:
#   az login (or az login --service-principal) completed in the current shell.
#   az extension add --name staticwebapp (if not already installed).
#
# Output:
#   ✔ PASS  – resource / setting is correctly configured
#   ✗ FAIL  – resource is missing or misconfigured  (exit code 1)
#   ⚠ WARN  – non-blocking issue or manual check required
#   A "Fix List" is printed at the end containing every FAIL and WARN.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers (fall back to plain text when not a TTY)
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; CYAN=''; BOLD=''; RESET=''
fi

PASS="${GREEN}✔ PASS${RESET}"
FAIL="${RED}✗ FAIL${RESET}"
WARN="${YELLOW}⚠ WARN${RESET}"

# ---------------------------------------------------------------------------
# Fix-list accumulator
# ---------------------------------------------------------------------------
declare -a FIX_LIST=()

pass()  { echo -e "  ${PASS}  $1"; }
fail()  { echo -e "  ${FAIL}  $1"; FIX_LIST+=("FAIL: $1"); }
warn()  { echo -e "  ${WARN}  $1"; FIX_LIST+=("WARN: $1"); }
info()  { echo -e "  ${CYAN}ℹ INFO${RESET}  $1"; }
section(){ echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}"; }

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
RG=""
SWA_NAME=""
SQL_SERVER=""
SQL_DB=""
STORAGE_NAME=""
KV_NAME=""
REDIS_NAME=""
INSIGHTS_NAME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rg)          RG="$2";           shift 2 ;;
    --swa)         SWA_NAME="$2";     shift 2 ;;
    --sql-server)  SQL_SERVER="$2";   shift 2 ;;
    --sql-db)      SQL_DB="$2";       shift 2 ;;
    --storage)     STORAGE_NAME="$2"; shift 2 ;;
    --kv)          KV_NAME="$2";      shift 2 ;;
    --redis)       REDIS_NAME="$2";   shift 2 ;;
    --insights)    INSIGHTS_NAME="$2";shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [[ -z "$RG" ]]; then
  echo "Usage: $0 --rg <ResourceGroupName> [--swa <name>] [--sql-server <name>] ..."
  exit 1
fi

# ---------------------------------------------------------------------------
# Helper: resolve resource name from RG if not explicitly supplied
# ---------------------------------------------------------------------------
resolve_name() {
  local type="$1"   # e.g. "Microsoft.Web/staticSites"
  local var_name="$2"
  local current_val="${!var_name}"
  if [[ -n "$current_val" ]]; then return; fi
  local found
  found=$(az resource list --resource-group "$RG" \
            --resource-type "$type" \
            --query "[0].name" -o tsv 2>/dev/null || true)
  printf -v "$var_name" '%s' "$found"
}

resolve_name "Microsoft.Web/staticSites"               SWA_NAME
resolve_name "Microsoft.Sql/servers"                   SQL_SERVER
resolve_name "Microsoft.Storage/storageAccounts"       STORAGE_NAME
resolve_name "Microsoft.KeyVault/vaults"               KV_NAME
resolve_name "Microsoft.Cache/Redis"                   REDIS_NAME
resolve_name "Microsoft.Insights/components"           INSIGHTS_NAME

SQL_DB="${SQL_DB:-market4u-db}"

echo -e "\n${BOLD}Market4U — Production Connectivity Verification${RESET}"
echo   "Resource Group  : $RG"
echo   "SWA             : ${SWA_NAME:-<not found>}"
echo   "SQL Server      : ${SQL_SERVER:-<not found>}"
echo   "SQL DB          : $SQL_DB"
echo   "Storage Account : ${STORAGE_NAME:-<not found>}"
echo   "Key Vault       : ${KV_NAME:-<not found>}"
echo   "Redis Cache     : ${REDIS_NAME:-<not found>}"
echo   "App Insights    : ${INSIGHTS_NAME:-<not found>}"

# ---------------------------------------------------------------------------
# Required backend app-setting keys
# ---------------------------------------------------------------------------
REQUIRED_KEYS=(
  AUTH_SECRET
  SqlConnectionString
  AZURE_STORAGE_CONNECTION_STRING
  AZURE_STORAGE_CONTAINER
  APPLICATIONINSIGHTS_CONNECTION_STRING
  RATE_LIMIT_REDIS_URL
)

# =============================================================================
# Section 1 — Resource Group inventory
# =============================================================================
section "1 — Resource Group Inventory"

echo ""
info "Listing all resources in $RG:"
az resource list --resource-group "$RG" \
  --query "[].{Type:type, Name:name, Location:location}" \
  -o table 2>/dev/null || fail "Could not list resources in resource group '$RG' — check az login and RG name"

for name_var in SWA_NAME SQL_SERVER STORAGE_NAME KV_NAME REDIS_NAME INSIGHTS_NAME; do
  val="${!name_var}"
  label="${name_var//_/ }"
  if [[ -n "$val" ]]; then
    pass "$label found: $val"
  else
    fail "$label not found in resource group $RG"
  fi
done

# =============================================================================
# Section 2 — Azure Static Web App
# =============================================================================
section "2 — Azure Static Web App"

if [[ -z "$SWA_NAME" ]]; then
  fail "Static Web App name unknown — skipping SWA checks"; else

SWA_JSON=$(az staticwebapp show \
              --name "$SWA_NAME" \
              --resource-group "$RG" \
              -o json 2>/dev/null || echo "{}")

HOSTNAME=$(echo "$SWA_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('properties',{}).get('defaultHostname',''))" 2>/dev/null || true)
REPO_URL=$(echo "$SWA_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('properties',{}).get('repositoryUrl',''))" 2>/dev/null || true)
BRANCH=$(echo  "$SWA_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('properties',{}).get('branch',''))" 2>/dev/null || true)
IDENTITY=$(echo "$SWA_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('identity',{}).get('type','None'))" 2>/dev/null || true)
PRINCIPAL_ID=$(echo "$SWA_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('identity',{}).get('principalId',''))" 2>/dev/null || true)

[[ -n "$HOSTNAME" ]] && pass "Default hostname: $HOSTNAME" || fail "SWA default hostname is empty"
[[ -n "$REPO_URL" ]] && pass "Linked repo: $REPO_URL" || warn "SWA repositoryUrl is empty (deploy may be manual)"
[[ -n "$BRANCH"   ]] && pass "Branch: $BRANCH"         || warn "SWA branch is empty"

if echo "$IDENTITY" | grep -qi "SystemAssigned"; then
  pass "Managed Identity: SystemAssigned (principalId=$PRINCIPAL_ID)"
  SWA_PRINCIPAL_ID="$PRINCIPAL_ID"
else
  fail "Managed Identity is NOT enabled on the SWA (identity.type='$IDENTITY'). Enable system-assigned identity."
  SWA_PRINCIPAL_ID=""
fi

# --- App settings ---
echo ""
info "Checking required app settings (values masked — only presence and length shown):"
SWA_SETTINGS=$(az staticwebapp appsettings list \
                  --name "$SWA_NAME" \
                  --resource-group "$RG" \
                  --query "properties" -o json 2>/dev/null || echo "{}")

for KEY in "${REQUIRED_KEYS[@]}"; do
  VALUE=$(echo "$SWA_SETTINGS" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('$KEY',''))" 2>/dev/null || true)
  if [[ -z "$VALUE" ]]; then
    fail "App setting '$KEY' is MISSING or empty"
  else
    LEN=${#VALUE}
    pass "App setting '$KEY' is SET (length=$LEN)"
  fi
done

fi # end SWA block

# =============================================================================
# Section 3 — Key Vault
# =============================================================================
section "3 — Key Vault"

if [[ -z "$KV_NAME" ]]; then
  warn "Key Vault name unknown — skipping KV checks"; else

KV_JSON=$(az keyvault show --name "$KV_NAME" --resource-group "$RG" -o json 2>/dev/null || echo "{}")
RBAC_ENABLED=$(echo "$KV_JSON" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('properties',{}).get('enableRbacAuthorization','false'))" 2>/dev/null || true)

[[ "$RBAC_ENABLED" == "True" || "$RBAC_ENABLED" == "true" ]] \
  && pass "Key Vault RBAC authorization is enabled" \
  || warn "Key Vault RBAC authorization is NOT enabled (enableRbacAuthorization=$RBAC_ENABLED). RBAC is recommended."

KV_RESOURCE_ID=$(echo "$KV_JSON" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || true)

# Confirm SWA managed identity has "Key Vault Secrets User" role
if [[ -n "${SWA_PRINCIPAL_ID:-}" && -n "$KV_RESOURCE_ID" ]]; then
  KV_ROLE_ASSIGNMENT=$(az role assignment list \
    --assignee "$SWA_PRINCIPAL_ID" \
    --scope "$KV_RESOURCE_ID" \
    --query "[?contains(roleDefinitionName,'Key Vault Secrets User')].roleDefinitionName" \
    -o tsv 2>/dev/null || true)
  [[ -n "$KV_ROLE_ASSIGNMENT" ]] \
    && pass "SWA Managed Identity has 'Key Vault Secrets User' role on Key Vault" \
    || fail "SWA Managed Identity is missing 'Key Vault Secrets User' role on Key Vault '$KV_NAME'. Run: az role assignment create --assignee $SWA_PRINCIPAL_ID --role 'Key Vault Secrets User' --scope $KV_RESOURCE_ID"
else
  warn "Cannot check Key Vault role assignment (SWA principalId or KV resource ID unknown)"
fi

# Which app settings use KV references?
echo ""
info "App settings with @Microsoft.KeyVault references:"
KV_REFS=$(echo "$SWA_SETTINGS" | python3 -c \
  "import sys,json; d=json.load(sys.stdin)
for k,v in d.items():
    if '@Microsoft.KeyVault' in str(v):
        print(f'  {k} → (KeyVault reference)')" 2>/dev/null || true)
if [[ -n "$KV_REFS" ]]; then
  echo "$KV_REFS"
  pass "At least one app setting uses a Key Vault reference"
else
  warn "No app settings use @Microsoft.KeyVault references — secrets are stored as plain text. Consider using KV references for all sensitive settings."
fi

fi # end KV block

# =============================================================================
# Section 4 — Azure SQL
# =============================================================================
section "4 — Azure SQL"

if [[ -z "$SQL_SERVER" ]]; then
  fail "SQL Server name unknown — skipping SQL checks"; else

SQL_SERVER_JSON=$(az sql server show \
  --name "$SQL_SERVER" --resource-group "$RG" -o json 2>/dev/null || echo "{}")
SQL_FQDN=$(echo "$SQL_SERVER_JSON" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('fullyQualifiedDomainName',''))" 2>/dev/null || true)

[[ -n "$SQL_FQDN" ]] \
  && pass "SQL Server exists: $SQL_FQDN" \
  || fail "SQL Server '$SQL_SERVER' not found in RG '$RG'"

# Check database
DB_EXISTS=$(az sql db show \
  --server "$SQL_SERVER" --resource-group "$RG" \
  --name "$SQL_DB" --query "name" -o tsv 2>/dev/null || true)
[[ "$DB_EXISTS" == "$SQL_DB" ]] \
  && pass "Database '$SQL_DB' exists on server '$SQL_SERVER'" \
  || fail "Database '$SQL_DB' not found on server '$SQL_SERVER'. Create it or update --sql-db flag."

# Firewall rule AllowAzureServices (0.0.0.0 / 0.0.0.0)
FW_RULE=$(az sql server firewall-rule list \
  --server "$SQL_SERVER" --resource-group "$RG" \
  --query "[?startIpAddress=='0.0.0.0' && endIpAddress=='0.0.0.0'].name" \
  -o tsv 2>/dev/null || true)
[[ -n "$FW_RULE" ]] \
  && pass "Firewall rule allowing Azure services (0.0.0.0) exists: $FW_RULE" \
  || fail "No firewall rule with startIp=0.0.0.0 & endIp=0.0.0.0 found on SQL Server '$SQL_SERVER'. Run: az sql server firewall-rule create --server $SQL_SERVER --resource-group $RG --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0"

# Connection string presence (already checked in Section 2 app settings)
CONN_STR_VAL=$(echo "$SWA_SETTINGS" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('SqlConnectionString',''))" 2>/dev/null || true)
if [[ -n "$CONN_STR_VAL" ]]; then
  # Validate it contains the expected server hostname without printing the password
  if echo "$CONN_STR_VAL" | grep -qi "$SQL_SERVER"; then
    pass "SqlConnectionString references the correct SQL server '$SQL_SERVER'"
  else
    warn "SqlConnectionString is set but does not reference server '$SQL_SERVER' — verify the value in Azure portal"
  fi
else
  warn "SqlConnectionString not found in app settings — if using Managed Identity, confirm contained user exists with db_datareader/db_datawriter"
fi

fi # end SQL block

# =============================================================================
# Section 5 — Azure Blob Storage
# =============================================================================
section "5 — Azure Blob Storage"

if [[ -z "$STORAGE_NAME" ]]; then
  fail "Storage account name unknown — skipping storage checks"; else

STORAGE_JSON=$(az storage account show \
  --name "$STORAGE_NAME" --resource-group "$RG" -o json 2>/dev/null || echo "{}")
HTTPS_ONLY=$(echo "$STORAGE_JSON" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('properties',{}).get('supportsHttpsTrafficOnly','false'))" 2>/dev/null || true)
PUBLIC_ACCESS=$(echo "$STORAGE_JSON" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('properties',{}).get('allowBlobPublicAccess','false'))" 2>/dev/null || true)

[[ "$HTTPS_ONLY" == "True" || "$HTTPS_ONLY" == "true" ]] \
  && pass "Storage account enforces HTTPS-only traffic" \
  || fail "Storage account '$STORAGE_NAME' does NOT enforce HTTPS-only. Run: az storage account update --name $STORAGE_NAME --resource-group $RG --https-only true"

[[ "$PUBLIC_ACCESS" == "True" || "$PUBLIC_ACCESS" == "true" ]] \
  && pass "Storage account allowBlobPublicAccess=true (required for product-images container)" \
  || warn "Storage account allowBlobPublicAccess=false — the product-images container won't serve images publicly. Run: az storage account update --name $STORAGE_NAME --resource-group $RG --allow-blob-public-access true"

# Check container product-images
CONTAINER_EXISTS=$(az storage container show \
  --account-name "$STORAGE_NAME" \
  --name "product-images" \
  --auth-mode login \
  --query "name" -o tsv 2>/dev/null || true)
if [[ "$CONTAINER_EXISTS" == "product-images" ]]; then
  pass "Container 'product-images' exists"
  # Check publicAccess level
  CONTAINER_ACCESS=$(az storage container show \
    --account-name "$STORAGE_NAME" \
    --name "product-images" \
    --auth-mode login \
    --query "properties.publicAccess" -o tsv 2>/dev/null || true)
  [[ "$CONTAINER_ACCESS" == "blob" ]] \
    && pass "Container 'product-images' publicAccess=blob" \
    || warn "Container 'product-images' publicAccess='$CONTAINER_ACCESS' (expected 'blob'). Run: az storage container set-permission --account-name $STORAGE_NAME --name product-images --public-access blob --auth-mode login"
else
  fail "Container 'product-images' does NOT exist in storage account '$STORAGE_NAME'. Create it: az storage container create --account-name $STORAGE_NAME --name product-images --public-access blob --auth-mode login"
fi

# Storage Managed Identity role (Storage Blob Data Contributor)
STORAGE_RESOURCE_ID=$(echo "$STORAGE_JSON" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || true)
if [[ -n "${SWA_PRINCIPAL_ID:-}" && -n "$STORAGE_RESOURCE_ID" ]]; then
  STORAGE_ROLE=$(az role assignment list \
    --assignee "$SWA_PRINCIPAL_ID" \
    --scope "$STORAGE_RESOURCE_ID" \
    --query "[?contains(roleDefinitionName,'Storage Blob Data Contributor')].roleDefinitionName" \
    -o tsv 2>/dev/null || true)
  if [[ -n "$STORAGE_ROLE" ]]; then
    pass "SWA Managed Identity has 'Storage Blob Data Contributor' role on storage account"
  else
    warn "SWA Managed Identity does NOT have 'Storage Blob Data Contributor' role on storage account. If using MI mode, run: az role assignment create --assignee $SWA_PRINCIPAL_ID --role 'Storage Blob Data Contributor' --scope $STORAGE_RESOURCE_ID"
  fi
else
  warn "Cannot check Storage role assignment (SWA principalId or Storage resource ID unknown)"
fi

fi # end Storage block

# =============================================================================
# Section 6 — Azure Cache for Redis
# =============================================================================
section "6 — Azure Cache for Redis"

if [[ -z "$REDIS_NAME" ]]; then
  warn "Redis cache name unknown — skipping Redis checks"; else

REDIS_JSON=$(az redis show \
  --name "$REDIS_NAME" --resource-group "$RG" -o json 2>/dev/null || echo "{}")
REDIS_HOSTNAME=$(echo "$REDIS_JSON" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('hostName',''))" 2>/dev/null || true)
SSL_PORT=$(echo "$REDIS_JSON" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('sslPort',''))" 2>/dev/null || true)
NON_SSL_DISABLED=$(echo "$REDIS_JSON" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('properties',{}).get('enableNonSslPort','true'))" 2>/dev/null || true)

[[ -n "$REDIS_HOSTNAME" ]] \
  && pass "Redis cache exists: $REDIS_HOSTNAME" \
  || fail "Redis cache '$REDIS_NAME' not found in RG '$RG'"

[[ "$SSL_PORT" == "6380" ]] \
  && pass "Redis SSL port is 6380" \
  || warn "Redis SSL port is '$SSL_PORT' (expected 6380)"

[[ "$NON_SSL_DISABLED" == "False" || "$NON_SSL_DISABLED" == "false" ]] \
  && pass "Redis non-TLS port is disabled" \
  || warn "Redis non-TLS port may be enabled (enableNonSslPort=$NON_SSL_DISABLED). Disable it for security."

# Validate RATE_LIMIT_REDIS_URL format (do NOT print key)
REDIS_URL_VAL=$(echo "$SWA_SETTINGS" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('RATE_LIMIT_REDIS_URL',''))" 2>/dev/null || true)
if [[ -z "$REDIS_URL_VAL" ]]; then
  fail "App setting RATE_LIMIT_REDIS_URL is MISSING or empty"
else
  # Validate scheme and port only — do not print value
  if echo "$REDIS_URL_VAL" | grep -qE '^rediss://'; then
    pass "RATE_LIMIT_REDIS_URL scheme is 'rediss://' (TLS)"
  else
    fail "RATE_LIMIT_REDIS_URL does NOT start with 'rediss://' — non-TLS connection detected. Update to use rediss:// and port 6380."
  fi
  if echo "$REDIS_URL_VAL" | grep -qE ':6380(/|\?|$)'; then
    pass "RATE_LIMIT_REDIS_URL uses TLS port 6380"
  else
    fail "RATE_LIMIT_REDIS_URL does NOT use port 6380 — update to rediss://:<key>@<hostname>.redis.cache.windows.net:6380"
  fi
  # Confirm hostname matches the actual redis cache
  if [[ -n "$REDIS_HOSTNAME" ]]; then
    if echo "$REDIS_URL_VAL" | grep -q "$REDIS_HOSTNAME"; then
      pass "RATE_LIMIT_REDIS_URL hostname matches Redis cache hostname"
    else
      warn "RATE_LIMIT_REDIS_URL hostname does not appear to match Redis cache hostname '$REDIS_HOSTNAME' — verify the URL in Azure app settings"
    fi
  fi
fi

fi # end Redis block

# =============================================================================
# Section 7 — Application Insights
# =============================================================================
section "7 — Application Insights"

if [[ -z "$INSIGHTS_NAME" ]]; then
  fail "Application Insights name unknown — skipping AI checks"; else

INSIGHTS_JSON=$(az monitor app-insights component show \
  --app "$INSIGHTS_NAME" \
  --resource-group "$RG" -o json 2>/dev/null || echo "{}")
INSIGHTS_CONN=$(echo "$INSIGHTS_JSON" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('connectionString',''))" 2>/dev/null || true)

[[ -n "$INSIGHTS_CONN" ]] \
  && pass "Application Insights resource exists (connection string available from resource)" \
  || fail "Application Insights '$INSIGHTS_NAME' not found or has no connection string"

# Confirm app setting references it
AI_SETTING=$(echo "$SWA_SETTINGS" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('APPLICATIONINSIGHTS_CONNECTION_STRING',''))" 2>/dev/null || true)
if [[ -z "$AI_SETTING" ]]; then
  fail "App setting APPLICATIONINSIGHTS_CONNECTION_STRING is MISSING — Application Insights telemetry will NOT be collected"
else
  LEN=${#AI_SETTING}
  # Validate format (should start with InstrumentationKey= or contain InstrumentationKey)
  if echo "$AI_SETTING" | grep -qi "InstrumentationKey"; then
    pass "APPLICATIONINSIGHTS_CONNECTION_STRING is SET (length=$LEN) and has expected format"
  else
    warn "APPLICATIONINSIGHTS_CONNECTION_STRING is SET (length=$LEN) but does not contain 'InstrumentationKey' — verify the value is a Connection String, not a plain Instrumentation Key"
  fi
fi

fi # end App Insights block

# =============================================================================
# Section 8 — Connectivity checks
# =============================================================================
section "8 — Connectivity Checks"

if [[ -z "${HOSTNAME:-}" ]]; then
  warn "SWA hostname unknown — skipping HTTP connectivity checks"
else
  BASE="https://${HOSTNAME}"
  info "Testing $BASE ..."

  # GET / (frontend)
  STATUS_ROOT=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$BASE/" 2>/dev/null || echo "000")
  [[ "$STATUS_ROOT" == "200" ]] \
    && pass "GET $BASE/ → HTTP $STATUS_ROOT" \
    || fail "GET $BASE/ → HTTP $STATUS_ROOT (expected 200). Site may be down or not deployed."

  # GET /api/health
  STATUS_HEALTH=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$BASE/api/health" 2>/dev/null || echo "000")
  [[ "$STATUS_HEALTH" == "200" ]] \
    && pass "GET $BASE/api/health → HTTP $STATUS_HEALTH" \
    || fail "GET $BASE/api/health → HTTP $STATUS_HEALTH (expected 200). Check function deployment and SQL connection."

  # GET /api/ads (public)
  STATUS_ADS=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$BASE/api/ads" 2>/dev/null || echo "000")
  [[ "$STATUS_ADS" == "200" ]] \
    && pass "GET $BASE/api/ads → HTTP $STATUS_ADS" \
    || fail "GET $BASE/api/ads → HTTP $STATUS_ADS (expected 200). Check SQL connectivity and function runtime."

  # POST /api/auth/login without body — expect 400 (not 500 or 503)
  STATUS_LOGIN=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 \
    -X POST -H "Content-Type: application/json" -d '{}' \
    "$BASE/api/auth/login" 2>/dev/null || echo "000")
  [[ "$STATUS_LOGIN" == "400" || "$STATUS_LOGIN" == "422" ]] \
    && pass "POST $BASE/api/auth/login (empty body) → HTTP $STATUS_LOGIN (validation error as expected)" \
    || warn "POST $BASE/api/auth/login (empty body) → HTTP $STATUS_LOGIN (expected 400/422 — unexpected response may indicate function startup failure)"

  # GET /api/notifications without auth — must NOT be 401
  STATUS_NOTIF=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$BASE/api/notifications" 2>/dev/null || echo "000")
  [[ "$STATUS_NOTIF" == "200" ]] \
    && pass "GET $BASE/api/notifications (no auth) → HTTP $STATUS_NOTIF" \
    || warn "GET $BASE/api/notifications (no auth) → HTTP $STATUS_NOTIF (expected 200)"

  # Confirm X-Content-Type-Options header is present
  XCTO=$(curl -sS -I --max-time 15 "$BASE/" 2>/dev/null | grep -i "x-content-type-options" || true)
  [[ -n "$XCTO" ]] \
    && pass "Security header X-Content-Type-Options is present on /" \
    || warn "Security header X-Content-Type-Options is missing from /. Check staticwebapp.config.json globalHeaders."
fi

# =============================================================================
# Summary / Fix List
# =============================================================================
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}SUMMARY${RESET}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${RESET}"

FAIL_COUNT=0
WARN_COUNT=0
for item in "${FIX_LIST[@]}"; do
  if [[ "$item" == FAIL:* ]]; then ((FAIL_COUNT++)); fi
  if [[ "$item" == WARN:* ]]; then ((WARN_COUNT++)); fi
done

if [[ "${#FIX_LIST[@]}" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All checks passed — no issues found.${RESET}"
else
  echo ""
  echo -e "${BOLD}Fix List (${FAIL_COUNT} FAIL, ${WARN_COUNT} WARN):${RESET}"
  for i in "${!FIX_LIST[@]}"; do
    item="${FIX_LIST[$i]}"
    num=$((i + 1))
    if [[ "$item" == FAIL:* ]]; then
      echo -e "  ${RED}${num}. ${item}${RESET}"
    else
      echo -e "  ${YELLOW}${num}. ${item}${RESET}"
    fi
  done
fi

echo ""
if [[ $FAIL_COUNT -gt 0 ]]; then
  echo -e "${RED}${BOLD}Verification FAILED — $FAIL_COUNT critical issue(s) must be resolved before production traffic.${RESET}"
  exit 1
else
  echo -e "${GREEN}${BOLD}Verification PASSED${RESET}${GREEN} — no critical failures detected.${RESET}${YELLOW} Review ${WARN_COUNT} warning(s) above.${RESET}"
  exit 0
fi
