import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as sql from "mssql";
import { getPool } from "../db";
import { validateToken } from "../utils/authUtils";
import { unauthorized, serverError } from "../utils/responses";

export async function getNotifications(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  if (!auth.isAuthenticated) return unauthorized();

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
  if (!auth.isAuthenticated) return unauthorized();

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
