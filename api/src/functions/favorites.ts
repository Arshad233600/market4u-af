import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as sql from "mssql";
import { getPool } from "../db";
import { validateToken, authResponse } from "../utils/authUtils";

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "unknown";
}

export async function getFavorites(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query(`
        SELECT a.*, f.CreatedAt as FavoritedAt,
               u.Name as SellerName,
               u.Phone as SellerPhone
        FROM Favorites f
        JOIN Ads a ON f.AdId = a.Id
        JOIN Users u ON a.UserId = u.Id
        WHERE f.UserId = @UserId
          AND a.IsDeleted = 0
        ORDER BY f.CreatedAt DESC
      `);

    return { status: 200, jsonBody: result.recordset };
  } catch (err: unknown) {
    context.error("getFavorites Error", err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

export async function addFavorite(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  const adId = request.params?.adId;
  if (!adId) {
    return { status: 400, jsonBody: { error: "Ad ID required" } };
  }

  try {
    const pool = await getPool();

    // Check if ad exists and is not deleted
    const adCheck = await pool
      .request()
      .input("AdId", sql.NVarChar, adId)
      .query("SELECT Id FROM Ads WHERE Id = @AdId AND IsDeleted = 0");

    if (adCheck.recordset.length === 0) {
      return { status: 404, jsonBody: { error: "Ad not found" } };
    }

    // Check if already favorited
    const existingCheck = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .input("AdId", sql.NVarChar, adId)
      .query("SELECT Id FROM Favorites WHERE UserId = @UserId AND AdId = @AdId");

    if (existingCheck.recordset.length > 0) {
      return { status: 409, jsonBody: { error: "Already favorited" } };
    }

    const id = `fav_${Date.now()}`;
    await pool
      .request()
      .input("Id", sql.NVarChar, id)
      .input("UserId", sql.NVarChar, auth.userId)
      .input("AdId", sql.NVarChar, adId)
      .input("CreatedAt", sql.DateTime, new Date())
      .query("INSERT INTO Favorites (Id, UserId, AdId, CreatedAt) VALUES (@Id, @UserId, @AdId, @CreatedAt)");

    return { status: 201, jsonBody: { success: true, id } };
  } catch (err: unknown) {
    // SQL Server error 2627 = unique constraint violation (concurrent duplicate insert)
    if (err instanceof Error && /2627|duplicate key/i.test(err.message)) {
      return { status: 409, jsonBody: { error: "Already favorited" } };
    }
    context.error("addFavorite Error", err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

export async function removeFavorite(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  const adId = request.params?.adId;
  if (!adId) {
    return { status: 400, jsonBody: { error: "Ad ID required" } };
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .input("AdId", sql.NVarChar, adId)
      .query("DELETE FROM Favorites WHERE UserId = @UserId AND AdId = @AdId");

    if (result.rowsAffected[0] === 0) {
      return { status: 404, jsonBody: { error: "Favorite not found" } };
    }

    return { status: 200, jsonBody: { success: true } };
  } catch (err: unknown) {
    context.error("removeFavorite Error", err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

// Routes
app.http("getFavorites", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "favorites",
  handler: getFavorites
});

app.http("addFavorite", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "favorites/{adId}",
  handler: addFavorite
});

app.http("removeFavorite", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "favorites/{adId}",
  handler: removeFavorite
});
