import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as sql from "mssql";
import { getPool } from "../db";
import { validateToken, authResponse } from "../utils/authUtils";
import { serverError } from "../utils/responses";

export async function getDashboardStats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  try {
    const pool = await getPool();

    const adsResult = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query(`
        SELECT
          COUNT(*) AS totalAds,
          SUM(CASE WHEN Status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeAds,
          ISNULL(SUM(Views), 0) AS totalViews
        FROM Ads
        WHERE UserId = @UserId AND IsDeleted = 0
      `);

    const msgResult = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query("SELECT COUNT(*) AS unreadMessages FROM Messages WHERE ToUserId = @UserId AND IsRead = 0");

    const walletResult = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query("SELECT ISNULL(SUM(Amount), 0) AS walletBalance FROM WalletTransactions WHERE UserId = @UserId AND Status NOT IN ('FAILED')");

    const ads = adsResult.recordset[0];
    const msgs = msgResult.recordset[0];
    const wallet = walletResult.recordset[0];

    return {
      status: 200,
      jsonBody: {
        totalAds: ads.totalAds || 0,
        activeAds: ads.activeAds || 0,
        totalViews: ads.totalViews || 0,
        unreadMessages: msgs.unreadMessages || 0,
        walletBalance: wallet.walletBalance || 0
      }
    };
  } catch (err: unknown) {
    context.error("getDashboardStats Error", err);
    return serverError(err);
  }
}

app.http("getDashboardStats", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "dashboard/stats",
  handler: getDashboardStats
});
