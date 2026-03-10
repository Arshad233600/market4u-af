-- Migration: 2026_03_10_add_users_columns
-- Adds columns introduced after the initial Users table creation.
-- Idempotent: each ALTER runs only when the column does not already exist.
-- Safe to run multiple times; no data is affected.
--
-- These columns are required by:
--   - login:    IsDeleted (WHERE clause), AvatarUrl, VerificationStatus (SELECT)
--   - register: IsDeleted (INSERT)
--   - getMe:    AvatarUrl, VerificationStatus (SELECT)
--
-- The API auto-applies this migration at runtime via usersSchemaCheck.ts,
-- but running this script manually against the database is the preferred
-- approach for production deployments.

IF COL_LENGTH('Users', 'AvatarUrl') IS NULL
BEGIN
    ALTER TABLE Users ADD AvatarUrl NVARCHAR(1000) NULL;
END

IF COL_LENGTH('Users', 'IsDeleted') IS NULL
BEGIN
    ALTER TABLE Users ADD IsDeleted BIT NOT NULL DEFAULT 0;
END

IF COL_LENGTH('Users', 'DeletedAt') IS NULL
BEGIN
    ALTER TABLE Users ADD DeletedAt DATETIME2 NULL;
END

IF COL_LENGTH('Users', 'VerificationStatus') IS NULL
BEGIN
    ALTER TABLE Users ADD VerificationStatus NVARCHAR(50) NOT NULL DEFAULT 'NONE';
END

IF COL_LENGTH('Users', 'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE Users ADD UpdatedAt DATETIME2 NULL DEFAULT GETUTCDATE();
END

PRINT 'Migration 2026_03_10_add_users_columns applied successfully.';
