import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as sql from "mssql";
import { getPool } from "../db";
import { validateToken } from "../utils/authUtils";
import { unauthorized, serverError } from "../utils/responses";

export async function getWalletTransactions(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  if (!auth.isAuthenticated) return unauthorized();

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
