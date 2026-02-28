import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as sql from "mssql";
import { getPool } from "../db";
import { validateToken, MISCONFIGURED_REASONS, authResponse } from "../utils/authUtils";
import { serverError, serviceUnavailable } from "../utils/responses";

export async function getNotifications(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  if (!auth.isAuthenticated) {
    // Server mis-configuration (AUTH_SECRET missing or insecure) — surface as 503 so the
    // operator knows the environment needs attention.
    if (auth.reason && MISCONFIGURED_REASONS.has(auth.reason)) {
      return serviceUnavailable(auth.reason);
    }
    // No valid session (missing token, expired token, or signature mismatch) — return an
    // empty list instead of 401 so unauthenticated page loads don't produce a console error.
    // Unauthenticated users have no notifications, so an empty array is semantically correct.
    return { status: 200, jsonBody: [] };
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query(`
        SELECT TOP 50 Id, UserId, Title, Message, Type, IsRead, CreatedAt
        FROM Notifications
        WHERE UserId = @UserId
        ORDER BY CreatedAt DESC
      `);

    return { status: 200, jsonBody: result.recordset };
  } catch (err: unknown) {
    context.error("getNotifications Error", err);
    return serverError(err);
  }
}

export async function markNotificationsRead(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    const { id } = body;

    const pool = await getPool();
    const req = pool.request().input("UserId", sql.NVarChar, auth.userId);

    if (id) {
      req.input("Id", sql.NVarChar, id);
      await req.query("UPDATE Notifications SET IsRead = 1 WHERE Id = @Id AND UserId = @UserId");
    } else {
      await req.query("UPDATE Notifications SET IsRead = 1 WHERE UserId = @UserId AND IsRead = 0");
    }

    return { status: 200, jsonBody: { success: true } };
  } catch (err: unknown) {
    context.error("markNotificationsRead Error", err);
    return serverError(err);
  }
}

app.http("getNotifications", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "notifications",
  handler: getNotifications
});

app.http("markNotificationsRead", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "notifications/read",
  handler: markNotificationsRead
});
