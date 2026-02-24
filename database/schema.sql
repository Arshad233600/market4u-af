
-- Execute this in Azure SQL Query Editor to setup the database

CREATE TABLE Users (
    Id NVARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(100),
    Phone NVARCHAR(20) UNIQUE,
    Email NVARCHAR(100),
    AvatarUrl NVARCHAR(500),
    IsVerified BIT DEFAULT 0,
    Role NVARCHAR(20) DEFAULT 'USER', -- ADMIN, USER
    Balance DECIMAL(18, 2) DEFAULT 0,
    IsDeleted BIT DEFAULT 0, -- Soft Delete
    DeletedAt DATETIME NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    RowVersion ROWVERSION -- Optimistic Concurrency
);

CREATE TABLE Ads (
    Id NVARCHAR(50) PRIMARY KEY,
    UserId NVARCHAR(50) NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Price DECIMAL(18, 2) NOT NULL,
    Location NVARCHAR(100),
    Latitude FLOAT,
    Longitude FLOAT,
    MainImageUrl NVARCHAR(MAX), -- Primary image for thumbnails
    Category NVARCHAR(50),
    SubCategory NVARCHAR(50),
    Description NVARCHAR(MAX),
    Status NVARCHAR(20) DEFAULT 'PENDING', -- DRAFT, PENDING, ACTIVE, REJECTED, SOLD, ARCHIVED
    Views INT DEFAULT 0,
    IsPromoted BIT DEFAULT 0,
    IsDeleted BIT DEFAULT 0, -- Soft Delete
    DeletedAt DATETIME NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    RowVersion ROWVERSION, -- Optimistic Concurrency
    FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT CHK_AdStatus CHECK (Status IN ('DRAFT', 'PENDING', 'ACTIVE', 'REJECTED', 'SOLD', 'ARCHIVED'))
);

CREATE TABLE AdImages (
    Id NVARCHAR(50) PRIMARY KEY,
    AdId NVARCHAR(50) NOT NULL,
    Url NVARCHAR(MAX) NOT NULL,
    SortOrder INT DEFAULT 0,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (AdId) REFERENCES Ads(Id) ON DELETE CASCADE
);

CREATE TABLE WalletTransactions (
    Id NVARCHAR(50) PRIMARY KEY,
    UserId NVARCHAR(50) NOT NULL,
    Amount DECIMAL(18, 2) NOT NULL,
    Type NVARCHAR(20) NOT NULL, -- DEPOSIT, WITHDRAWAL, PAYMENT, PROMO
    Description NVARCHAR(255),
    Status NVARCHAR(20) DEFAULT 'SUCCESS', -- SUCCESS, PENDING, FAILED
    Date DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT CHK_TransactionType CHECK (Type IN ('DEPOSIT', 'WITHDRAWAL', 'PAYMENT', 'PROMO'))
);

CREATE TABLE Conversations (
    Id NVARCHAR(50) PRIMARY KEY,
    AdId NVARCHAR(50) NOT NULL,
    BuyerId NVARCHAR(50) NOT NULL,
    SellerId NVARCHAR(50) NOT NULL,
    LastMessage NVARCHAR(MAX),
    LastMessageTime DATETIME DEFAULT GETDATE(),
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (AdId) REFERENCES Ads(Id),
    FOREIGN KEY (BuyerId) REFERENCES Users(Id),
    FOREIGN KEY (SellerId) REFERENCES Users(Id),
    CONSTRAINT UQ_Conversation UNIQUE (BuyerId, SellerId, AdId)
);

CREATE TABLE Messages (
    Id NVARCHAR(50) PRIMARY KEY,
    ConversationId NVARCHAR(50) NOT NULL,
    SenderId NVARCHAR(50) NOT NULL,
    Text NVARCHAR(MAX) NOT NULL,
    Type NVARCHAR(20) DEFAULT 'TEXT', -- TEXT, IMAGE, VOICE
    IsRead BIT DEFAULT 0,
    IsDeleted BIT DEFAULT 0,
    Timestamp DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (ConversationId) REFERENCES Conversations(Id),
    FOREIGN KEY (SenderId) REFERENCES Users(Id)
);

CREATE TABLE Favorites (
    UserId NVARCHAR(50) NOT NULL,
    AdId NVARCHAR(50) NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    PRIMARY KEY (UserId, AdId),
    FOREIGN KEY (UserId) REFERENCES Users(Id),
    FOREIGN KEY (AdId) REFERENCES Ads(Id)
);

CREATE INDEX IX_Ads_Category ON Ads(Category);
CREATE INDEX IX_Ads_Location ON Ads(Location);
CREATE INDEX IX_Ads_Price ON Ads(Price);
CREATE INDEX IX_Ads_Status ON Ads(Status);
CREATE INDEX IX_AdImages_AdId ON AdImages(AdId);
CREATE INDEX IX_Messages_ConversationId ON Messages(ConversationId);
CREATE INDEX IX_Wallet_UserId ON WalletTransactions(UserId);
