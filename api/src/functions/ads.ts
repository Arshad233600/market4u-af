import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as sql from "mssql";
import { getPool } from "../db";
import { validateToken } from "../utils/authUtils";

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
    return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
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
    return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
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
        JOIN Users u ON a.UserId = u.Id
        WHERE a.Id = @Id AND a.IsDeleted = 0
      `);

    if (result.recordset.length === 0) {
      return { status: 404, jsonBody: { error: "Not found" } };
    }

    const ad: AdRecord = result.recordset[0];

    // Get all images
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
    return { status: 500, jsonBody: { error: "Server Error", message: errMessage(err) } };
  }
}

export async function getMyAds(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  if (!auth.isAuthenticated) return { status: 401, jsonBody: { error: "Unauthorized" } };

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query("SELECT * FROM Ads WHERE UserId = @UserId ORDER BY CreatedAt DESC");

    return { status: 200, jsonBody: result.recordset };
  } catch (err: unknown) {
    context.error("getMyAds Error", err);
    return { status: 500, jsonBody: { error: "Server Error", message: errMessage(err) } };
  }
}

export async function postAd(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  if (!auth.isAuthenticated) {
    return { status: 401, jsonBody: { error: "برای ثبت آگهی باید وارد شوید." } };
  }

  try {
    const pool = await getPool();

    // Rate limiting (max 1 ad per 60 sec)
    const recentAd = await pool
      .request()
      .input("UserId", sql.NVarChar, auth.userId)
      .query("SELECT TOP 1 CreatedAt FROM Ads WHERE UserId = @UserId ORDER BY CreatedAt DESC");

    if (recentAd.recordset.length > 0) {
      const lastAdTime = new Date(recentAd.recordset[0].CreatedAt).getTime();
      if (Date.now() - lastAdTime < 60000) {
        return { status: 429, jsonBody: { error: "لطفاً کمی صبر کنید. شما به تازگی یک آگهی ثبت کرده‌اید." } };
      }
    }

    const body = (await request.json()) as AdRequestBody;
    const { title, price, location, category, subCategory, description, imageUrls, latitude, longitude } = body;

    if (!title || price === undefined || price === null) {
      return { status: 400, jsonBody: { error: "Missing required fields", required: ["title", "price"] } };
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const id = `ad_${Date.now()}`;
      const mainImageUrl = Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls[0] : null;

      const adRequest = new sql.Request(transaction);
      await adRequest
        .input("Id", sql.NVarChar, id)
        .input("UserId", sql.NVarChar, auth.userId)
        .input("Title", sql.NVarChar, title)
        .input("Price", sql.Decimal(18, 2), Number(price))
        .input("Location", sql.NVarChar, location ?? "")
        .input("Category", sql.NVarChar, category ?? "")
        .input("SubCategory", sql.NVarChar, subCategory ?? "")
        .input("Description", sql.NVarChar, description ?? "")
        .input("MainImageUrl", sql.NVarChar, mainImageUrl)
        .input("Latitude", sql.Float, latitude ?? null)
        .input("Longitude", sql.Float, longitude ?? null)
        .input("Status", sql.NVarChar, "ACTIVE")
        .input("CreatedAt", sql.DateTime, new Date())
        .query(`
          INSERT INTO Ads (Id, UserId, Title, Price, Location, Category, SubCategory, Description, MainImageUrl, Latitude, Longitude, Status, CreatedAt)
          VALUES (@Id, @UserId, @Title, @Price, @Location, @Category, @SubCategory, @Description, @MainImageUrl, @Latitude, @Longitude, @Status, @CreatedAt)
        `);

      if (Array.isArray(imageUrls) && imageUrls.length > 0) {
        for (let i = 0; i < imageUrls.length; i++) {
          const imgRequest = new sql.Request(transaction);
          await imgRequest
            .input("Id", sql.NVarChar, `img_${Date.now()}_${i}`)
            .input("AdId", sql.NVarChar, id)
            .input("Url", sql.NVarChar, imageUrls[i])
            .input("SortOrder", sql.Int, i)
            .query(`
              INSERT INTO AdImages (Id, AdId, Url, SortOrder)
              VALUES (@Id, @AdId, @Url, @SortOrder)
            `);
        }
      }

      await transaction.commit();
      return { status: 201, jsonBody: { success: true, id } };
    } catch (err: unknown) {
      await transaction.rollback();
      throw err;
    }
  } catch (err: unknown) {
    context.error("postAd Error", err);
    return { status: 500, jsonBody: { error: "Database error", message: errMessage(err) } };
  }
}

export async function updateAd(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  if (!auth.isAuthenticated) return { status: 401, jsonBody: { error: "Unauthorized" } };

  const id = request.params?.id;
  if (!id) return { status: 400, jsonBody: { error: "ID required" } };

  try {
    const body = (await request.json()) as AdRequestBody;
    const { title, price, location, category, description, imageUrls } = body;

    const pool = await getPool();
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
        .input("Description", sql.NVarChar, description ?? "")
        .input("MainImageUrl", sql.NVarChar, imageUrls?.[0] ?? null)
        .input("UpdatedAt", sql.DateTime, new Date())
        .query(`
          UPDATE Ads
          SET Title = @Title,
              Price = @Price,
              Location = @Location,
              Category = @Category,
              Description = @Description,
              MainImageUrl = @MainImageUrl,
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
            .input("Id", sql.NVarChar, `img_${Date.now()}_${i}`)
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
    return { status: 500, jsonBody: { error: "Error updating ad", message: errMessage(err) } };
  }
}

export async function deleteAd(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = validateToken(request);
  if (!auth.isAuthenticated) return { status: 401, jsonBody: { error: "Unauthorized" } };

  const id = request.params?.id;
  if (!id) return { status: 400, jsonBody: { error: "ID required" } };

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("Id", sql.NVarChar, id)
      .input("UserId", sql.NVarChar, auth.userId)
      .input("DeletedAt", sql.DateTime, new Date())
      .query("UPDATE Ads SET IsDeleted = 1, DeletedAt = @DeletedAt WHERE Id = @Id AND UserId = @UserId");

    if (result.rowsAffected[0] === 0) {
      return { status: 403, jsonBody: { error: "Forbidden or Not Found" } };
    }

    return { status: 200, jsonBody: { success: true } };
  } catch (err: unknown) {
    context.error("deleteAd Error", err);
    return { status: 500, jsonBody: { error: "Error", message: errMessage(err) } };
  }
}

// Routes
app.http("getAds", { methods: ["GET"], authLevel: "anonymous", route: "ads", handler: getAds });
app.http("getAdDetail", { methods: ["GET"], authLevel: "anonymous", route: "ads/{id}", handler: getAdDetail });
app.http("getMyAds", { methods: ["GET"], authLevel: "anonymous", route: "ads/my-ads", handler: getMyAds });
app.http("getSellerAds", { methods: ["GET"], authLevel: "anonymous", route: "ads/user/{userId}", handler: getSellerAds });
app.http("postAd", { methods: ["POST"], authLevel: "anonymous", route: "ads", handler: postAd });
app.http("updateAd", { methods: ["PUT"], authLevel: "anonymous", route: "ads/{id}", handler: updateAd });
app.http("deleteAd", { methods: ["DELETE"], authLevel: "anonymous", route: "ads/{id}", handler: deleteAd });
