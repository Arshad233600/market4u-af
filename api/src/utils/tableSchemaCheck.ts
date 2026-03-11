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
