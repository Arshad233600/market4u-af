import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db";
import * as sql from "mssql";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { validateToken } from "../utils/authUtils";
import { success, error, unauthorized, badRequest, serverError } from "../utils/responses";

// ⚠️ برای امنیت، این را در Azure به عنوان ENV اضافه کن: AUTH_SECRET
// اگر نبود، fallback می‌گذاریم ولی حتماً در prod ست کن.
const AUTH_SECRET = process.env.AUTH_SECRET || "CHANGE_ME_IN_AZURE";

// Secure password hashing with bcrypt
const SALT_ROUNDS = 10;

const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

// Legacy helper - remove after full migration to standardized responses
function json(status: number, body: Record<string, unknown>): HttpResponseInit {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    jsonBody: body
  };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "unknown";
}

/** Signed token: base64(payload).base64(signature) */
function signToken(payload: object): string {
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export async function login(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
      .query("SELECT TOP 1 Id, Name, Email, Role, IsVerified, PasswordHash FROM Users WHERE Email = @Email");

    const user = result.recordset?.[0];
    if (!user) {
      return unauthorized("نام کاربری یا رمز عبور اشتباه است.");
    }

    // Verify password with bcrypt
    const validPassword = await verifyPassword(password, user.PasswordHash);
    if (!validPassword) {
      return unauthorized("نام کاربری یا رمز عبور اشتباه است.");
    }

    const token = signToken({
      uid: user.Id,
      iat: Date.now()
    });

    return success({
      token,
      user: {
        id: user.Id,
        name: user.Name,
        email: user.Email,
        role: user.Role,
        isVerified: user.IsVerified
      }
    });
  } catch (err: unknown) {
    context.error("Login Error", err);
    return serverError(err, "خطای سرور");
  }
}

export async function register(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string; phone?: string };
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");
    const phone = String(body?.phone ?? "").trim();

    if (!email || !password || !name) {
      return badRequest("اطلاعات ناقص است.");
    }

    if (password.length < 6) {
      return badRequest("رمز عبور باید حداقل ۶ کاراکتر باشد.");
    }

    const pool = await getPool();
    const id = `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if email exists
    const check = await pool
      .request()
      .input("Email", sql.NVarChar, email)
      .query("SELECT TOP 1 Id FROM Users WHERE Email = @Email");

    if (check.recordset.length > 0) {
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
        INSERT INTO Users (Id, Name, Email, Phone, PasswordHash, Role, CreatedAt)
        VALUES (@Id, @Name, @Email, @Phone, @PasswordHash, @Role, @CreatedAt)
      `);

    const token = signToken({ uid: id, iat: Date.now() });

    return success({
      token,
      user: { id, name, email, role: "USER", isVerified: false }
    }, 201);
  } catch (err: unknown) {
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
      return error("User not found", 404);
    }

    const user = result.recordset[0];
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
