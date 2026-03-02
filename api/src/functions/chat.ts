import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as sql from "mssql";
import { randomUUID } from "crypto";
import { getPool } from "../db";
import { validateToken, authResponse } from "../utils/authUtils";

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "unknown";
}

/** GET /chat/requests — returns pending chat requests addressed to the current user */
export async function getChatRequests(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query(`
        SELECT cr.Id, cr.FromUserId, u.Name AS FromUserName, cr.ToUserId, cr.Status, cr.CreatedAt
        FROM ChatRequests cr
        JOIN Users u ON cr.FromUserId = u.Id
        WHERE cr.ToUserId = @UserId AND cr.Status = 'PENDING'
        ORDER BY cr.CreatedAt DESC
      `);

    return { status: 200, jsonBody: result.recordset };
  } catch (err: unknown) {
    context.error("getChatRequests Error", err);
    return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
  }
}

/** POST /chat/requests — send a chat request to another user */
export async function sendChatRequest(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as { toUserId?: string };
    const toUserId = body?.toUserId;

    if (!toUserId) {
      return { status: 400, jsonBody: { error: "toUserId is required" } };
    }

    if (toUserId === auth.userId) {
      return { status: 400, jsonBody: { error: "Cannot send a chat request to yourself" } };
    }

    const pool = await getPool();

    // Verify the target user exists
    const userCheck = await pool
      .request()
      .input("ToUserId", sql.NVarChar, toUserId)
      .query("SELECT Id FROM Users WHERE Id = @ToUserId AND IsDeleted = 0");

    if (userCheck.recordset.length === 0) {
      return { status: 404, jsonBody: { error: "User not found" } };
    }

    // Check for an existing PENDING request
    const existing = await pool
      .request()
      .input("FromUserId", sql.NVarChar, auth.userId)
      .input("ToUserId", sql.NVarChar, toUserId)
      .query(`
        SELECT Id FROM ChatRequests
        WHERE FromUserId = @FromUserId AND ToUserId = @ToUserId AND Status = 'PENDING'
      `);

    if (existing.recordset.length > 0) {
      return { status: 409, jsonBody: { error: "A pending chat request already exists" } };
    }

    const id = randomUUID();
    await pool
      .request()
      .input("Id", sql.NVarChar, id)
      .input("FromUserId", sql.NVarChar, auth.userId)
      .input("ToUserId", sql.NVarChar, toUserId)
      .input("CreatedAt", sql.DateTime, new Date())
      .query(`
        INSERT INTO ChatRequests (Id, FromUserId, ToUserId, Status, CreatedAt)
        VALUES (@Id, @FromUserId, @ToUserId, 'PENDING', @CreatedAt)
      `);

    return { status: 201, jsonBody: { success: true, id } };
  } catch (err: unknown) {
    context.error("sendChatRequest Error", err);
    return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
  }
}

/** POST /chat/requests/{requestId}/accept — accept a chat request */
export async function acceptChatRequest(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  const requestId = request.params?.requestId;
  if (!requestId) {
    return { status: 400, jsonBody: { error: "requestId is required" } };
  }

  try {
    const pool = await getPool();

    // Verify the request exists and belongs to the current user as the recipient
    const reqResult = await pool
      .request()
      .input("Id", sql.NVarChar, requestId)
      .input("ToUserId", sql.NVarChar, auth.userId)
      .query("SELECT Id, FromUserId FROM ChatRequests WHERE Id = @Id AND ToUserId = @ToUserId AND Status = 'PENDING'");

    if (reqResult.recordset.length === 0) {
      return { status: 404, jsonBody: { error: "Chat request not found or already processed" } };
    }

    const fromUserId = reqResult.recordset[0].FromUserId as string;

    // Mark request as ACCEPTED
    await pool
      .request()
      .input("Id", sql.NVarChar, requestId)
      .query("UPDATE ChatRequests SET Status = 'ACCEPTED' WHERE Id = @Id");

    // Create an initial message to establish the conversation thread
    const msgId = randomUUID();
    await pool
      .request()
      .input("Id", sql.NVarChar, msgId)
      .input("FromUserId", sql.NVarChar, auth.userId)
      .input("ToUserId", sql.NVarChar, fromUserId)
      .input("Content", sql.NVarChar, "👋")
      .input("CreatedAt", sql.DateTime, new Date())
      .query(`
        INSERT INTO Messages (Id, FromUserId, ToUserId, AdId, Content, IsRead, CreatedAt)
        VALUES (@Id, @FromUserId, @ToUserId, NULL, @Content, 0, @CreatedAt)
      `);

    return { status: 200, jsonBody: { success: true, conversationId: fromUserId } };
  } catch (err: unknown) {
    context.error("acceptChatRequest Error", err);
    return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
  }
}

/** POST /chat/requests/{requestId}/reject — reject a chat request */
export async function rejectChatRequest(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  const requestId = request.params?.requestId;
  if (!requestId) {
    return { status: 400, jsonBody: { error: "requestId is required" } };
  }

  try {
    const pool = await getPool();

    const reqResult = await pool
      .request()
      .input("Id", sql.NVarChar, requestId)
      .input("ToUserId", sql.NVarChar, auth.userId)
      .query("SELECT Id FROM ChatRequests WHERE Id = @Id AND ToUserId = @ToUserId AND Status = 'PENDING'");

    if (reqResult.recordset.length === 0) {
      return { status: 404, jsonBody: { error: "Chat request not found or already processed" } };
    }

    await pool
      .request()
      .input("Id", sql.NVarChar, requestId)
      .query("UPDATE ChatRequests SET Status = 'REJECTED' WHERE Id = @Id");

    return { status: 200, jsonBody: { success: true } };
  } catch (err: unknown) {
    context.error("rejectChatRequest Error", err);
    return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
  }
}

app.http("getChatRequests", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "chat/requests",
  handler: getChatRequests
});

app.http("sendChatRequest", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "chat/requests",
  handler: sendChatRequest
});

app.http("acceptChatRequest", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "chat/requests/{requestId}/accept",
  handler: acceptChatRequest
});

app.http("rejectChatRequest", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "chat/requests/{requestId}/reject",
  handler: rejectChatRequest
});
