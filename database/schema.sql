
-- Execute this in Azure SQL Query Editor to setup the database
-- NOTE: The authoritative initialization script is api/sql/init.sql
-- This file mirrors that schema for reference.
-- Keep this file in sync with api/sql/init.sql whenever the schema changes.

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

CREATE TABLE AdImages (
    Id NVARCHAR(100) PRIMARY KEY,
    AdId NVARCHAR(100) NOT NULL,
    Url NVARCHAR(MAX) NOT NULL,
    SortOrder INT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (AdId) REFERENCES Ads(Id) ON DELETE CASCADE
);

CREATE INDEX IX_AdImages_AdId ON AdImages(AdId);

CREATE TABLE Favorites (
    Id NVARCHAR(100) PRIMARY KEY,
    UserId NVARCHAR(100) NOT NULL,
    AdId NVARCHAR(100) NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(Id),
    FOREIGN KEY (AdId) REFERENCES Ads(Id) ON DELETE CASCADE,
    UNIQUE (UserId, AdId)
);

CREATE INDEX IX_Favorites_UserId ON Favorites(UserId);
CREATE INDEX IX_Favorites_AdId ON Favorites(AdId);

-- Direct peer-to-peer messaging (no Conversations table)
CREATE TABLE Messages (
    Id NVARCHAR(100) PRIMARY KEY,
    FromUserId NVARCHAR(100) NOT NULL,
    ToUserId NVARCHAR(100) NOT NULL,
    AdId NVARCHAR(100) NULL,
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

-- Type values: CREDIT, DEBIT, PAYMENT_AD_PROMO
-- Status values: PENDING, SUCCESS, FAILED
CREATE TABLE WalletTransactions (
    Id NVARCHAR(100) PRIMARY KEY,
    UserId NVARCHAR(100) NOT NULL,
    Amount DECIMAL(18, 2) NOT NULL,
    Type NVARCHAR(50) NOT NULL,
    Status NVARCHAR(50) DEFAULT 'PENDING',
    Description NVARCHAR(500),
    ReferenceId NVARCHAR(255),
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(Id)
);

CREATE INDEX IX_WalletTransactions_UserId ON WalletTransactions(UserId);
CREATE INDEX IX_WalletTransactions_CreatedAt ON WalletTransactions(CreatedAt DESC);

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

-- ============================================================
-- Sample / Seed Data
-- ============================================================

-- Admin user (password: admin123)
-- PasswordHash is bcrypt hash of 'admin123' with 10 rounds
INSERT INTO Users (Id, Name, Email, Phone, PasswordHash, Role, IsVerified, CreatedAt)
VALUES ('u_admin_1', 'Admin User', 'admin@market4u.com', '+93700000001', '$2b$10$KOKNBFwWwSBh.R1RIwVL9Opr/86yjfBlTtwfE54sSXWl9daD6Ox2G', 'ADMIN', 1, GETUTCDATE());

-- Regular test user (password: user123)
-- PasswordHash is bcrypt hash of 'user123' with 10 rounds
INSERT INTO Users (Id, Name, Email, Phone, PasswordHash, Role, IsVerified, CreatedAt)
VALUES ('u_user_1', 'Test User', 'user@market4u.com', '+93700000002', '$2b$10$ZF2L0E2mhJM1ycZp8xXVk.7E3oWaQZolGS7Ue3mFQ9.TQxbOuNqSm', 'USER', 1, GETUTCDATE());

-- Guest user for unauthenticated ad posts
INSERT INTO Users (Id, Name, Email, Phone, PasswordHash, Role, IsVerified, CreatedAt)
VALUES ('guest_user_0', N'کاربر مهمان', 'guest@market4u.internal', NULL, '', 'GUEST', 0, GETUTCDATE());
