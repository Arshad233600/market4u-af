import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db";
import * as sql from "mssql";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import * as appInsights from "applicationinsights";
import { validateToken, getAuthSecretOrThrow } from "../utils/authUtils";
import { success, error, unauthorized, badRequest, serverError } from "../utils/responses";

// Initialize App Insights (Telemetry)
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING).start();
}
const telemetry = appInsights.defaultClient;

// Secure password hashing with bcrypt
const SALT_ROUNDS = 10;

const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

/** Signed token: base64(payload).base64(signature) */
function signToken(payload: object): string {
  const secret = getAuthSecretOrThrow();
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export async function login(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const startTime = Date.now();
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return badRequest("ایمیل و رمز عبور الزامی است.");
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("Email", sql.NVarChar, email)
      .query("SELECT TOP 1 Id, PasswordHash FROM Users WHERE Email = @Email AND IsDeleted = 0");

    const user = result.recordset?.[0];
    if (!user) {
      telemetry?.trackEvent({ name: "LoginFailed", properties: { reason: "UserNotFound" } });
      return unauthorized("نام کاربری یا رمز عبور اشتباه است.");
    }

    // Verify password with bcrypt
    const validPassword = await verifyPassword(password, user.PasswordHash);
    if (!validPassword) {
      telemetry?.trackEvent({ name: "LoginFailed", properties: { reason: "InvalidPassword" } });
      return unauthorized("نام کاربری یا رمز عبور اشتباه است.");
    }

    // Fetch full profile (without PasswordHash) for the response
    const profileResult = await pool
      .request()
      .input("Id", sql.NVarChar, user.Id)
      .query("SELECT Id, Name, Email, Phone, AvatarUrl, Role, IsVerified, CreatedAt FROM Users WHERE Id = @Id");

    const profile = profileResult.recordset[0];

    const token = signToken({
      uid: user.Id,
      iat: Date.now()
    });

    telemetry?.trackEvent({ name: "LoginSucceeded", properties: { userId: user.Id } });
    telemetry?.trackMetric({ name: "LoginDuration", value: Date.now() - startTime });

    return success({
      token,
      user: {
        id: profile.Id,
        name: profile.Name,
        email: profile.Email,
        phone: profile.Phone || '',
        avatarUrl: profile.AvatarUrl || '',
        role: profile.Role,
        isVerified: profile.IsVerified,
        joinDate: profile.CreatedAt
      }
    });
  } catch (err: unknown) {
    telemetry?.trackException({ exception: err instanceof Error ? err : new Error(String(err)) });
    context.error("Login Error", err);
    return serverError(err, "خطای سرور");
  }
}

export async function register(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const startTime = Date.now();
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
    const token = signToken({ uid: id, iat: Date.now() });

    return success({
      token,
      user: { id, name, email, phone: phone || '', avatarUrl: '', role: "USER", isVerified: false, joinDate: new Date().toISOString() }
    }, 201);
  } catch (err: unknown) {
    telemetry?.trackException({ exception: err instanceof Error ? err : new Error(String(err)) });
    context.error("Register Error", err);
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
  if (!auth.isAuthenticated) {
    return unauthorized();
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query("SELECT Id, Name, Email, Phone, AvatarUrl, Role, IsVerified, CreatedAt FROM Users WHERE Id = @UserId");

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
      joinDate: user.CreatedAt
    });
  } catch (err: unknown) {
    telemetry?.trackException({ exception: err instanceof Error ? err : new Error(String(err)) });
    context.error("GetMe Error", err);
    return serverError(err);
  }
}

app.http("getMe", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/me",
  handler: getMe
});
