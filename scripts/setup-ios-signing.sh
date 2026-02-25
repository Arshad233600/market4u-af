#!/bin/bash
# ============================================================
# Market4U – iOS Signing Secrets Setup Script
# ============================================================
# This script converts your Apple Distribution certificate (.p12)
# and provisioning profile (.mobileprovision) into the base64-encoded
# strings required by the GitHub Actions iOS build workflow.
#
# Prerequisites:
#   • A paid Apple Developer account
#   • An Apple Distribution certificate exported as a .p12 file
#   • An Ad Hoc (or App Store) provisioning profile for app ID: af.market4u.app
#
# Usage:
#   chmod +x scripts/setup-ios-signing.sh
#   ./scripts/setup-ios-signing.sh \
#       --cert   /path/to/certificate.p12 \
#       --profile /path/to/profile.mobileprovision \
#       --team   YOURTEAMID \
#       --profile-name "Market4U Ad Hoc"
# ============================================================

set -euo pipefail

CERT_PATH=""
PROFILE_PATH=""
APPLE_TEAM_ID=""
PROFILE_NAME=""

# ---------- Parse arguments ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cert)    CERT_PATH="$2";    shift 2 ;;
    --profile) PROFILE_PATH="$2"; shift 2 ;;
    --team)    APPLE_TEAM_ID="$2"; shift 2 ;;
    --profile-name) PROFILE_NAME="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ---------- Validate inputs ----------
if [ -z "$CERT_PATH" ] || [ -z "$PROFILE_PATH" ] || [ -z "$APPLE_TEAM_ID" ] || [ -z "$PROFILE_NAME" ]; then
  echo ""
  echo "Usage:"
  echo "  ./scripts/setup-ios-signing.sh \\"
  echo "      --cert   /path/to/certificate.p12 \\"
  echo "      --profile /path/to/profile.mobileprovision \\"
  echo "      --team   YOURTEAMID \\"
  echo "      --profile-name \"Market4U Ad Hoc\""
  echo ""
  exit 1
fi

if [ ! -f "$CERT_PATH" ]; then
  echo "❌ Certificate file not found: $CERT_PATH"
  exit 1
fi

if [ ! -f "$PROFILE_PATH" ]; then
  echo "❌ Provisioning profile not found: $PROFILE_PATH"
  exit 1
fi

# ---------- Encode files ----------
echo ""
echo "========================================"
echo " Market4U iOS Signing Secrets Generator"
echo "========================================"
echo ""

CERT_B64=$(base64 -i "$CERT_PATH" | tr -d '\n')
PROFILE_B64=$(base64 -i "$PROFILE_PATH" | tr -d '\n')
KEYCHAIN_PASS=$(LC_ALL=C tr -dc 'A-Za-z0-9!@#%^&*' </dev/urandom | head -c 32)

echo "✅ Certificate encoded successfully."
echo "✅ Provisioning profile encoded successfully."
echo "✅ Generated a random KEYCHAIN_PASSWORD."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Add the following secrets to GitHub:"
echo " Repository → Settings → Secrets and variables → Actions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Secret name: BUILD_CERTIFICATE_BASE64"
echo "Value (copy everything between the lines):"
echo "----"
echo "$CERT_B64"
echo "----"
echo ""
echo "Secret name: P12_PASSWORD"
echo "Value: <the password you set when exporting the .p12 from Keychain Access>"
echo ""
echo "Secret name: KEYCHAIN_PASSWORD"
echo "Value (generated randomly – save it somewhere safe):"
echo "----"
echo "$KEYCHAIN_PASS"
echo "----"
echo ""
echo "Secret name: BUILD_PROVISION_PROFILE_BASE64"
echo "Value (copy everything between the lines):"
echo "----"
echo "$PROFILE_B64"
echo "----"
echo ""
echo "Secret name: APPLE_TEAM_ID"
echo "Value: $APPLE_TEAM_ID"
echo ""
echo "Secret name: PROVISIONING_PROFILE_NAME"
echo "Value: $PROFILE_NAME"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " After adding all 6 secrets, re-run the"
echo " 'Build iOS IPA' workflow from GitHub Actions."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
