-- Migration: 2026_03_02_add_chat_requests_table
-- Idempotent: creates the ChatRequests table only if it does not already exist.
-- Safe to run multiple times.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChatRequests')
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

PRINT 'Migration 2026_03_02_add_chat_requests_table applied successfully.';
