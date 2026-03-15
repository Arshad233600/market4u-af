-- Migration: 2026_03_15_fix_lat_long_decimal
-- Converts Ads.Latitude and Ads.Longitude from FLOAT to DECIMAL(9, 6).
-- DECIMAL(9, 6) provides 3 integer digits and 6 decimal digits, which is
-- sufficient for all valid latitude (-90 to 90) and longitude (-180 to 180)
-- values with sub-metre accuracy.
--
-- Also handles the case where the columns were created as DECIMAL without
-- explicit precision (defaulting to DECIMAL(18, 0) with no decimal places).
--
-- Idempotent: ALTER COLUMN is a no-op when the column already has the
-- target type and precision.
-- Safe to run multiple times; no data is lost (values are rounded to
-- 6 decimal places if they had more).

IF COL_LENGTH('Ads', 'Latitude') IS NOT NULL
BEGIN
    ALTER TABLE Ads ALTER COLUMN Latitude DECIMAL(9, 6) NULL;
END

IF COL_LENGTH('Ads', 'Longitude') IS NOT NULL
BEGIN
    ALTER TABLE Ads ALTER COLUMN Longitude DECIMAL(9, 6) NULL;
END

PRINT 'Migration 2026_03_15_fix_lat_long_decimal applied successfully.';
