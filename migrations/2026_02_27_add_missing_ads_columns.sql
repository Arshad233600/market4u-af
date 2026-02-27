-- Migration: 2026_02_27_add_missing_ads_columns
-- Idempotent: uses COL_LENGTH to add only the columns that are absent.
-- COL_LENGTH('TableName', 'ColumnName') returns NULL when the column does not exist.
-- Safe to run multiple times; each ALTER runs only once.

IF COL_LENGTH('Ads', 'SubCategory') IS NULL
BEGIN
    ALTER TABLE Ads ADD SubCategory NVARCHAR(100) NULL;
END

IF COL_LENGTH('Ads', 'Latitude') IS NULL
BEGIN
    ALTER TABLE Ads ADD Latitude FLOAT NULL;
END

IF COL_LENGTH('Ads', 'Longitude') IS NULL
BEGIN
    ALTER TABLE Ads ADD Longitude FLOAT NULL;
END

IF COL_LENGTH('Ads', 'MainImageUrl') IS NULL
BEGIN
    ALTER TABLE Ads ADD MainImageUrl NVARCHAR(1000) NULL;
END

IF COL_LENGTH('Ads', 'Condition') IS NULL
BEGIN
    ALTER TABLE Ads ADD Condition NVARCHAR(50) NOT NULL DEFAULT 'used';
END

IF COL_LENGTH('Ads', 'IsNegotiable') IS NULL
BEGIN
    ALTER TABLE Ads ADD IsNegotiable BIT NOT NULL DEFAULT 0;
END

IF COL_LENGTH('Ads', 'DeliveryAvailable') IS NULL
BEGIN
    ALTER TABLE Ads ADD DeliveryAvailable BIT NOT NULL DEFAULT 0;
END

IF COL_LENGTH('Ads', 'DynamicFields') IS NULL
BEGIN
    ALTER TABLE Ads ADD DynamicFields NVARCHAR(MAX) NULL;
END

IF COL_LENGTH('Ads', 'IsPromoted') IS NULL
BEGIN
    ALTER TABLE Ads ADD IsPromoted BIT NOT NULL DEFAULT 0;
END

IF COL_LENGTH('Ads', 'IsDeleted') IS NULL
BEGIN
    ALTER TABLE Ads ADD IsDeleted BIT NOT NULL DEFAULT 0;
END

IF COL_LENGTH('Ads', 'DeletedAt') IS NULL
BEGIN
    ALTER TABLE Ads ADD DeletedAt DATETIME2 NULL;
END

IF COL_LENGTH('Ads', 'Views') IS NULL
BEGIN
    ALTER TABLE Ads ADD Views INT NOT NULL DEFAULT 0;
END

IF COL_LENGTH('Ads', 'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE Ads ADD UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE();
END

PRINT 'Migration 2026_02_27_add_missing_ads_columns applied successfully.';
