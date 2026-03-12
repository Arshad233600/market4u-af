import * as appInsights from "applicationinsights";

// Initialize Application Insights once at startup so all function modules
// that reference appInsights.defaultClient get a properly configured client.
// Wrapped in try-catch so that an invalid connection string cannot prevent all
// functions from loading (which would cause 502 for every API request).
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  try {
    appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING).start();
  } catch (err) {
    console.error('[STARTUP] Failed to initialize Application Insights:', (err as Error).message);
  }
}

import "./functions/ads";
import "./functions/admin";
import "./functions/auth";
import "./functions/chat";
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

// Startup sanity check: log AUTH_SECRET fingerprint (not the raw secret) so sign and
// verify can be confirmed to use the same secret across all deployments.
import { isAuthSecretInsecure } from "./utils/authUtils";
import { getSecretDiagnostics } from "./utils/authSecret";
if (isAuthSecretInsecure) {
  console.error('[STARTUP] AUTH_SECRET is missing or insecure. All protected endpoints will fail until this is fixed.');
} else {
  try {
    const { secretLength, secretFingerprint } = getSecretDiagnostics();
    console.log(`[STARTUP] AUTH_SECRET configured secretLength=${secretLength} secretFingerprint=${secretFingerprint}`);
  } catch (err) {
    console.error('[STARTUP] getSecretDiagnostics failed:', (err as Error).message);
  }
}
