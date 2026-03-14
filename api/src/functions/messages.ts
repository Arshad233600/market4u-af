import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as sql from "mssql";
import { getPool } from "../db";
import { validateToken, authResponse } from "../utils/authUtils";
import { generateUUID } from "../utils/uuidUtils";

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "unknown";
}

export async function getInbox(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // G) Defensive auth check: if userId is missing, always return 401 (never 503)
    const auth = validateToken(request);
    if (!auth.isAuthenticated || !auth.userId) {
      console.error("[getInbox] unauthorized", auth.reason);
      return { status: 401, jsonBody: { error: "Unauthorized" } };
    }

    // C) Verify SQL connection string exists before attempting DB access
    const connStr =
      process.env.SqlConnectionString ||
      process.env.SQLCONNECTIONSTRING ||
      process.env.AZURE_SQL_CONNECTION_STRING;
    if (
      !connStr &&
      (!process.env.DB_SERVER || !process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD)
    ) {
      console.error("[getInbox] database connection string not configured");
      return { status: 503, jsonBody: { error: "Service temporarily unavailable" } };
    }

    // D) Log userId extracted from JWT and query parameters
    console.log(`[getInbox] userId=${auth.userId}`);

    const pool = await getPool();

    // Get unique conversations with latest message
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query(`
        WITH LatestMessages AS (
          SELECT 
            CASE 
              WHEN FromUserId = @UserId THEN ToUserId 
              ELSE FromUserId 
            END AS OtherUserId,
            MAX(CreatedAt) AS LastMessageTime
          FROM Messages
          WHERE FromUserId = @UserId OR ToUserId = @UserId
          GROUP BY CASE WHEN FromUserId = @UserId THEN ToUserId ELSE FromUserId END
        )
        SELECT 
          lm.OtherUserId,
          u.Name AS OtherUserName,
          u.AvatarUrl AS OtherUserAvatar,
          m.Content AS LastMessage,
          m.CreatedAt AS LastMessageTime,
          m.IsRead,
          m.FromUserId,
          (SELECT COUNT(*) FROM Messages 
           WHERE ToUserId = @UserId 
             AND FromUserId = lm.OtherUserId 
             AND IsRead = 0) AS UnreadCount
        FROM LatestMessages lm
        JOIN Users u ON lm.OtherUserId = u.Id
        JOIN Messages m ON (
          (m.FromUserId = @UserId AND m.ToUserId = lm.OtherUserId) OR
          (m.ToUserId = @UserId AND m.FromUserId = lm.OtherUserId)
        ) AND m.CreatedAt = lm.LastMessageTime
        ORDER BY lm.LastMessageTime DESC
      `);

    // G) If DB result undefined → return empty array
    return { status: 200, jsonBody: result?.recordset ?? [] };
  } catch (err: unknown) {
    // B) Detailed logging before returning error
    console.error("getInbox error:", err);
    context.error("getInbox Error", err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

export async function getThread(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  const otherUserId = request.params?.userId;
  if (!otherUserId) {
    return { status: 400, jsonBody: { error: "User ID required" } };
  }

  try {
    const pool = await getPool();

    // Get messages between two users
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .input("OtherUserId", sql.NVarChar, otherUserId)
      .query(`
        SELECT 
          m.*,
          fromUser.Name AS FromUserName,
          fromUser.AvatarUrl AS FromUserAvatar,
          toUser.Name AS ToUserName,
          toUser.AvatarUrl AS ToUserAvatar,
          a.Title AS AdTitle,
          a.MainImageUrl AS AdImage
        FROM Messages m
        JOIN Users fromUser ON m.FromUserId = fromUser.Id
        JOIN Users toUser ON m.ToUserId = toUser.Id
        LEFT JOIN Ads a ON m.AdId = a.Id
        WHERE (m.FromUserId = @UserId AND m.ToUserId = @OtherUserId)
           OR (m.FromUserId = @OtherUserId AND m.ToUserId = @UserId)
        ORDER BY m.CreatedAt ASC
      `);

    // Mark messages as read
    await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .input("OtherUserId", sql.NVarChar, otherUserId)
      .query(`
        UPDATE Messages 
        SET IsRead = 1 
        WHERE ToUserId = @UserId 
          AND FromUserId = @OtherUserId 
          AND IsRead = 0
      `);

    return { status: 200, jsonBody: result.recordset };
  } catch (err: unknown) {
    context.error("getThread Error", err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

export async function sendMessage(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as any;
    const { toUserId, content, adId } = body;

    if (!toUserId || !content || content.trim().length === 0) {
      return { status: 400, jsonBody: { error: "toUserId and content required" } };
    }

    // Prevent sending message to self
    if (toUserId === auth.userId) {
      return { status: 400, jsonBody: { error: "Cannot send message to yourself" } };
    }

    const pool = await getPool();

    // Verify recipient exists
    const userCheck = await pool
      .request()
      .input("UserId", sql.NVarChar, toUserId)
      .query("SELECT Id FROM Users WHERE Id = @UserId");

    if (userCheck.recordset.length === 0) {
      return { status: 404, jsonBody: { error: "Recipient not found" } };
    }

    const id = generateUUID();
    await pool
      .request()
      .input("Id", sql.NVarChar, id)
      .input("FromUserId", sql.NVarChar, auth.userId)
      .input("ToUserId", sql.NVarChar, toUserId)
      .input("AdId", sql.NVarChar, adId || null)
      .input("Content", sql.NVarChar, content.trim())
      .input("CreatedAt", sql.DateTime, new Date())
      .query(`
        INSERT INTO Messages (Id, FromUserId, ToUserId, AdId, Content, IsRead, CreatedAt)
        VALUES (@Id, @FromUserId, @ToUserId, @AdId, @Content, 0, @CreatedAt)
      `);

    return { status: 201, jsonBody: { success: true, id } };
  } catch (err: unknown) {
    context.error("sendMessage Error", err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

// Routes
app.http("getInbox", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "messages/inbox",
  handler: getInbox
});

app.http("getThread", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "messages/thread/{userId}",
  handler: getThread
});

app.http("sendMessage", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "messages",
  handler: sendMessage
});

export async function deleteMessage(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  const messageId = request.params?.messageId;
  if (!messageId) {
    return { status: 400, jsonBody: { error: "Message ID required" } };
  }

  try {
    const pool = await getPool();

    // Verify the message belongs to the requesting user before deleting
    const check = await pool
      .request()
      .input("MessageId", sql.NVarChar, messageId)
      .input("UserId", sql.NVarChar, auth.userId)
      .query("SELECT Id FROM Messages WHERE Id = @MessageId AND FromUserId = @UserId");

    if (check.recordset.length === 0) {
      return { status: 403, jsonBody: { error: "Message not found or access denied" } };
    }

    await pool
      .request()
      .input("MessageId", sql.NVarChar, messageId)
      .query("UPDATE Messages SET Content = '' WHERE Id = @MessageId");

    return { status: 200, jsonBody: { success: true } };
  } catch (err: unknown) {
    context.error("deleteMessage Error", err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

app.http("deleteMessage", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "messages/{messageId}",
  handler: deleteMessage
});
