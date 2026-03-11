import { getPool } from "../db";

/**
 * Required columns for the Ads table.
 * Any column absent from the live database will cause related operations to fail.
 */
export const ADS_REQUIRED_COLUMNS = [
  "Id",
  "UserId",
  "Title",
  "Price",
  "Location",
  "Category",
  "SubCategory",
  "Description",
  "MainImageUrl",
  "Latitude",
  "Longitude",
  "Condition",
  "IsNegotiable",
  "DeliveryAvailable",
  "DynamicFields",
  "Status",
  "IsDeleted",
  "DeletedAt",
  "IsPromoted",
  "Views",
  "CreatedAt",
  "UpdatedAt",
] as const;

export interface AdsSchemaResult {
  schemaOk: boolean;
  missingColumns: string[];
}

/**
 * DDL statements to add missing Ads columns (idempotent via COL_LENGTH guard).
 * Keys must match names in ADS_REQUIRED_COLUMNS.
 *
 * NOTE: Column names are compile-time constants — no user input is interpolated.
 */
const COLUMN_DDL: Record<string, string> = {
  SubCategory:       "ALTER TABLE Ads ADD SubCategory NVARCHAR(100) NULL",
  MainImageUrl:      "ALTER TABLE Ads ADD MainImageUrl NVARCHAR(1000) NULL",
  Latitude:          "ALTER TABLE Ads ADD Latitude FLOAT NULL",
  Longitude:         "ALTER TABLE Ads ADD Longitude FLOAT NULL",
  Condition:         "ALTER TABLE Ads ADD Condition NVARCHAR(50) NOT NULL DEFAULT 'used'",
  IsNegotiable:      "ALTER TABLE Ads ADD IsNegotiable BIT NOT NULL DEFAULT 0",
  DeliveryAvailable: "ALTER TABLE Ads ADD DeliveryAvailable BIT NOT NULL DEFAULT 0",
  DynamicFields:     "ALTER TABLE Ads ADD DynamicFields NVARCHAR(MAX) NULL",
  Status:            "ALTER TABLE Ads ADD Status NVARCHAR(50) NOT NULL DEFAULT 'ACTIVE'",
  IsDeleted:         "ALTER TABLE Ads ADD IsDeleted BIT NOT NULL DEFAULT 0",
  DeletedAt:         "ALTER TABLE Ads ADD DeletedAt DATETIME2 NULL",
  IsPromoted:        "ALTER TABLE Ads ADD IsPromoted BIT NOT NULL DEFAULT 0",
  Views:             "ALTER TABLE Ads ADD Views INT NOT NULL DEFAULT 0",
  CreatedAt:         "ALTER TABLE Ads ADD CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()",
  UpdatedAt:         "ALTER TABLE Ads ADD UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()",
  Location:          "ALTER TABLE Ads ADD Location NVARCHAR(255) NULL",
  Category:          "ALTER TABLE Ads ADD Category NVARCHAR(100) NULL",
  Description:       "ALTER TABLE Ads ADD Description NVARCHAR(MAX) NULL",
};

/**
 * Checks whether all required Ads columns exist in the live database.
 * Uses COL_LENGTH (returns NULL when a column is absent) so the check is
 * identical to the idempotent migration guard in
 * migrations/2026_02_27_add_missing_ads_columns.sql.
 *
 * NOTE: ADS_REQUIRED_COLUMNS is a compile-time constant array of known
 * column names (no user input). The interpolation below is safe by design;
 * do not add user-supplied values to ADS_REQUIRED_COLUMNS.
 */
export async function checkAdsSchema(): Promise<AdsSchemaResult> {
  const pool = await getPool();
  // Build a single SELECT that evaluates COL_LENGTH for every required column.
  const selects = ADS_REQUIRED_COLUMNS.map(
    (col) => `COL_LENGTH('Ads','${col}') AS [${col}]`
  ).join(", ");
  const result = await pool.request().query(`SELECT ${selects}`);
  const row: Record<string, number | null> = result.recordset[0] ?? {};
  const missingColumns = ADS_REQUIRED_COLUMNS.filter(
    (col) => row[col] == null
  );
  return { schemaOk: missingColumns.length === 0, missingColumns };
}

/**
 * Applies DDL migrations for any missing Ads columns.
 * Each ALTER TABLE is wrapped in an idempotent COL_LENGTH guard so the
 * function is safe to call repeatedly.
 *
 * @returns The list of columns that were added (empty when schema was already up-to-date).
 */
export async function applyMissingAdsColumns(missingColumns: string[], logger?: (msg: string) => void): Promise<string[]> {
  if (missingColumns.length === 0) return [];
  const pool = await getPool();
  const applied: string[] = [];
  for (const col of missingColumns) {
    // Security: only interpolate column names that exist in the compile-time COLUMN_DDL allowlist.
    // This is the primary injection guard — `col` is only used if it's a known-safe key.
    if (!(col in COLUMN_DDL)) {
      if (logger) {
        logger(
          `[schemaCheck] no DDL migration available for missing column '${col}'. ` +
          `This column must exist from init.sql; manual database repair is required.`
        );
      }
      continue;
    }
    const ddl = COLUMN_DDL[col];
    try {
      // Re-check with COL_LENGTH inside the server to guard against a concurrent migration.
      // `col` is safe here because it passed the COLUMN_DDL allowlist check above.
      await pool
        .request()
        .query(`IF COL_LENGTH('Ads','${col}') IS NULL BEGIN ${ddl} END`);
      applied.push(col);
    } catch (err) {
      // Ignore "column already exists" errors from concurrent migrations; rethrow others.
      const msg = err instanceof Error ? err.message : String(err);
      if (/Column names in each table must be unique|already exists/i.test(msg)) {
        // Another request already added this column — treat as success.
        applied.push(col);
      } else {
        throw err;
      }
    }
  }
  return applied;
}
