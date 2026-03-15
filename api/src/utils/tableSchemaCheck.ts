import { getPool } from "../db";

/**
 * Ensures the Notifications table exists in the database.
 * Creates it (with all required columns and indexes) if it is absent.
 * Uses OBJECT_ID as an idempotent guard, matching the pattern in
 * migrations/2026_03_11_add_missing_tables_and_columns.sql.
 *
 * NOTE: All DDL identifiers are compile-time constants — no user input is
 * interpolated.
 */
export async function ensureNotificationsTable(): Promise<void> {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('Notifications', 'U') IS NULL
    BEGIN
      CREATE TABLE Notifications (
        Id NVARCHAR(100) PRIMARY KEY,
        UserId NVARCHAR(100) NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        Message NVARCHAR(1000) NOT NULL,
        Type NVARCHAR(50) DEFAULT 'info',
        IsRead BIT DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (UserId) REFERENCES Users(Id)
      );
      CREATE INDEX IX_Notifications_UserId ON Notifications(UserId);
      CREATE INDEX IX_Notifications_CreatedAt ON Notifications(CreatedAt DESC);
    END
  `);
}

/**
 * Ensures the AdImages table exists in the database.
 * Creates it (with all required columns and indexes) if it is absent.
 * Uses OBJECT_ID as an idempotent guard, matching the pattern in
 * migrations/2026_03_11_add_missing_tables_and_columns.sql.
 *
 * NOTE: All DDL identifiers are compile-time constants — no user input is
 * interpolated.
 */
export async function ensureAdImagesTable(): Promise<void> {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('AdImages', 'U') IS NULL
    BEGIN
      CREATE TABLE AdImages (
        Id NVARCHAR(100) PRIMARY KEY,
        AdId NVARCHAR(100) NOT NULL,
        Url NVARCHAR(MAX) NOT NULL,
        SortOrder INT DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (AdId) REFERENCES Ads(Id) ON DELETE CASCADE
      );
      CREATE INDEX IX_AdImages_AdId ON AdImages(AdId);
    END
  `);
}

/**
 * Ensures the ChatRequests table exists in the database.
 * Creates it (with all required columns and indexes) if it is absent.
 * Uses OBJECT_ID as an idempotent guard, matching the pattern in
 * migrations/2026_03_11_add_missing_tables_and_columns.sql.
 *
 * NOTE: All DDL identifiers are compile-time constants — no user input is
 * interpolated.
 */
export async function ensureChatRequestsTable(): Promise<void> {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('ChatRequests', 'U') IS NULL
    BEGIN
      CREATE TABLE ChatRequests (
        Id NVARCHAR(100) PRIMARY KEY,
        FromUserId NVARCHAR(100) NOT NULL,
        ToUserId NVARCHAR(100) NOT NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'PENDING',
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (FromUserId) REFERENCES Users(Id),
        FOREIGN KEY (ToUserId) REFERENCES Users(Id)
      );
      CREATE INDEX IX_ChatRequests_ToUserId ON ChatRequests(ToUserId);
      CREATE INDEX IX_ChatRequests_FromUserId ON ChatRequests(FromUserId);
    END
  `);
}

/**
 * Widens Ads.MainImageUrl and AdImages.Url from NVARCHAR(1000) to
 * NVARCHAR(MAX) on existing databases so that data-URL fallback images
 * (generated when Azure Blob Storage is not configured) can be stored.
 *
 * Idempotent: ALTER COLUMN to NVARCHAR(MAX) is a no-op when the column
 * is already NVARCHAR(MAX).  The INFORMATION_SCHEMA check avoids running
 * the ALTER on fresh databases where the columns were already created as
 * NVARCHAR(MAX).
 *
 * Concurrency: the module-level flag prevents redundant SQL calls within
 * the same Function App instance.  Concurrent invocations that read false
 * simultaneously will both execute the idempotent migration — harmless.
 *
 * NOTE: All DDL identifiers are compile-time constants — no user input is
 * interpolated.
 */
let _imageUrlColumnsExpanded = false;
export async function ensureImageUrlColumnsExpanded(): Promise<void> {
  if (_imageUrlColumnsExpanded) return;
  const pool = await getPool();
  await pool.request().query(`
    -- Widen Ads.MainImageUrl if it has a bounded length (not already MAX).
    -- In SQL Server INFORMATION_SCHEMA, CHARACTER_MAXIMUM_LENGTH = -1 means
    -- the column is already (N)VARCHAR(MAX).
    IF EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Ads' AND COLUMN_NAME = 'MainImageUrl'
        AND CHARACTER_MAXIMUM_LENGTH IS NOT NULL AND CHARACTER_MAXIMUM_LENGTH <> -1
    )
      ALTER TABLE Ads ALTER COLUMN MainImageUrl NVARCHAR(MAX) NULL;

    -- Widen AdImages.Url if it has a bounded length (not already MAX).
    IF EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'AdImages' AND COLUMN_NAME = 'Url'
        AND CHARACTER_MAXIMUM_LENGTH IS NOT NULL AND CHARACTER_MAXIMUM_LENGTH <> -1
    )
      ALTER TABLE AdImages ALTER COLUMN Url NVARCHAR(MAX) NOT NULL;
  `);
  _imageUrlColumnsExpanded = true;
}
