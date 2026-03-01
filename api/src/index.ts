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

// Startup sanity check: log AUTH_SECRET length so sign and verify can be confirmed to match.
// authUtils throws on startup if AUTH_SECRET is missing, so reaching here guarantees it is set.
import { isAuthSecretInsecure } from "./utils/authUtils";
console.log("AUTH_SECRET length:", process.env.AUTH_SECRET?.length);
if (isAuthSecretInsecure) {
  console.error('[STARTUP] AUTH_SECRET is missing. All protected endpoints will fail until this is fixed.');
} else {
  console.log(`[STARTUP] AUTH_SECRET is configured — length=${process.env.AUTH_SECRET?.length}.`);
}
