import { getPool } from "../db";

/**
 * Required columns for the Ads INSERT statement in postAd.
 * Any column absent from the live database will cause postAd to fail.
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
  "CreatedAt",
] as const;

export interface AdsSchemaResult {
  schemaOk: boolean;
  missingColumns: string[];
}

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
