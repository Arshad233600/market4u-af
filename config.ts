
// Configuration for Azure Connection

// Safe access to process.env or import.meta.env for different build environments
const getEnv = (key: string): string | undefined => {
    // 1. Check Vite import.meta.env (Modern Standard)
    // @ts-expect-error - import.meta is not available in all environments
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // Try VITE_ prefix first (Standard for Vite)
        const viteKey = key.replace('REACT_APP_', 'VITE_');
        // @ts-expect-error - import.meta.env might not have index signature
        if (import.meta.env[viteKey]) return import.meta.env[viteKey];
        // @ts-expect-error - import.meta.env might not have index signature
        if (import.meta.env[key]) return import.meta.env[key];
    }

    // 2. Check standard process.env (Node/CRA/Webpack/Azure runtime injection)
    if (typeof process !== 'undefined' && process.env) {
        // In Azure SWA, sometimes vars are just available directly
        if (process.env[key]) return process.env[key];
    }
    
    return undefined;
};

// In production, this comes from Azure Application Settings (Environment Variables)
// For Azure Static Web Apps, API is automatically proxied to /api
// In development, point to local Functions runtime
const rawApiUrl = getEnv('REACT_APP_API_URL') || getEnv('VITE_API_URL');
// Never use absolute URLs (e.g. azurewebsites.net) — always route through the SWA proxy.
// Absolute URLs bypass the SWA auth middleware and cause CORS/401 issues in production.
const apiUrl = (rawApiUrl && !rawApiUrl.startsWith('http')) ? rawApiUrl : undefined;
export const API_BASE_URL = apiUrl || '/api';

// Logic:
// Defaults to TRUE (demo/mock mode) so the app works without a database.
// To connect to a real Azure SQL database, set VITE_USE_MOCK_DATA=false
// as a build-time environment variable in the GitHub Actions workflow.
// The && ensures that setting EITHER variable to 'false' switches to live mode.
export const USE_MOCK_DATA = getEnv('VITE_USE_MOCK_DATA') !== 'false' && getEnv('REACT_APP_USE_MOCK_DATA') !== 'false';

// Set VITE_DEBUG_AUTH=true to enable auth diagnostics logging.
// NEVER logs token values — only boolean presence flags and counts.
export const DEBUG_AUTH = getEnv('VITE_DEBUG_AUTH') === 'true';

export const AZURE_AD_CONFIG = {
  clientId: getEnv('REACT_APP_AZURE_CLIENT_ID') || 'your-client-id',
  authority: getEnv('REACT_APP_AZURE_AUTHORITY') || 'https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/B2C_1_signin_signup',
  redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
};

// Log configuration status for debugging in Azure Console
console.log(`%c Market4U Config Loaded `, 'background: #059669; color: #fff; font-weight: bold; border-radius: 4px; padding: 4px;');
const envName = getEnv('NODE_ENV') || 'development';
console.log(`Environment: ${envName}`);
console.log(`Mode: ${USE_MOCK_DATA ? '🟢 Demo / Mock Data' : '🔵 Live API Connected'}`);
console.log(`API Endpoint: ${API_BASE_URL}`);
