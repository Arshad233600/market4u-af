-- Migration: 2026_03_11_add_missing_tables_and_columns
-- Adds the Notifications and ChatRequests tables that were not present in the
-- initial database deployment, and adds the IsPromoted and DeletedAt columns
-- that are required by the promote-ad and delete-ad operations.
--
-- All statements are idempotent:
--   • OBJECT_ID guards prevent duplicate table creation.
--   • COL_LENGTH guards prevent duplicate column additions.
--
-- Safe to run multiple times; no data is modified.

-- ─── Ads: IsPromoted ─────────────────────────────────────────────────────────
IF COL_LENGTH('Ads', 'IsPromoted') IS NULL
BEGIN
    ALTER TABLE Ads ADD IsPromoted BIT NOT NULL DEFAULT 0;
END

-- ─── Ads: DeletedAt ──────────────────────────────────────────────────────────
IF COL_LENGTH('Ads', 'DeletedAt') IS NULL
BEGIN
    ALTER TABLE Ads ADD DeletedAt DATETIME2 NULL;
END

-- ─── Ads: IsDeleted (should exist but guard it anyway) ───────────────────────
IF COL_LENGTH('Ads', 'IsDeleted') IS NULL
BEGIN
    ALTER TABLE Ads ADD IsDeleted BIT NOT NULL DEFAULT 0;
END

-- ─── Ads: Views ──────────────────────────────────────────────────────────────
IF COL_LENGTH('Ads', 'Views') IS NULL
BEGIN
    ALTER TABLE Ads ADD Views INT NOT NULL DEFAULT 0;
END

-- ─── Ads: UpdatedAt ──────────────────────────────────────────────────────────
IF COL_LENGTH('Ads', 'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE Ads ADD UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE();
END

-- ─── Notifications table ─────────────────────────────────────────────────────
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

-- ─── ChatRequests table ───────────────────────────────────────────────────────
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

PRINT 'Migration 2026_03_11_add_missing_tables_and_columns applied successfully.';
