import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as sql from "mssql";
import { getPool } from "../db";
import { validateToken, authResponse } from "../utils/authUtils";
import { serverError } from "../utils/responses";

export async function getWalletTransactions(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query(`
        SELECT TOP 50 Id, UserId, Amount, Type, Status, Description, ReferenceId, CreatedAt
        FROM WalletTransactions
        WHERE UserId = @UserId
        ORDER BY CreatedAt DESC
      `);

    return { status: 200, jsonBody: result.recordset };
  } catch (err: unknown) {
    context.error("getWalletTransactions Error", err);
    return serverError(err);
  }
}

app.http("getWalletTransactions", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "wallet/transactions",
  handler: getWalletTransactions
});

export async function topUpWallet(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as { amount?: number; description?: string; referenceId?: string };
    const { amount, description, referenceId } = body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return { status: 400, jsonBody: { error: "مبلغ معتبر وارد کنید" } };
    }

    const pool = await getPool();
    const id = `tx_${Date.now()}`;

    await pool
      .request()
      .input("Id", sql.NVarChar, id)
      .input("UserId", sql.NVarChar, auth.userId)
      .input("Amount", sql.Decimal(18, 2), amount)
      .input("Type", sql.NVarChar, "DEPOSIT")
      .input("Status", sql.NVarChar, "SUCCESS")
      .input("Description", sql.NVarChar, description || "شارژ کیف پول")
      .input("ReferenceId", sql.NVarChar, referenceId || null)
      .input("CreatedAt", sql.DateTime2, new Date())
      .query(`
        INSERT INTO WalletTransactions (Id, UserId, Amount, Type, Status, Description, ReferenceId, CreatedAt)
        VALUES (@Id, @UserId, @Amount, @Type, @Status, @Description, @ReferenceId, @CreatedAt)
      `);

    return { status: 201, jsonBody: { success: true, id } };
  } catch (err: unknown) {
    context.error("topUpWallet Error", err);
    return serverError(err);
  }
}

app.http("topUpWallet", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "wallet/top-up",
  handler: topUpWallet
});
