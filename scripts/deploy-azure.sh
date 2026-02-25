#!/usr/bin/env bash
# =============================================================
# Market4U - Azure Resource Provisioning Script
# Run this once to create all required Azure resources.
#
# Prerequisites:
#   - Azure CLI installed (https://aka.ms/installazurecli)
#   - Logged in: az login
#   - Bicep CLI: az bicep install
# =============================================================

set -euo pipefail

# ── Configuration (edit these values) ───────────────────────
APP_NAME="${APP_NAME:-market4u}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
LOCATION="${LOCATION:-uaenorth}"          # UAE North (Dubai) - closest to Afghanistan
RESOURCE_GROUP="${RESOURCE_GROUP:-${APP_NAME}-${ENVIRONMENT}-rg}"

# These are prompted interactively if not set as env vars
SQL_ADMIN_LOGIN="${SQL_ADMIN_LOGIN:-market4uadmin}"

# ── Helper ───────────────────────────────────────────────────
info()    { echo -e "\033[0;34m[INFO]\033[0m  $*"; }
success() { echo -e "\033[0;32m[OK]\033[0m    $*"; }
warn()    { echo -e "\033[0;33m[WARN]\033[0m  $*"; }
error()   { echo -e "\033[0;31m[ERROR]\033[0m $*" >&2; exit 1; }

# ── Dependency check ─────────────────────────────────────────
command -v az >/dev/null 2>&1 || error "Azure CLI not found. Install from https://aka.ms/installazurecli"

info "Checking Azure login..."
az account show --query "name" -o tsv >/dev/null 2>&1 || error "Not logged in. Run: az login"
SUBSCRIPTION=$(az account show --query "name" -o tsv)
success "Logged in to subscription: $SUBSCRIPTION"

# ── Prompt for secrets ───────────────────────────────────────
if [ -z "${SQL_ADMIN_PASSWORD:-}" ]; then
  read -rsp "Enter SQL admin password (min 8 chars, mix upper/lower/number/symbol): " SQL_ADMIN_PASSWORD
  echo
fi

if [ -z "${AUTH_SECRET:-}" ]; then
  AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
  info "Generated AUTH_SECRET (save this!): $AUTH_SECRET"
fi

GEMINI_API_KEY="${GEMINI_API_KEY:-}"

# ── Create Resource Group ─────────────────────────────────────
info "Creating resource group: $RESOURCE_GROUP in $LOCATION..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none
success "Resource group ready: $RESOURCE_GROUP"

# ── Deploy Bicep template ─────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BICEP_FILE="$SCRIPT_DIR/../infrastructure/main.bicep"

[ -f "$BICEP_FILE" ] || error "Bicep file not found: $BICEP_FILE"

info "Deploying Azure resources (this may take 3-5 minutes)..."
DEPLOYMENT_OUTPUT=$(az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$BICEP_FILE" \
  --parameters \
      appName="$APP_NAME" \
      location="$LOCATION" \
      environment="$ENVIRONMENT" \
      sqlAdminLogin="$SQL_ADMIN_LOGIN" \
      sqlAdminPassword="$SQL_ADMIN_PASSWORD" \
      authSecret="$AUTH_SECRET" \
      geminiApiKey="$GEMINI_API_KEY" \
  --query "properties.outputs" \
  --output json)

success "Deployment complete!"

# ── Extract outputs ───────────────────────────────────────────
SWA_URL=$(echo "$DEPLOYMENT_OUTPUT"         | python3 -c "import sys,json; print(json.load(sys.stdin)['staticWebAppUrl']['value'])")
DEPLOY_TOKEN=$(echo "$DEPLOYMENT_OUTPUT"    | python3 -c "import sys,json; print(json.load(sys.stdin)['staticWebAppDeploymentToken']['value'])")
SQL_FQDN=$(echo "$DEPLOYMENT_OUTPUT"        | python3 -c "import sys,json; print(json.load(sys.stdin)['sqlServerFqdn']['value'])")
SQL_CONN=$(echo "$DEPLOYMENT_OUTPUT"        | python3 -c "import sys,json; print(json.load(sys.stdin)['sqlConnectionString']['value'])")
STORAGE_NAME=$(echo "$DEPLOYMENT_OUTPUT"    | python3 -c "import sys,json; print(json.load(sys.stdin)['storageAccountName']['value'])")
AI_CONN=$(echo "$DEPLOYMENT_OUTPUT"         | python3 -c "import sys,json; print(json.load(sys.stdin)['appInsightsConnectionString']['value'])")

# ── Initialise database schema ────────────────────────────────
info "Running database schema script..."
SQL_SCRIPT="$SCRIPT_DIR/../api/sql/init.sql"
if command -v sqlcmd >/dev/null 2>&1 && [ -f "$SQL_SCRIPT" ]; then
  sqlcmd -S "$SQL_FQDN" -d Market4U -U "$SQL_ADMIN_LOGIN" -P "$SQL_ADMIN_PASSWORD" -i "$SQL_SCRIPT" -C
  success "Database schema applied."
else
  warn "sqlcmd not found or init.sql missing."
  warn "Please run api/sql/init.sql manually via Azure Portal Query Editor."
fi

# ── Print summary ─────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  Market4U Azure Deployment Summary"
echo "============================================================"
echo "  App URL:              $SWA_URL"
echo "  SQL Server:           $SQL_FQDN"
echo "  Storage Account:      $STORAGE_NAME"
echo ""
echo "  ⚠  Add the following secret to GitHub repository:"
echo "     Name:  AZURE_STATIC_WEB_APPS_API_TOKEN"
echo "     Value: $DEPLOY_TOKEN"
echo ""
echo "  GitHub → Settings → Secrets → Actions → New repository secret"
echo "============================================================"
echo ""
echo "  SQL Connection String (for reference only, do NOT commit):"
echo "  $SQL_CONN"
echo ""
echo "  Application Insights:"
echo "  $AI_CONN"
echo "============================================================"
