-- Market4U Database Schema
-- Run this script on your Azure SQL Database after provisioning

-- Users Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        Id NVARCHAR(100) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        Phone NVARCHAR(50),
        PasswordHash NVARCHAR(500) NOT NULL,
        AvatarUrl NVARCHAR(1000),
        Role NVARCHAR(50) DEFAULT 'USER',
        IsVerified BIT DEFAULT 0,
        VerificationStatus NVARCHAR(50) DEFAULT 'NONE',
        IsDeleted BIT DEFAULT 0,
        DeletedAt DATETIME2 NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_Users_Email ON Users(Email);
END
ELSE
BEGIN
    -- Add IsDeleted column if it doesn't exist (for existing databases)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'IsDeleted')
    BEGIN
        ALTER TABLE Users ADD IsDeleted BIT NOT NULL DEFAULT 0;
    END
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'DeletedAt')
    BEGIN
        ALTER TABLE Users ADD DeletedAt DATETIME2 NULL;
    END
    -- Add PasswordHash column if it doesn't exist (for existing databases missing it)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PasswordHash')
    BEGIN
        ALTER TABLE Users ADD PasswordHash NVARCHAR(500) NOT NULL DEFAULT '';
    END
    -- Add VerificationStatus column if it doesn't exist
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'VerificationStatus')
    BEGIN
        ALTER TABLE Users ADD VerificationStatus NVARCHAR(50) NOT NULL DEFAULT 'NONE';
    END
    -- Add AvatarUrl column if it doesn't exist (for databases created before this column was added)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'AvatarUrl')
    BEGIN
        ALTER TABLE Users ADD AvatarUrl NVARCHAR(1000) NULL;
    END
    -- Add UpdatedAt column if it doesn't exist
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'UpdatedAt')
    BEGIN
        ALTER TABLE Users ADD UpdatedAt DATETIME2 NULL DEFAULT GETUTCDATE();
    END
    -- Add UNIQUE constraint on Email if it doesn't exist (prevents duplicate profiles)
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes i
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.object_id = OBJECT_ID('Users') AND i.is_unique = 1 AND c.name = 'Email'
    )
    BEGIN
        -- Remove any duplicate emails before adding constraint (keep the most recently created active record)
        WITH CTE AS (
            SELECT Id, Email, IsDeleted, CreatedAt,
                   ROW_NUMBER() OVER (PARTITION BY Email ORDER BY IsDeleted ASC, CreatedAt DESC) AS rn
            FROM Users
        )
        UPDATE CTE SET IsDeleted = 1, DeletedAt = GETUTCDATE() WHERE rn > 1;

        ALTER TABLE Users ADD CONSTRAINT UQ_Users_Email UNIQUE (Email);
    END
END
GO

-- Ads Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Ads')
BEGIN
    CREATE TABLE Ads (
        Id NVARCHAR(100) PRIMARY KEY,
        UserId NVARCHAR(100) NOT NULL,
        Title NVARCHAR(500) NOT NULL,
        Description NVARCHAR(MAX),
        Price DECIMAL(18, 2) NOT NULL,
        Category NVARCHAR(100),
        SubCategory NVARCHAR(100),
        Location NVARCHAR(255),
        Latitude DECIMAL(9, 6),
        Longitude DECIMAL(9, 6),
        MainImageUrl NVARCHAR(MAX),
        Condition NVARCHAR(50) DEFAULT 'used',
        IsNegotiable BIT DEFAULT 0,
        DeliveryAvailable BIT DEFAULT 0,
        DynamicFields NVARCHAR(MAX),
        IsPromoted BIT DEFAULT 0,
        Status NVARCHAR(50) DEFAULT 'PENDING',
        IsDeleted BIT DEFAULT 0,
        DeletedAt DATETIME2 NULL,
        Views INT DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (UserId) REFERENCES Users(Id)
    );
    CREATE INDEX IX_Ads_UserId ON Ads(UserId);
    CREATE INDEX IX_Ads_Category ON Ads(Category);
    CREATE INDEX IX_Ads_Status ON Ads(Status);
    CREATE INDEX IX_Ads_CreatedAt ON Ads(CreatedAt DESC);
    -- Composite index covering the most common listing query:
    --   WHERE Status = 'ACTIVE' AND IsDeleted = 0 ORDER BY CreatedAt DESC
    CREATE INDEX IX_Ads_Status_IsDeleted_CreatedAt ON Ads(Status, IsDeleted, CreatedAt DESC);
END
ELSE
BEGIN
    -- Add Condition column if it doesn't exist (for existing databases)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Ads') AND name = 'Condition')
    BEGIN
        ALTER TABLE Ads ADD Condition NVARCHAR(50) DEFAULT 'used';
    END
    -- Add composite index if it doesn't exist (for databases created before this index was added)
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('Ads') AND name = 'IX_Ads_Status_IsDeleted_CreatedAt')
    BEGIN
        CREATE INDEX IX_Ads_Status_IsDeleted_CreatedAt ON Ads(Status, IsDeleted, CreatedAt DESC);
    END
    -- Add IsNegotiable column if it doesn't exist
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Ads') AND name = 'IsNegotiable')
    BEGIN
        ALTER TABLE Ads ADD IsNegotiable BIT DEFAULT 0;
    END
    -- Add DeliveryAvailable column if it doesn't exist
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Ads') AND name = 'DeliveryAvailable')
    BEGIN
        ALTER TABLE Ads ADD DeliveryAvailable BIT DEFAULT 0;
    END
    -- Add DynamicFields column if it doesn't exist
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Ads') AND name = 'DynamicFields')
    BEGIN
        ALTER TABLE Ads ADD DynamicFields NVARCHAR(MAX) NULL;
    END
END
GO

-- AdImages Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AdImages')
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
GO

-- Favorites Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Favorites')
BEGIN
    CREATE TABLE Favorites (
        Id NVARCHAR(100) PRIMARY KEY,
        UserId NVARCHAR(100) NOT NULL,
        AdId NVARCHAR(100) NOT NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (UserId) REFERENCES Users(Id),
        FOREIGN KEY (AdId) REFERENCES Ads(Id) ON DELETE CASCADE,
        UNIQUE(UserId, AdId)
    );
    CREATE INDEX IX_Favorites_UserId ON Favorites(UserId);
    CREATE INDEX IX_Favorites_AdId ON Favorites(AdId);
END
GO

-- Messages Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Messages')
BEGIN
    CREATE TABLE Messages (
        Id NVARCHAR(100) PRIMARY KEY,
        FromUserId NVARCHAR(100) NOT NULL,
        ToUserId NVARCHAR(100) NOT NULL,
        AdId NVARCHAR(100),
        Content NVARCHAR(MAX) NOT NULL,
        IsRead BIT DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (FromUserId) REFERENCES Users(Id),
        FOREIGN KEY (ToUserId) REFERENCES Users(Id),
        FOREIGN KEY (AdId) REFERENCES Ads(Id) ON DELETE SET NULL
    );
    CREATE INDEX IX_Messages_FromUser ON Messages(FromUserId);
    CREATE INDEX IX_Messages_ToUser ON Messages(ToUserId);
    CREATE INDEX IX_Messages_AdId ON Messages(AdId);
    CREATE INDEX IX_Messages_CreatedAt ON Messages(CreatedAt DESC);
END
GO

-- WalletTransactions Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WalletTransactions')
BEGIN
    CREATE TABLE WalletTransactions (
        Id NVARCHAR(100) PRIMARY KEY,
        UserId NVARCHAR(100) NOT NULL,
        Amount DECIMAL(18, 2) NOT NULL,
        Type NVARCHAR(50) NOT NULL, -- 'CREDIT' or 'DEBIT'
        Status NVARCHAR(50) DEFAULT 'PENDING',
        Description NVARCHAR(500),
        ReferenceId NVARCHAR(255),
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (UserId) REFERENCES Users(Id)
    );
    CREATE INDEX IX_WalletTransactions_UserId ON WalletTransactions(UserId);
    CREATE INDEX IX_WalletTransactions_CreatedAt ON WalletTransactions(CreatedAt DESC);
END
GO

-- Notifications Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Notifications')
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
GO

-- Add sample admin user (password: admin123)
-- PasswordHash is bcrypt hash of 'admin123' with 10 rounds
IF NOT EXISTS (SELECT * FROM Users WHERE Email = 'admin@market4u.com')
BEGIN
    INSERT INTO Users (Id, Name, Email, Phone, PasswordHash, Role, IsVerified, CreatedAt)
    VALUES ('u_admin_1', 'Admin User', 'admin@market4u.com', '+93700000001', '$2b$10$KOKNBFwWwSBh.R1RIwVL9Opr/86yjfBlTtwfE54sSXWl9daD6Ox2G', 'ADMIN', 1, GETUTCDATE());
END
GO

-- Add sample regular user (password: user123)
-- PasswordHash is bcrypt hash of 'user123' with 10 rounds
IF NOT EXISTS (SELECT * FROM Users WHERE Email = 'user@market4u.com')
BEGIN
    INSERT INTO Users (Id, Name, Email, Phone, PasswordHash, Role, IsVerified, CreatedAt)
    VALUES ('u_user_1', 'Test User', 'user@market4u.com', '+93700000002', '$2b$10$ZF2L0E2mhJM1ycZp8xXVk.7E3oWaQZolGS7Ue3mFQ9.TQxbOuNqSm', 'USER', 1, GETUTCDATE());
END
GO

-- Add guest user for unauthenticated ad posts
IF NOT EXISTS (SELECT * FROM Users WHERE Id = 'guest_user_0')
BEGIN
    INSERT INTO Users (Id, Name, Email, Phone, PasswordHash, Role, IsVerified, CreatedAt)
    VALUES ('guest_user_0', N'کاربر مهمان', 'guest@market4u.internal', NULL, '', 'GUEST', 0, GETUTCDATE());
END
GO

-- ChatRequests Table
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
GO

PRINT 'Database schema created successfully!';
