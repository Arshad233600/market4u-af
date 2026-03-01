import * as appInsights from "applicationinsights";

// Initialize Application Insights once at startup so all function modules
// that reference appInsights.defaultClient get a properly configured client.
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING).start();
}

import "./functions/ads";
import "./functions/admin";
import "./functions/auth";
import "./functions/dashboard";
import "./functions/diagnostics";
import "./functions/favorites";
import "./functions/messages";
import "./functions/generateDescription";
import "./functions/notifications";
import "./functions/upload";
import "./functions/uploadSas";
import "./functions/user";
import "./functions/wallet";
import "./functions/health";

// Startup sanity check: emit a loud warning if AUTH_SECRET is not configured or looks wrong.
// A missing/insecure/misconfigured secret causes all protected endpoints to return 503 (not 401)
// so operators can distinguish a configuration problem from a client auth failure.
import { isAuthSecretInsecure } from "./utils/authUtils";
if (isAuthSecretInsecure) {
  console.warn(
    '[STARTUP] MISCONFIGURED_AUTH_SECRET — AUTH_SECRET is missing, insecure, or set to an environment variable name instead of a real secret. ' +
    'All protected endpoints will return 503 misconfigured_auth until this is fixed. ' +
    'Set AUTH_SECRET to a strong random value (minimum 32 characters) in Azure Application Settings.'
  );
} else {
  const secretLen = (process.env.AUTH_SECRET ?? '').length;
  console.log(
    `[STARTUP] AUTH_SECRET is configured (length=${secretLen} chars, sufficient=${secretLen >= 32}).`
  );
}
