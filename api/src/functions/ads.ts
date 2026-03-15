import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as sql from "mssql";
import * as appInsights from "applicationinsights";
import { getPool, resetPool } from "../db";
import { validateToken, authResponse } from "../utils/authUtils";
import { resolveRequestId, generateUUID } from "../utils/uuidUtils";
import { checkAdsSchema, applyMissingAdsColumns } from "../utils/schemaCheck";
import { ensureAdImagesTable, ensureNotificationsTable, ensureImageUrlColumnsExpanded } from "../utils/tableSchemaCheck";

/** Interface for database image record */
interface ImageRecord {
  Url: string;
  SortOrder: number;
}

/** Interface for ad record with all fields */
interface AdRecord {
  [key: string]: unknown;
  images?: string[];
  MainImageUrl?: string;
}

/** Interface for ad post/update body */
interface AdRequestBody {
  title?: string;
  price?: number;
  location?: string;
  category?: string;
  subCategory?: string;
  description?: string;
  imageUrls?: string[];
  latitude?: number;
  longitude?: number;
  condition?: string;
  isNegotiable?: boolean;
  deliveryAvailable?: boolean;
  dynamicFields?: Record<string, unknown>;
}

/** Safely read query params in both possible shapes (URLSearchParams or plain object). */
function q(request: HttpRequest, key: string): string | null {
  const anyReq = request as { query?: URLSearchParams | Record<string, string> };

  // Common in v4: URLSearchParams
  if (anyReq.query && typeof (anyReq.query as URLSearchParams).get === "function") {
    const v = (anyReq.query as URLSearchParams).get(key);
    return v ?? null;
  }

  // Fallback: plain object
  const v = (anyReq.query as Record<string, string> | undefined)?.[key];
  if (typeof v === "string") return v;
  return null;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "unknown";
}

export async function getAds(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const pool = await getPool();

    const category = q(request, "category");
    const province = q(request, "province");
    const district = q(request, "district");
    const searchQuery = q(request, "q");
    const minPrice = q(request, "minPrice");
    const maxPrice = q(request, "maxPrice");
    const sort = q(request, "sort") || "newest";

    let queryStr = "SELECT TOP 100 * FROM Ads WHERE Status = 'ACTIVE' AND IsDeleted = 0";

    if (category && category !== "all") {
      queryStr += " AND Category = @Category";
    }
    if (province && province !== "all") {
      queryStr += " AND Location LIKE '%' + @Province + '%'";
    }
    if (district) {
      queryStr += " AND Location LIKE '%' + @District + '%'";
    }
    if (searchQuery) {
      queryStr += " AND (Title LIKE '%' + @SearchQuery + '%' OR Description LIKE '%' + @SearchQuery + '%')";
    }
    if (minPrice) {
      queryStr += " AND Price >= @MinPrice";
    }
    if (maxPrice) {
      queryStr += " AND Price <= @MaxPrice";
    }

    if (sort === "price_low") {
      queryStr += " ORDER BY Price ASC";
    } else if (sort === "price_high") {
      queryStr += " ORDER BY Price DESC";
    } else if (sort === "most_viewed") {
      queryStr += " ORDER BY Views DESC";
    } else {
      queryStr += " ORDER BY CreatedAt DESC";
    }

    const req = pool.request();
    if (category && category !== "all") req.input("Category", sql.NVarChar, category);
    if (province && province !== "all") req.input("Province", sql.NVarChar, province);
    if (district) req.input("District", sql.NVarChar, district);
    if (searchQuery) req.input("SearchQuery", sql.NVarChar, searchQuery);
    if (minPrice) req.input("MinPrice", sql.Decimal(18, 2), Number(minPrice));
    if (maxPrice) req.input("MaxPrice", sql.Decimal(18, 2), Number(maxPrice));

    const result = await req.query(queryStr);

    return { status: 200, jsonBody: result.recordset };
  } catch (err: unknown) {
    context.error("getAds SQL Error", err);
    return dbErrorResponse(err);
  }
}

export async function getSellerAds(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const userId = request.params?.userId;
  if (!userId) return { status: 400, jsonBody: { error: "User ID required" } };

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, userId)
      .query("SELECT TOP 50 * FROM Ads WHERE UserId = @UserId AND Status = 'ACTIVE' AND IsDeleted = 0 ORDER BY CreatedAt DESC");

    return { status: 200, jsonBody: result.recordset };
  } catch (err: unknown) {
    context.error("getSellerAds Error", err);
    return dbErrorResponse(err);
  }
}

export async function getAdDetail(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const id = request.params?.id;
  if (!id) return { status: 400, jsonBody: { error: "ID required" } };

  try {
    const pool = await getPool();

    // Update views count asynchronously (avoid unhandled rejection)
    pool
      .request()
      .input("Id", sql.NVarChar, id)
      .query("UPDATE Ads SET Views = Views + 1 WHERE Id = @Id")
      .catch(() => {});

    const result = await pool
      .request()
      .input("Id", sql.NVarChar, id)
      .query(`
        SELECT a.*, 
               u.Name as SellerName, 
               u.Phone as SellerPhone, 
               u.AvatarUrl as SellerAvatar, 
               u.IsVerified as SellerVerified
        FROM Ads a
        LEFT JOIN Users u ON a.UserId = u.Id
        WHERE a.Id = @Id AND a.IsDeleted = 0
      `);

    if (result.recordset.length === 0) {
      return { status: 404, jsonBody: { error: "Not found" } };
    }

    const ad: AdRecord = result.recordset[0];

    // Get all images — ensure table exists first so a missing AdImages table
    // does not turn a valid ad detail request into a 500 error.
    await ensureAdImagesTable();
    const imagesResult = await pool
      .request()
      .input("AdId", sql.NVarChar, id)
      .query("SELECT Url, SortOrder FROM AdImages WHERE AdId = @AdId ORDER BY SortOrder ASC");

    ad.images = imagesResult.recordset.map((r: ImageRecord) => r.Url);

    const adImages = ad.images as string[];
    if (adImages.length === 0 && ad.MainImageUrl) {
      ad.images = [ad.MainImageUrl];
    }

    return { status: 200, jsonBody: ad };
  } catch (err: unknown) {
    context.error("getAdDetail Error", err);
    return dbErrorResponse(err);
  }
}

export async function getMyAds(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) {
    context.warn(`[getMyAds] auth_failed reason=${auth.reason ?? "unknown"} requestId=${auth.requestId ?? "none"}`);
    return authErr;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query("SELECT * FROM Ads WHERE UserId = @UserId AND IsDeleted = 0 ORDER BY CreatedAt DESC");

    return { status: 200, jsonBody: result.recordset };
  } catch (err: unknown) {
    context.error("getMyAds Error", err);
    return dbErrorResponse(err);
  }
}

/**
 * Classify an error thrown in postAd into an HTTP status code and category string.
 *
 * Categories (returned in every error response for client-side handling):
 *   VALIDATION        – 400  request body missing / malformed JSON
 *   RATE_LIMIT        – 429  too many submissions (already handled before this path)
 *   DB_NOT_CONFIGURED – 503  permanent: DB env vars missing; client should NOT retry
 *   DB_UNAVAILABLE    – 503  transient DB/network issue; client should retry later
 *   UNEXPECTED        – 500  truly unexpected bug; use requestId to look up in logs
 */
function classifyPostAdError(err: unknown): { status: number; category: string } {
  const msg = errMessage(err);

  // Malformed / missing JSON body (SyntaxError from request.json())
  if (err instanceof SyntaxError || /Unexpected (end|token)/i.test(msg)) {
    return { status: 400, category: "VALIDATION" };
  }

  // Permanent misconfiguration: DB connection string env var is not set.
  // Retrying will not help — the configuration must be fixed first.
  if (/Database not configured/i.test(msg)) {
    return { status: 503, category: "DB_NOT_CONFIGURED" };
  }

  // mssql ConnectionError – server unreachable, TCP error, login failure
  if (err instanceof sql.ConnectionError) {
    return { status: 503, category: "DB_UNAVAILABLE" };
  }

  // Infrastructure / transient errors → 503 (retryable)
  if (
    /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|login.*failed|Cannot open database|temporarily unavailable|connection.*closed/i.test(msg)
  ) {
    return { status: 503, category: "DB_UNAVAILABLE" };
  }

  return { status: 500, category: "UNEXPECTED" };
}

/**
 * Builds an HTTP error response for database errors, reusing the same logic
 * across all endpoints.  Resets the connection pool for transient failures so
 * the next request starts with a fresh pool.
 */
function dbErrorResponse(err: unknown): HttpResponseInit {
  const { status, category } = classifyPostAdError(err);
  if (status === 503) {
    // For transient DB errors, reset the pool so the next request gets a fresh
    // connection.  For permanent misconfiguration (DB_NOT_CONFIGURED) there is
    // nothing to reset — poolPromise was never set — so skip the reset.
    if (category !== "DB_NOT_CONFIGURED") {
      resetPool().catch(() => {});
    }
    const reason = category === "DB_NOT_CONFIGURED" ? "db_not_configured" : "db_unavailable";
    return { status: 503, jsonBody: { error: "سرویس موقتاً در دسترس نیست. لطفاً دوباره تلاش کنید.", category, reason } };
  }
  return { status: 500, jsonBody: { error: "Internal server error" } };
}

export async function postAd(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Prefer the client-supplied correlation ID (validated as UUID v4) so both sides share the same
  // tracing token. Rejects arbitrary strings to guard logging/monitoring pipelines.
  const requestId = resolveRequestId(request.headers.get("x-client-request-id"));

  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr || !auth.userId) {
    const reason = auth.reason ?? "missing_token";
    const authHeaderPresent = !!(request.headers.get("authorization") || request.headers.get("Authorization"));
    let path = 'unknown';
    try { path = new URL(request.url).pathname; } catch { /* ignore */ }
    const method = request.method;
    context.warn(`[postAd] auth_failed requestId=${requestId} reason=${reason} authHeaderPresent=${authHeaderPresent}`);
    appInsights.defaultClient?.trackTrace({
      message: "[postAd] auth_failed",
      properties: {
        requestId,
        reason,
        authHeaderPresent: String(authHeaderPresent),
        path,
        method,
        category: "AUTH_REQUIRED",
        operationId: ((): string => {
          // W3C traceparent format: "00-{traceId}-{spanId}-{flags}"
          const parts = context.traceContext?.traceParent?.split('-');
          return (parts && parts.length >= 4 && parts[1]) ? parts[1] : context.invocationId;
        })(),
      },
    });
    // For server misconfiguration (503) return the standard response; for all other auth
    // failures return 401 with structured category, reason and requestId for client diagnosis.
    if (authErr && authErr.status === 503) return authErr;
    return { status: 401, jsonBody: { error: "Unauthorized", category: "AUTH_REQUIRED", reason, requestId } };
  }
  const userId = auth.userId;

  // lastStep tracks the most-recently completed breadcrumb; logged in catch so
  // on-call engineers can identify exactly which layer failed without grepping logs.
  let lastStep = "begin";

  context.log(`[postAd] ads.create.begin requestId=${requestId} userId=${userId}`);

  try {
    const pool = await getPool();

    // Guard: if the Ads table is missing required columns (schema outdated),
    // auto-apply the missing column migrations and continue rather than failing.
    const adsSchema = await checkAdsSchema();
    if (!adsSchema.schemaOk) {
      context.warn(`[postAd] db_schema_outdated requestId=${requestId} missingColumns=${adsSchema.missingColumns.join(",")} — applying auto-migration`);
      const applied = await applyMissingAdsColumns(adsSchema.missingColumns, (msg) => context.warn(msg));
      const notMigrated = adsSchema.missingColumns.filter(c => !applied.includes(c));
      if (notMigrated.length > 0) {
        context.warn(`[postAd] auto_migration_partial requestId=${requestId} applied=${applied.join(",")} notMigrated=${notMigrated.join(",")}`);
      } else {
        context.log(`[postAd] auto_migration_ok requestId=${requestId} applied=${applied.join(",")}`);
      }
    }

    // Ensure AdImages table exists (created at init but may be missing in
    // environments that were provisioned before the table was added).
    await ensureAdImagesTable();
    await ensureImageUrlColumnsExpanded();

    // Rate limiting: max 1 ad per 60 seconds per authenticated user (DB-backed,
    // so only previously committed ads count — failed attempts never trigger it).
    const recentAd = await pool
      .request()
      .input("UserId", sql.NVarChar, userId)
      .query("SELECT TOP 1 CreatedAt FROM Ads WHERE UserId = @UserId ORDER BY CreatedAt DESC");

    if (recentAd.recordset.length > 0) {
      const lastAdTime = new Date(recentAd.recordset[0].CreatedAt).getTime();
      const elapsed = Date.now() - lastAdTime;
      if (elapsed < 60000) {
        const retryAfterMs = 60000 - elapsed;
        context.warn(`[postAd] rate_limited userId=${userId} retryAfterMs=${retryAfterMs} requestId=${requestId}`);
        return { status: 429, jsonBody: { error: "لطفاً کمی صبر کنید. شما به تازگی یک آگهی ثبت کرده‌اید.", category: "RATE_LIMIT", requestId, retryAfterMs } };
      }
    }

    // Monthly limit: regular (non-admin) users may post at most 5 ads per calendar month.
    // Fetch user role and current-month ad count in a single round-trip.
    const monthlyInfo = await pool
      .request()
      .input("UserId", sql.NVarChar, userId)
      .query(`
        SELECT u.Role,
          (SELECT COUNT(*) FROM Ads
           WHERE UserId = @UserId
             AND IsDeleted = 0
             AND CreatedAt >= DATEADD(month, DATEDIFF(month, 0, GETUTCDATE()), 0)) AS MonthlyAdCount
        FROM Users u WHERE u.Id = @UserId
      `);
    if (monthlyInfo.recordset.length > 0) {
      const { Role, MonthlyAdCount } = monthlyInfo.recordset[0] as { Role: string; MonthlyAdCount: number };
      if (Role !== "ADMIN" && MonthlyAdCount >= 5) {
        context.warn(`[postAd] monthly_limit userId=${userId} MonthlyAdCount=${MonthlyAdCount} requestId=${requestId}`);
        return { status: 429, jsonBody: { error: "شما به حداکثر ۵ آگهی در ماه رسیده‌اید.", category: "MONTHLY_LIMIT", requestId } };
      }
    }
    lastStep = "monthly_limit_ok";

    // Parse the request body separately so that a malformed / missing JSON body
    // returns HTTP 400 (VALIDATION) instead of falling through to the generic
    // HTTP 500 catch block and misleading both the caller and the logs.
    let body: AdRequestBody;
    try {
      const raw = await request.json();
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return { status: 400, jsonBody: { error: "Request body must be a JSON object", category: "VALIDATION", reason: "body_not_json_object", requestId } };
      }
      body = raw as AdRequestBody;
      lastStep = "parse_body_ok";
      context.log(`[postAd] parse_body_ok requestId=${requestId}`);
    } catch {
      return { status: 400, jsonBody: { error: "Invalid or missing request body", category: "VALIDATION", reason: "malformed_or_missing_json", requestId } };
    }

    const { title, price, location, category, subCategory, description, imageUrls, latitude, longitude, condition, isNegotiable, deliveryAvailable, dynamicFields } = body;

    if (!title || price === undefined || price === null) {
      return { status: 400, jsonBody: { error: "Missing required fields", required: ["title", "price"], category: "VALIDATION", reason: "missing_title_or_price", requestId } };
    }
    // Image count limit: each ad may have at most 4 images.
    if (Array.isArray(imageUrls) && imageUrls.length > 4) {
      return { status: 400, jsonBody: { error: "هر آگهی می‌تواند حداکثر ۴ عکس داشته باشد.", category: "VALIDATION", reason: "too_many_images", requestId } };
    }
    lastStep = "auth_ok";
    context.log(`[postAd] auth_ok requestId=${requestId} authenticated=${auth.isAuthenticated}`);
    lastStep = "validate_ok";
    context.log(`[postAd] validate_ok requestId=${requestId} title="${title}" price=${price}`);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    lastStep = "tx_begin";
    context.log(`[postAd] tx_begin requestId=${requestId}`);

    try {
      // Use UUID to avoid primary-key collisions on concurrent submissions.
      const id = generateUUID();
      const mainImageUrl = Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls[0] : null;

      const adRequest = new sql.Request(transaction);
      await adRequest
        .input("Id", sql.NVarChar, id)
        .input("UserId", sql.NVarChar, userId)
        .input("Title", sql.NVarChar, title)
        .input("Price", sql.Decimal(18, 2), Number(price))
        .input("Location", sql.NVarChar, location ?? "")
        .input("Category", sql.NVarChar, category ?? "")
        .input("SubCategory", sql.NVarChar, subCategory ?? "")
        .input("Description", sql.NVarChar, description ?? "")
        .input("MainImageUrl", sql.NVarChar, mainImageUrl)
        .input("Latitude", sql.Float, latitude ?? null)
        .input("Longitude", sql.Float, longitude ?? null)
        .input("Condition", sql.NVarChar, condition ?? "used")
        .input("IsNegotiable", sql.Bit, isNegotiable ? 1 : 0)
        .input("DeliveryAvailable", sql.Bit, deliveryAvailable ? 1 : 0)
        .input("DynamicFields", sql.NVarChar, dynamicFields ? JSON.stringify(dynamicFields) : null)
        .input("Status", sql.NVarChar, "ACTIVE")
        .input("CreatedAt", sql.DateTime, new Date())
        .query(`
          INSERT INTO Ads (Id, UserId, Title, Price, Location, Category, SubCategory, Description, MainImageUrl, Latitude, Longitude, Condition, IsNegotiable, DeliveryAvailable, DynamicFields, Status, CreatedAt)
          VALUES (@Id, @UserId, @Title, @Price, @Location, @Category, @SubCategory, @Description, @MainImageUrl, @Latitude, @Longitude, @Condition, @IsNegotiable, @DeliveryAvailable, @DynamicFields, @Status, @CreatedAt)
        `);
      lastStep = "insert_ad_ok";
      context.log(`[postAd] insert_ad_ok requestId=${requestId} adId=${id}`);

      if (Array.isArray(imageUrls) && imageUrls.length > 0) {
        for (let i = 0; i < imageUrls.length; i++) {
          const imgRequest = new sql.Request(transaction);
          await imgRequest
            .input("Id", sql.NVarChar, generateUUID())
            .input("AdId", sql.NVarChar, id)
            .input("Url", sql.NVarChar, imageUrls[i])
            .input("SortOrder", sql.Int, i)
            .query(`
              INSERT INTO AdImages (Id, AdId, Url, SortOrder)
              VALUES (@Id, @AdId, @Url, @SortOrder)
            `);
        }
        lastStep = "insert_images_ok";
        context.log(`[postAd] insert_images_ok requestId=${requestId} count=${imageUrls.length}`);
      }

      await transaction.commit();
      lastStep = "commit_ok";
      context.log(`[postAd] commit_ok requestId=${requestId}`);
      context.log(`[postAd] ads.create.success requestId=${requestId} adId=${id}`);

      // Create a confirmation notification for the user (non-critical — failures are
      // logged but do NOT roll back or change the 201 response).
      // Deferred via setImmediate so the notification insert runs after the response
      // is returned, keeping it fully out of the main request-response path.
      setImmediate(() => {
        ensureNotificationsTable()
          .then(() => pool.request()
            .input("Id", sql.NVarChar, generateUUID())
            .input("UserId", sql.NVarChar, userId)
            .input("Title", sql.NVarChar, "آگهی شما ثبت شد")
            .input("Message", sql.NVarChar, `آگهی "${title}" با موفقیت ثبت شد.`)
            .input("Type", sql.NVarChar, "success")
            .input("CreatedAt", sql.DateTime, new Date())
            .query("INSERT INTO Notifications (Id, UserId, Title, Message, Type, IsRead, CreatedAt) VALUES (@Id, @UserId, @Title, @Message, @Type, 0, @CreatedAt)")
          )
          .catch((notifErr: unknown) => {
            context.warn(`[postAd] notification_create_failed requestId=${requestId} adId=${id}`, notifErr);
          });
      });

      return { status: 201, jsonBody: { success: true, id, requestId } };
    } catch (err: unknown) {
      // Rollback on any inner error. Ignore rollback failures so the original
      // error (not the rollback error) propagates to the outer catch for logging.
      try { await transaction.rollback(); } catch (rollbackErr: unknown) { context.warn(`[postAd] rollback failed requestId=${requestId}`, rollbackErr); }
      throw err;
    }
  } catch (err: unknown) {
    const { status, category: errCategory } = classifyPostAdError(err);
    const errName = err instanceof Error ? err.constructor.name : "UnknownError";
    context.error(`[postAd] ads.create.error requestId=${requestId} lastStep=${lastStep} category=${errCategory} errorType=${errName}`, err);
    if (status === 503) {
      const reason = errCategory === "DB_NOT_CONFIGURED" ? "db_not_configured" : "db_unavailable";
      return { status: 503, jsonBody: { error: "سرویس موقتاً در دسترس نیست. لطفاً دوباره تلاش کنید.", category: errCategory, reason, requestId } };
    }
    // 500: do not expose internal error details (use requestId to trace in logs)
    return { status: 500, jsonBody: { error: "Database error", category: errCategory, reason: "unexpected_server_error", requestId } };
  }
}

export async function updateAd(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  const id = request.params?.id;
  if (!id) return { status: 400, jsonBody: { error: "ID required" } };

  try {
    const body = (await request.json()) as AdRequestBody;
    const { title, price, location, category, subCategory, description, imageUrls, condition, isNegotiable, deliveryAvailable, dynamicFields } = body;

    // Image count limit: each ad may have at most 4 images.
    if (Array.isArray(imageUrls) && imageUrls.length > 4) {
      return { status: 400, jsonBody: { error: "هر آگهی می‌تواند حداکثر ۴ عکس داشته باشد.", category: "VALIDATION", reason: "too_many_images" } };
    }

    const pool = await getPool();

    // Ensure AdImages table exists before the transaction touches it.
    await ensureAdImagesTable();
    await ensureImageUrlColumnsExpanded();

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const checkResult = await new sql.Request(transaction)
        .input("Id", sql.NVarChar, id)
        .input("UserId", sql.NVarChar, auth.userId)
        .query("SELECT Id FROM Ads WHERE Id = @Id AND UserId = @UserId AND IsDeleted = 0");

      if (checkResult.recordset.length === 0) {
        await transaction.rollback();
        return { status: 404, jsonBody: { error: "Ad not found or unauthorized" } };
      }

      const updateRequest = new sql.Request(transaction);
      const result = await updateRequest
        .input("Id", sql.NVarChar, id)
        .input("UserId", sql.NVarChar, auth.userId)
        .input("Title", sql.NVarChar, title ?? "")
        .input("Price", sql.Decimal(18, 2), Number(price ?? 0))
        .input("Location", sql.NVarChar, location ?? "")
        .input("Category", sql.NVarChar, category ?? "")
        .input("SubCategory", sql.NVarChar, subCategory ?? "")
        .input("Description", sql.NVarChar, description ?? "")
        .input("MainImageUrl", sql.NVarChar, imageUrls?.[0] ?? null)
        .input("Condition", sql.NVarChar, condition ?? "used")
        .input("IsNegotiable", sql.Bit, isNegotiable ? 1 : 0)
        .input("DeliveryAvailable", sql.Bit, deliveryAvailable ? 1 : 0)
        .input("DynamicFields", sql.NVarChar, dynamicFields ? JSON.stringify(dynamicFields) : null)
        .input("UpdatedAt", sql.DateTime, new Date())
        .query(`
          UPDATE Ads
          SET Title = @Title,
              Price = @Price,
              Location = @Location,
              Category = @Category,
              SubCategory = @SubCategory,
              Description = @Description,
              MainImageUrl = @MainImageUrl,
              Condition = @Condition,
              IsNegotiable = @IsNegotiable,
              DeliveryAvailable = @DeliveryAvailable,
              DynamicFields = @DynamicFields,
              UpdatedAt = @UpdatedAt,
              Status = 'ACTIVE'
          WHERE Id = @Id AND UserId = @UserId AND IsDeleted = 0
        `);

      if (result.rowsAffected[0] === 0) {
        await transaction.rollback();
        return { status: 409, jsonBody: { error: "Update failed (concurrency or not found)" } };
      }

      await new sql.Request(transaction)
        .input("AdId", sql.NVarChar, id)
        .query("DELETE FROM AdImages WHERE AdId = @AdId");

      if (Array.isArray(imageUrls) && imageUrls.length > 0) {
        for (let i = 0; i < imageUrls.length; i++) {
          await new sql.Request(transaction)
            .input("Id", sql.NVarChar, generateUUID())
            .input("AdId", sql.NVarChar, id)
            .input("Url", sql.NVarChar, imageUrls[i])
            .input("SortOrder", sql.Int, i)
            .query("INSERT INTO AdImages (Id, AdId, Url, SortOrder) VALUES (@Id, @AdId, @Url, @SortOrder)");
        }
      }

      await transaction.commit();
      return { status: 200, jsonBody: { success: true } };
    } catch (err: unknown) {
      await transaction.rollback();
      throw err;
    }
  } catch (err: unknown) {
    context.error("updateAd Error", err);
    return dbErrorResponse(err);
  }
}

export async function deleteAd(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  const id = request.params?.id;
  if (!id) return { status: 400, jsonBody: { error: "ID required" } };

  try {
    const adsSchema = await checkAdsSchema();
    if (!adsSchema.schemaOk) {
      await applyMissingAdsColumns(adsSchema.missingColumns, (msg) => context.warn(msg));
    }
    const pool = await getPool();

    const result = await pool
      .request()
      .input("Id", sql.NVarChar, id)
      .input("UserId", sql.NVarChar, auth.userId)
      .input("DeletedAt", sql.DateTime, new Date())
      .query("UPDATE Ads SET IsDeleted = 1, DeletedAt = @DeletedAt WHERE Id = @Id AND UserId = @UserId");

    if (result.rowsAffected[0] === 0) {
      return { status: 404, jsonBody: { error: "Ad not found" } };
    }

    return { status: 200, jsonBody: { success: true } };
  } catch (err: unknown) {
    context.error("deleteAd Error", err);
    return dbErrorResponse(err);
  }
}

app.http("getAds", { methods: ["GET"], authLevel: "anonymous", route: "ads", handler: getAds });
app.http("getMyAds", { methods: ["GET"], authLevel: "anonymous", route: "ads/my-ads", handler: getMyAds });
app.http("getSellerAds", { methods: ["GET"], authLevel: "anonymous", route: "ads/user/{userId}", handler: getSellerAds });
app.http("getAdDetail", { methods: ["GET"], authLevel: "anonymous", route: "ads/{id:guid}", handler: getAdDetail });
app.http("postAd", { methods: ["POST"], authLevel: "anonymous", route: "ads", handler: postAd });
app.http("updateAd", { methods: ["PUT"], authLevel: "anonymous", route: "ads/{id:guid}", handler: updateAd });
app.http("deleteAd", { methods: ["DELETE"], authLevel: "anonymous", route: "ads/{id:guid}", handler: deleteAd });

export async function updateAdStatus(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  const id = request.params?.id;
  if (!id) return { status: 400, jsonBody: { error: "ID required" } };

  try {
    const body = (await request.json()) as { status?: string };
    const { status } = body;

    const allowed = ["ACTIVE", "SOLD", "INACTIVE", "PENDING"];
    if (!status || !allowed.includes(status)) {
      return { status: 400, jsonBody: { error: `Invalid status. Must be one of: ${allowed.join(", ")}` } };
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("Id", sql.NVarChar, id)
      .input("UserId", sql.NVarChar, auth.userId)
      .input("Status", sql.NVarChar, status)
      .input("UpdatedAt", sql.DateTime, new Date())
      .query("UPDATE Ads SET Status = @Status, UpdatedAt = @UpdatedAt WHERE Id = @Id AND UserId = @UserId AND IsDeleted = 0");

    if (result.rowsAffected[0] === 0) {
      return { status: 404, jsonBody: { error: "Ad not found or unauthorized" } };
    }

    return { status: 200, jsonBody: { success: true } };
  } catch (err: unknown) {
    context.error("updateAdStatus Error", err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

app.http("updateAdStatus", { methods: ["PATCH"], authLevel: "anonymous", route: "ads/{id}/status", handler: updateAdStatus });

/** Promotion plan costs in AFN. */
const PROMO_COSTS: Record<string, number> = { URGENT: 200, LADDER: 50 };

export async function promoteAd(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  const authErr = authResponse(auth);
  if (authErr) return authErr;

  const id = request.params?.id;
  if (!id) return { status: 400, jsonBody: { error: "ID required" } };

  try {
    const body = (await request.json()) as { plan?: string };
    const { plan } = body;

    const cost = PROMO_COSTS[plan ?? ""] ?? 0;
    if (!cost) {
      return { status: 400, jsonBody: { error: `Invalid plan. Must be one of: ${Object.keys(PROMO_COSTS).join(", ")}` } };
    }

    const adsSchema = await checkAdsSchema();
    if (!adsSchema.schemaOk) {
      await applyMissingAdsColumns(adsSchema.missingColumns, (msg) => context.warn(msg));
    }
    const pool = await getPool();

    // Check ownership
    const adCheck = await pool
      .request()
      .input("Id", sql.NVarChar, id)
      .input("UserId", sql.NVarChar, auth.userId)
      .query("SELECT Id FROM Ads WHERE Id = @Id AND UserId = @UserId AND IsDeleted = 0");

    if (adCheck.recordset.length === 0) {
      return { status: 404, jsonBody: { error: "Ad not found or unauthorized" } };
    }

    // Check wallet balance
    const walletResult = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query("SELECT ISNULL(SUM(Amount), 0) AS balance FROM WalletTransactions WHERE UserId = @UserId AND Status NOT IN ('FAILED')");

    const balance: number = walletResult.recordset[0]?.balance ?? 0;
    if (balance < cost) {
      return { status: 400, jsonBody: { error: "موجودی کافی نیست", required: cost, available: balance } };
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Deduct wallet balance
      const txId = `tx_${Date.now()}`;
      const planLabel = plan === "URGENT" ? "فوری و ویژه" : "نردبان";
      await new sql.Request(transaction)
        .input("Id", sql.NVarChar, txId)
        .input("UserId", sql.NVarChar, auth.userId)
        .input("Amount", sql.Decimal(18, 2), -cost)
        .input("Type", sql.NVarChar, "PAYMENT_AD_PROMO")
        .input("Status", sql.NVarChar, "SUCCESS")
        .input("Description", sql.NVarChar, `ارتقای آگهی (${planLabel})`)
        .input("CreatedAt", sql.DateTime, new Date())
        .query("INSERT INTO WalletTransactions (Id, UserId, Amount, Type, Status, Description, CreatedAt) VALUES (@Id, @UserId, @Amount, @Type, @Status, @Description, @CreatedAt)");

      // Mark ad as promoted
      await new sql.Request(transaction)
        .input("Id", sql.NVarChar, id)
        .input("UpdatedAt", sql.DateTime, new Date())
        .query("UPDATE Ads SET IsPromoted = 1, UpdatedAt = @UpdatedAt WHERE Id = @Id");

      await transaction.commit();
      return { status: 200, jsonBody: { success: true } };
    } catch (err: unknown) {
      await transaction.rollback();
      throw err;
    }
  } catch (err: unknown) {
    context.error("promoteAd Error", err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

app.http("promoteAd", { methods: ["POST"], authLevel: "anonymous", route: "ads/{id}/promote", handler: promoteAd });
