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
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_Users_Email ON Users(Email);
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
        Location NVARCHAR(255),
        MainImageUrl NVARCHAR(1000),
        Status NVARCHAR(50) DEFAULT 'PENDING',
        IsDeleted BIT DEFAULT 0,
        Views INT DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (UserId) REFERENCES Users(Id)
    );
    CREATE INDEX IX_Ads_UserId ON Ads(UserId);
    CREATE INDEX IX_Ads_Category ON Ads(Category);
    CREATE INDEX IX_Ads_Status ON Ads(Status);
    CREATE INDEX IX_Ads_CreatedAt ON Ads(CreatedAt DESC);
END
GO

-- AdImages Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AdImages')
BEGIN
    CREATE TABLE AdImages (
        Id NVARCHAR(100) PRIMARY KEY,
        AdId NVARCHAR(100) NOT NULL,
        Url NVARCHAR(1000) NOT NULL,
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

-- Add sample admin user (password: admin123)
IF NOT EXISTS (SELECT * FROM Users WHERE Email = 'admin@market4u.com')
BEGIN
    INSERT INTO Users (Id, Name, Email, Phone, PasswordHash, Role, IsVerified, CreatedAt)
    VALUES ('u_admin_1', 'Admin User', 'admin@market4u.com', '+989123456789', 'hashed_admin123_secure', 'ADMIN', 1, GETUTCDATE());
END
GO

-- Add sample regular user (password: user123)
IF NOT EXISTS (SELECT * FROM Users WHERE Email = 'user@market4u.com')
BEGIN
    INSERT INTO Users (Id, Name, Email, Phone, PasswordHash, Role, IsVerified, CreatedAt)
    VALUES ('u_user_1', 'Test User', 'user@market4u.com', '+989121234567', 'hashed_user123_secure', 'USER', 1, GETUTCDATE());
END
GO

PRINT 'Database schema created successfully!';
