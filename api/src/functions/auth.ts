import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool, resetPool } from "../db";
import * as sql from "mssql";
import { timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import * as appInsights from "applicationinsights";
import { validateToken, isAuthSecretInsecure, TOKEN_EXPIRATION_MS, authResponse } from "../utils/authUtils";
import { getAuthSecretStrict, getSecretDiagnostics } from "../utils/authSecret";
import { success, error, unauthorized, badRequest, serverError, serviceUnavailable } from "../utils/responses";
import { checkRateLimit } from "../utils/rateLimit";

// App Insights is initialized once in index.ts before all function modules are loaded.
const telemetry = appInsights.defaultClient;

// Secure password hashing with bcrypt
const SALT_ROUNDS = 10;

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Classifies a caught error from the auth path into a status + category pair.
 *
 * - DB_NOT_CONFIGURED (503): SqlConnectionString env var is absent.  Pool was never
 *   created, so resetPool is a no-op and should NOT be called.
 * - DB_UNAVAILABLE (503): transient network/server error; resetPool should be called
 *   so the next request starts with a fresh pool.
 * - UNEXPECTED (500): anything else — a real code bug or unknown condition.
 */
function classifyAuthError(err: unknown): { status: number; category: string } {
  const msg = errMsg(err);

  if (/Database not configured/i.test(msg)) {
    return { status: 503, category: "DB_NOT_CONFIGURED" };
  }

  if (err instanceof sql.ConnectionError) {
    return { status: 503, category: "DB_UNAVAILABLE" };
  }

  if (
    /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|login.*failed|Cannot open database|temporarily unavailable|connection.*closed/i.test(msg)
  ) {
    return { status: 503, category: "DB_UNAVAILABLE" };
  }

  return { status: 500, category: "UNEXPECTED" };
}

const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

/** Signs a token using HS256 via jsonwebtoken with 7-day expiry. */
function signToken(payload: object): string {
  if (isAuthSecretInsecure) {
    throw new Error('[signToken] AUTH_SECRET is set to an insecure placeholder value. Configure a real secret in Azure Application Settings.');
  }
  const secret = getAuthSecretStrict();
  console.log("Signing with secret length:", secret.length);
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '7d' });
}

export async function login(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const startTime = Date.now();
  // Fail fast if AUTH_SECRET is not securely configured; a token signed with a placeholder
  // secret is as insecure as having no auth at all.
  if (isAuthSecretInsecure) {
    context.error("[login] AUTH_SECRET is insecure — rejecting login to prevent signing tokens with placeholder secret");
    return serviceUnavailable('insecure_default_secret');
  }
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return badRequest("ایمیل و رمز عبور الزامی است.");
    }

    // Rate-limit by email + client IP to prevent credential stuffing.
    // x-forwarded-for is set by the Azure / reverse-proxy layer; fall back to
    // x-client-ip if present, otherwise use the email alone as the key.
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-client-ip") ||
      "";
    const rateLimitKey = `login:${email}:${clientIp}`;
    const rateResult = await checkRateLimit({ identifier: rateLimitKey, maxRequests: 10, windowMs: 15 * 60 * 1000 });
    const rateLimitHeaders = {
      'x-rate-limit-store': rateResult.storeType,
      'x-rate-limit-limit': '10',
      'x-rate-limit-remaining': String(rateResult.remaining),
      'x-rate-limit-reset': String(Math.ceil(rateResult.resetAt / 1000)),
    };
    if (!rateResult.allowed) {
      context.warn(`[login] rate_limit_exceeded identifier=${rateLimitKey}`);
      return { status: 429, headers: rateLimitHeaders, jsonBody: { error: "Too many login attempts. Please try again later." } };
    }

    const pool = await getPool();
    // Fetch user + full profile in a single query to reduce DB round-trips and avoid
    // a second query that could fail on databases missing the VerificationStatus column.
    const result = await pool
      .request()
      .input("Email", sql.NVarChar, email)
      .query(`SELECT TOP 1 Id, Name, Email, Phone, PasswordHash, AvatarUrl, Role,
                IsVerified, VerificationStatus, CreatedAt
              FROM Users WHERE Email = @Email AND IsDeleted = 0`);

    const user = result.recordset?.[0];
    if (!user) {
      telemetry?.trackEvent({ name: "LoginFailed", properties: { reason: "UserNotFound" } });
      return unauthorized("نام کاربری یا رمز عبور اشتباه است.");
    }

    // Guard: if PasswordHash is null or empty (e.g. OAuth-only account or legacy data),
    // bcrypt.compare would throw "Illegal arguments" → treat as invalid credentials.
    if (!user.PasswordHash) {
      telemetry?.trackEvent({ name: "LoginFailed", properties: { reason: "NoPasswordSet" } });
      return unauthorized("نام کاربری یا رمز عبور اشتباه است.");
    }

    // Verify password with bcrypt
    const validPassword = await verifyPassword(password, user.PasswordHash);
    if (!validPassword) {
      telemetry?.trackEvent({ name: "LoginFailed", properties: { reason: "InvalidPassword" } });
      return unauthorized("نام کاربری یا رمز عبور اشتباه است.");
    }

    const token = signToken({
      uid: user.Id
    });

    telemetry?.trackEvent({ name: "LoginSucceeded", properties: { userId: user.Id } });
    telemetry?.trackMetric({ name: "LoginDuration", value: Date.now() - startTime });

    return success({
      token,
      user: {
        id: user.Id,
        name: user.Name,
        email: user.Email,
        phone: user.Phone || '',
        avatarUrl: user.AvatarUrl || '',
        role: user.Role,
        isVerified: user.IsVerified,
        verificationStatus: user.VerificationStatus || 'NONE',
        joinDate: user.CreatedAt
      }
    });
  } catch (err: unknown) {
    telemetry?.trackException({ exception: err instanceof Error ? err : new Error(String(err)) });
    context.error("Login Error", err);
    const { status, category } = classifyAuthError(err);
    if (status === 503) {
      if (category !== "DB_NOT_CONFIGURED") {
        resetPool().catch(() => {});
      }
      const reason = category === "DB_NOT_CONFIGURED" ? "db_not_configured" : "db_unavailable";
      return { status: 503, jsonBody: { success: false, error: "سرویس موقتاً در دسترس نیست. لطفاً دوباره تلاش کنید.", category, reason } };
    }
    return serverError(err, "خطای سرور");
  }
}

export async function register(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const startTime = Date.now();
  if (isAuthSecretInsecure) {
    context.error("[register] AUTH_SECRET is insecure — rejecting register to prevent signing tokens with placeholder secret");
    return serviceUnavailable('insecure_default_secret');
  }
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string; phone?: string };
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const phone = String(body?.phone ?? "").trim() || null;

    if (!name) {
      return badRequest("نام الزامی است.");
    }

    if (!email) {
      return badRequest("ایمیل الزامی است.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return badRequest("فرمت ایمیل نامعتبر است.");
    }

    if (!password) {
      return badRequest("رمز عبور الزامی است.");
    }

    if (password.length < 8) {
      return badRequest("رمز عبور باید حداقل ۸ کاراکتر باشد.");
    }

    const pool = await getPool();
    const emailDomain = email.split('@')[1] ?? 'unknown';
    context.log(`Register attempt for domain: ${emailDomain}`);
    telemetry?.trackEvent({ name: "RegisterAttempted", properties: { emailDomain } });
    const id = `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if email exists (including soft-deleted accounts to avoid UNIQUE constraint violations)
    const check = await pool
      .request()
      .input("Email", sql.NVarChar, email)
      .query("SELECT TOP 1 Id FROM Users WHERE Email = @Email");

    if (check.recordset.length > 0) {
      telemetry?.trackEvent({ name: "RegisterFailed", properties: { reason: "EmailAlreadyExists" } });
      return error("این ایمیل قبلاً ثبت شده است.", 409);
    }

    // Hash password with bcrypt
    const passwordHash = await hashPassword(password);

    await pool
      .request()
      .input("Id", sql.NVarChar, id)
      .input("Name", sql.NVarChar, name)
      .input("Email", sql.NVarChar, email)
      .input("Phone", sql.NVarChar, phone)
      .input("PasswordHash", sql.NVarChar, passwordHash)
      .input("Role", sql.NVarChar, "USER")
      .input("CreatedAt", sql.DateTime, new Date())
      .query(`
        INSERT INTO Users (Id, Name, Email, Phone, PasswordHash, Role, IsVerified, IsDeleted, CreatedAt)
        VALUES (@Id, @Name, @Email, @Phone, @PasswordHash, @Role, 0, 0, @CreatedAt)
      `);

    context.log(`User registered successfully: ${id}`);
    telemetry?.trackEvent({ name: "RegisterSucceeded", properties: { userId: id } });
    telemetry?.trackMetric({ name: "RegisterDuration", value: Date.now() - startTime });
    const token = signToken({ uid: id });

    return success({
      token,
      user: { id, name, email, phone: phone || '', avatarUrl: '', role: "USER", isVerified: false, verificationStatus: 'NONE', joinDate: new Date().toISOString() }
    }, 201);
  } catch (err: unknown) {
    telemetry?.trackException({ exception: err instanceof Error ? err : new Error(String(err)) });
    context.error("Register Error", err);
    const { status, category } = classifyAuthError(err);
    if (status === 503) {
      if (category !== "DB_NOT_CONFIGURED") {
        resetPool().catch(() => {});
      }
      const reason = category === "DB_NOT_CONFIGURED" ? "db_not_configured" : "db_unavailable";
      return { status: 503, jsonBody: { success: false, error: "سرویس موقتاً در دسترس نیست. لطفاً دوباره تلاش کنید.", category, reason } };
    }
    return serverError(err, "خطای سرور");
  }
}

app.http("login", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "auth/login",
  handler: login
});

app.http("register", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "auth/register",
  handler: register
});

export async function getMe(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) {
    // auth.reason is always set by validateToken for unauthenticated results;
    // the 'unknown_reason' fallback is a safety net only.
    const reason = auth.reason ?? "unknown_reason";
    const authHeaderPresent = !!request.headers.get("authorization");
    let path = "unknown";
    try { path = new URL(request.url).pathname; } catch { /* path is only used for logging; default "unknown" is safe */ }
    const method = request.method;
    context.warn(`[getMe] auth_failed requestId=${auth.requestId ?? 'none'} reason=${reason} authHeaderPresent=${authHeaderPresent}`);
    telemetry?.trackTrace({
      message: "[getMe] auth_failed",
      properties: {
        requestId: auth.requestId ?? "none",
        reason,
        authHeaderPresent: String(authHeaderPresent),
        path,
        method,
        category: "AUTH_REQUIRED",
      },
    });
    return authErr;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query("SELECT Id, Name, Email, Phone, AvatarUrl, Role, IsVerified, VerificationStatus, CreatedAt FROM Users WHERE Id = @UserId");

    if (result.recordset.length === 0) {
      telemetry?.trackEvent({ name: "GetMeFailed", properties: { reason: "UserNotFound", userId: auth.userId ?? "" } });
      return error("User not found", 404);
    }

    const user = result.recordset[0];
    telemetry?.trackEvent({ name: "GetMeSucceeded", properties: { userId: user.Id } });
    return success({
      id: user.Id,
      name: user.Name,
      email: user.Email,
      phone: user.Phone,
      avatarUrl: user.AvatarUrl,
      role: user.Role,
      isVerified: user.IsVerified,
      verificationStatus: user.VerificationStatus || 'NONE',
      joinDate: user.CreatedAt
    });
  } catch (err: unknown) {
    telemetry?.trackException({ exception: err instanceof Error ? err : new Error(String(err)) });
    context.error("GetMe Error", err);
    const { status, category } = classifyAuthError(err);
    if (status === 503) {
      if (category !== "DB_NOT_CONFIGURED") {
        resetPool().catch(() => {});
      }
      const reason = category === "DB_NOT_CONFIGURED" ? "db_not_configured" : "db_unavailable";
      return { status: 503, jsonBody: { success: false, error: "سرویس موقتاً در دسترس نیست. لطفاً دوباره تلاش کنید.", category, reason } };
    }
    return serverError(err);
  }
}

app.http("getMe", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/me",
  handler: getMe
});

/** How long after expiry a token can still be refreshed (30-day grace window). */
const TOKEN_REFRESH_GRACE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * POST /api/auth/refresh
 * Accepts a Bearer token that is valid or recently expired (within the 30-day grace
 * window) and issues a fresh token for the same user.  Tokens older than
 * TOKEN_EXPIRATION_MS + TOKEN_REFRESH_GRACE_MS are rejected with reason "token_too_old".
 */
export async function refreshTokenHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Insecure secret: refreshing would produce a new token signed with a placeholder —
  // return 503 so the client knows the server is misconfigured.
  if (isAuthSecretInsecure) {
    context.error("[refreshToken] AUTH_SECRET is insecure — rejecting refresh");
    return serviceUnavailable('insecure_default_secret');
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return unauthorized("توکن احراز هویت الزامی است.", "missing_token");
  }

  // Use slice('Bearer '.length) + trim to robustly extract the token; split(" ")[1] would
  // silently return "" for "Bearer " (empty value) and fall through to invalid_token.
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return unauthorized("توکن احراز هویت الزامی است.", "missing_token");
  }

  let secret: string;
  try {
    secret = getAuthSecretStrict();
  } catch (err) {
    context.error("RefreshToken Config Error", err);
    return serverError(err, "خطای پیکربندی سرور");
  }

  try {
    // Verify using jwt.verify; ignoreExpiration allows refreshing recently-expired tokens
    // within the grace window. Signature and algorithm are always verified.
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, secret, { algorithms: ['HS256'], ignoreExpiration: true }) as jwt.JwtPayload;
    } catch (verifyErr) {
      context.warn(`[RefreshToken] jwt.verify error="${(verifyErr as Error).message}"`);
      return unauthorized("توکن نامعتبر است.", "invalid_token");
    }

    if (!payload.uid) {
      return unauthorized("توکن نامعتبر است.", "invalid_token");
    }

    // jwt standard: iat is in seconds; convert to ms for grace-window check
    const issuedAtMs = (payload.iat ?? 0) * 1000;
    const tokenAge = Date.now() - issuedAtMs;
    if (tokenAge > TOKEN_EXPIRATION_MS + TOKEN_REFRESH_GRACE_MS) {
      // Token is too old even for the grace window — full re-login required
      return unauthorized("نشست شما به طور کامل منقضی شده است. لطفاً دوباره وارد شوید.", "token_too_old");
    }

    const newToken = signToken({ uid: payload.uid });
    telemetry?.trackEvent({ name: "TokenRefreshed", properties: { userId: payload.uid as string } });
    return success({ token: newToken });
  } catch (err: unknown) {
    telemetry?.trackException({ exception: err instanceof Error ? err : new Error(String(err)) });
    context.error("RefreshToken Error", err);
    return unauthorized("توکن نامعتبر است.", "invalid_token");
  }
}

app.http("refreshToken", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "auth/refresh",
  handler: refreshTokenHandler
});

/**
 * GET /api/auth/diag
 * Production-safe diagnostics: returns secret fingerprint (NOT the raw secret) and
 * build metadata so operators can confirm all deployments share the same AUTH_SECRET.
 *
 * Only enabled when AUTH_DIAG_ENABLED=true in Azure Application Settings.
 * Requires X-Diag-Allowlist header matching DIAG_ALLOWLIST env var (comma-separated IPs).
 */
export async function authDiag(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Feature gate: disabled unless AUTH_DIAG_ENABLED=true
  if (process.env.AUTH_DIAG_ENABLED !== 'true') {
    return { status: 404, jsonBody: { error: 'Not found' } };
  }

  // Simple allowlist guard: client must supply X-Diag-Allowlist header that matches
  // one of the values in the DIAG_ALLOWLIST env var (comma-separated).
  // Timing-safe comparison prevents timing-based oracle attacks.
  const allowlist = (process.env.DIAG_ALLOWLIST ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const provided = request.headers.get('x-diag-allowlist') ?? '';
  if (allowlist.length > 0) {
    const providedBuf = Buffer.from(provided);
    const matched = allowlist.some((entry) => {
      const entryBuf = Buffer.from(entry);
      return (
        providedBuf.length === entryBuf.length &&
        timingSafeEqual(providedBuf, entryBuf)
      );
    });
    if (!matched) {
      context.warn(`[authDiag] unauthorized access attempt requestId=${request.headers.get('x-client-request-id') ?? 'none'}`);
      return { status: 403, jsonBody: { error: 'Forbidden' } };
    }
  }

  let secretLength = 0;
  let secretFingerprint = 'unavailable';
  try {
    const diag = getSecretDiagnostics();
    secretLength = diag.secretLength;
    secretFingerprint = diag.secretFingerprint;
  } catch (err) {
    context.warn(`[authDiag] getSecretDiagnostics failed: ${(err as Error).message}`);
  }

  return {
    status: 200,
    jsonBody: {
      secretLength,
      secretFingerprint,
      nodeEnv: process.env.NODE_ENV ?? 'unknown',
      buildCommitSha: process.env.BUILD_COMMIT_SHA ?? process.env.WEBSITE_RUN_FROM_PACKAGE ?? 'unknown',
    },
  };
}

app.http("authDiag", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/diag",
  handler: authDiag
});
