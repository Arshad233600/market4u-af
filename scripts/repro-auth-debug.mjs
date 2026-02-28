#!/usr/bin/env node
/**
 * scripts/repro-auth-debug.mjs
 *
 * Reproduction script for 401 auth investigation.
 * 1. Logs in via POST /api/auth/login
 * 2. Immediately calls GET /api/auth/me (post-login session check)
 * 3. Polls GET /api/notifications every 5 seconds for 1 minute
 *
 * Prints: requestId, status, reason for every request.
 * NEVER prints the token or any secret.
 *
 * Usage:
 *   BASE_URL=https://your-app.azurestaticapps.net \
 *   EMAIL=user@example.com \
 *   PASSWORD=your-password \
 *   node scripts/repro-auth-debug.mjs
 */

import { randomUUID } from "crypto";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:7071";
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Usage: EMAIL=... PASSWORD=... node scripts/repro-auth-debug.mjs");
  process.exit(1);
}

let authToken = null;

/** Make a JSON request with a correlation ID. Never prints token. */
async function request(method, path, body) {
  const requestId = randomUUID();
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-client-request-id": requestId,
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const url = `${BASE_URL}/api${path}`;
  let status = 0;
  let reason = null;
  let ok = false;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    ok = res.ok;

    let json = {};
    try { json = await res.json(); } catch { /* ignore */ }

    reason = json?.reason ?? null;

    console.log(
      `[${new Date().toISOString()}] ${method} ${path}`,
      `status=${status}`,
      `requestId=${requestId}`,
      reason ? `reason=${reason}` : "",
      ok ? "✓" : "✗"
    );

    return { status, ok, json, requestId };
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] ${method} ${path}`,
      `NETWORK_ERROR=${err.message}`,
      `requestId=${requestId}`
    );
    return { status: 0, ok: false, json: {}, requestId };
  }
}

async function main() {
  console.log(`\n=== Auth Repro Debug Script ===`);
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`Email: ${EMAIL}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // Step 1: Login
  console.log("── Step 1: Login ──────────────────────────────────");
  const loginRes = await request("POST", "/auth/login", { email: EMAIL, password: PASSWORD });
  if (!loginRes.ok) {
    console.error("Login failed. Aborting.");
    process.exit(1);
  }
  // Store token without printing it
  authToken = loginRes.json?.data?.token ?? null;
  const hasToken = Boolean(authToken);
  console.log(`   hasToken=${hasToken} (token value not shown)\n`);

  // Step 2: Immediate /api/auth/me check
  console.log("── Step 2: POST-login /auth/me check ──────────────");
  const meRes = await request("GET", "/auth/me");
  if (meRes.status === 401) {
    console.warn(
      `   ⚠ login_ok_but_me_401: token was returned by login but /auth/me rejected it.`,
      `reason=${meRes.json?.reason ?? "unknown"}`,
      `requestId=${meRes.requestId}`
    );
  }
  console.log();

  // Step 3: Poll /api/notifications every 5s for 1 minute
  console.log("── Step 3: Polling /notifications every 5s for 60s ─");
  const pollStart = Date.now();
  const POLL_INTERVAL_MS = 5_000;
  const POLL_DURATION_MS = 60_000;

  while (Date.now() - pollStart < POLL_DURATION_MS) {
    await request("GET", "/notifications");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
