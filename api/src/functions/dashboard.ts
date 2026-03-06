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

export async function getRecentActivities(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  try {
    const pool = await getPool();

    // Recent ads posted by the user
    const adsResult = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query(`
        SELECT TOP 5 Id, Title, CreatedAt
        FROM Ads
        WHERE UserId = @UserId AND IsDeleted = 0
        ORDER BY CreatedAt DESC
      `);

    // Recent wallet transactions
    const txResult = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query(`
        SELECT TOP 5 Id, Amount, Description, CreatedAt
        FROM WalletTransactions
        WHERE UserId = @UserId
        ORDER BY CreatedAt DESC
      `);

    // Recent messages received
    const msgResult = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query(`
        SELECT TOP 5 m.Id, u.Name AS FromUserName, m.CreatedAt
        FROM Messages m
        JOIN Users u ON m.FromUserId = u.Id
        WHERE m.ToUserId = @UserId
        ORDER BY m.CreatedAt DESC
      `);

    interface AdRow { Id: string; Title: string; CreatedAt: string }
    interface TxRow { Id: string; Amount: number; Description: string; CreatedAt: string }
    interface MsgRow { Id: string; FromUserName: string; CreatedAt: string }

    const activities: Array<{ type: string; id: string; title: string; detail?: string; date: string }> = [];

    for (const ad of adsResult.recordset as AdRow[]) {
      activities.push({
        type: 'AD',
        id: ad.Id,
        title: `ثبت آگهی "${ad.Title}"`,
        date: ad.CreatedAt
      });
    }

    for (const tx of txResult.recordset as TxRow[]) {
      activities.push({
        type: 'WALLET',
        id: tx.Id,
        title: tx.Description || 'تراکنش کیف پول',
        detail: `${Math.abs(tx.Amount)} ؋`,
        date: tx.CreatedAt
      });
    }

    for (const msg of msgResult.recordset as MsgRow[]) {
      activities.push({
        type: 'MESSAGE',
        id: msg.Id,
        title: `پیام از ${msg.FromUserName}`,
        date: msg.CreatedAt
      });
    }

    // Sort by date descending and return top 10
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      status: 200,
      jsonBody: activities.slice(0, 10)
    };
  } catch (err: unknown) {
    context.error("getRecentActivities Error", err);
    return serverError(err);
  }
}

app.http("getRecentActivities", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "dashboard/activities",
  handler: getRecentActivities
});
