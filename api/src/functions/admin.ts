
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as sql from "mssql";
import { getPool } from "../db";
import { validateToken, authResponse } from "../utils/authUtils";

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "unknown";
}

/** Verify that the caller is authenticated and has the ADMIN role. */
async function requireAdmin(request: HttpRequest): Promise<{ userId: string } | HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr || !auth.userId) {
    return authErr ?? { status: 401, jsonBody: { error: "لطفا وارد حساب کاربری شوید." } };
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input("Id", sql.NVarChar, auth.userId)
    .query("SELECT Role FROM Users WHERE Id = @Id AND IsDeleted = 0");

  if (result.recordset.length === 0 || String(result.recordset[0].Role).toUpperCase() !== "ADMIN") {
    return { status: 403, jsonBody: { error: "شما اجازه دسترسی به این بخش را ندارید." } };
  }

  return { userId: auth.userId };
}

/** GET /admin/ads/pending – list ads awaiting approval */
export async function adminGetPendingAds(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const admin = await requireAdmin(request);
    if ("status" in admin) return admin;

    const pool = await getPool();
    const result = await pool
      .request()
      .query(
        `SELECT a.*, u.Name AS SellerName
         FROM Ads a
         LEFT JOIN Users u ON a.UserId = u.Id
         WHERE a.Status = 'PENDING' AND a.IsDeleted = 0
         ORDER BY a.CreatedAt ASC`
      );

    return { status: 200, jsonBody: result.recordset };
  } catch (err: unknown) {
    context.error("adminGetPendingAds Error", err);
    return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
  }
}

/** POST /admin/ads/{id}/approve – approve a pending ad */
export async function adminApproveAd(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const admin = await requireAdmin(request);
    if ("status" in admin) return admin;

    const id = request.params?.id;
    if (!id) return { status: 400, jsonBody: { error: "ID required" } };

    const pool = await getPool();
    const result = await pool
      .request()
      .input("Id", sql.NVarChar, id)
      .input("UpdatedAt", sql.DateTime, new Date())
      .query("UPDATE Ads SET Status = 'ACTIVE', UpdatedAt = @UpdatedAt WHERE Id = @Id AND IsDeleted = 0");

    if (result.rowsAffected[0] === 0) {
      return { status: 404, jsonBody: { error: "Ad not found" } };
    }

    return { status: 200, jsonBody: { success: true } };
  } catch (err: unknown) {
    context.error("adminApproveAd Error", err);
    return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
  }
}

/** POST /admin/ads/{id}/reject – reject a pending ad */
export async function adminRejectAd(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const admin = await requireAdmin(request);
    if ("status" in admin) return admin;

    const id = request.params?.id;
    if (!id) return { status: 400, jsonBody: { error: "ID required" } };

    const pool = await getPool();
    const result = await pool
      .request()
      .input("Id", sql.NVarChar, id)
      .input("UpdatedAt", sql.DateTime, new Date())
      .query("UPDATE Ads SET Status = 'REJECTED', UpdatedAt = @UpdatedAt WHERE Id = @Id AND IsDeleted = 0");

    if (result.rowsAffected[0] === 0) {
      return { status: 404, jsonBody: { error: "Ad not found" } };
    }

    return { status: 200, jsonBody: { success: true } };
  } catch (err: unknown) {
    context.error("adminRejectAd Error", err);
    return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
  }
}

/** GET /admin/users/pending-verification – list users awaiting identity verification */
export async function adminGetPendingVerifications(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const admin = await requireAdmin(request);
    if ("status" in admin) return admin;

    const pool = await getPool();
    const result = await pool
      .request()
      .query(
        `SELECT Id, Name, Email, Phone, AvatarUrl, IsVerified, VerificationStatus, Role, CreatedAt
         FROM Users
         WHERE VerificationStatus = 'PENDING' AND IsDeleted = 0
         ORDER BY CreatedAt ASC`
      );

    return { status: 200, jsonBody: result.recordset };
  } catch (err: unknown) {
    context.error("adminGetPendingVerifications Error", err);
    return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
  }
}

/** POST /admin/users/{userId}/verify – approve or reject a user's identity verification */
export async function adminVerifyUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const admin = await requireAdmin(request);
    if ("status" in admin) return admin;

    const userId = request.params?.userId;
    if (!userId) return { status: 400, jsonBody: { error: "User ID required" } };

    const body = (await request.json()) as { status?: string };
    const { status } = body;

    if (status !== "VERIFIED" && status !== "REJECTED") {
      return { status: 400, jsonBody: { error: "Invalid status. Must be VERIFIED or REJECTED." } };
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, userId)
      .input("VerificationStatus", sql.NVarChar, status)
      .input("UpdatedAt", sql.DateTime, new Date())
      .query(
        status === "VERIFIED"
          ? `UPDATE Users
             SET VerificationStatus = @VerificationStatus, IsVerified = 1, UpdatedAt = @UpdatedAt
             WHERE Id = @UserId AND IsDeleted = 0`
          : `UPDATE Users
             SET VerificationStatus = @VerificationStatus, UpdatedAt = @UpdatedAt
             WHERE Id = @UserId AND IsDeleted = 0`
      );

    if (result.rowsAffected[0] === 0) {
      return { status: 404, jsonBody: { error: "User not found" } };
    }

    return { status: 200, jsonBody: { success: true } };
  } catch (err: unknown) {
    context.error("adminVerifyUser Error", err);
    return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
  }
}

app.http("adminGetPendingAds", { methods: ["GET"], authLevel: "anonymous", route: "admin/ads/pending", handler: adminGetPendingAds });
app.http("adminApproveAd", { methods: ["POST"], authLevel: "anonymous", route: "admin/ads/{id}/approve", handler: adminApproveAd });
app.http("adminRejectAd", { methods: ["POST"], authLevel: "anonymous", route: "admin/ads/{id}/reject", handler: adminRejectAd });
app.http("adminGetPendingVerifications", { methods: ["GET"], authLevel: "anonymous", route: "admin/users/pending-verification", handler: adminGetPendingVerifications });
app.http("adminVerifyUser", { methods: ["POST"], authLevel: "anonymous", route: "admin/users/{userId}/verify", handler: adminVerifyUser });
