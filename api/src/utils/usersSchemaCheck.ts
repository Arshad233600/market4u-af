import { getPool } from "../db";

/**
 * Columns that may be absent from older Users tables that were created before
 * the corresponding schema migration was applied.
 *
 * These are the columns referenced by login, register, and getMe queries.
 * Fundamental columns (Id, Name, Email, Phone, PasswordHash, Role, IsVerified,
 * CreatedAt) are assumed to always exist.
 */
export const USERS_MIGRATION_COLUMNS = [
  "AvatarUrl",
  "IsDeleted",
  "DeletedAt",
  "VerificationStatus",
  "UpdatedAt",
] as const;

export type UsersMigrationColumn = (typeof USERS_MIGRATION_COLUMNS)[number];

export interface UsersSchemaResult {
  schemaOk: boolean;
  missingColumns: string[];
}

/**
 * DDL statements to add missing Users columns (idempotent via COL_LENGTH guard).
 * Keys must match names in USERS_MIGRATION_COLUMNS.
 *
 * These DDL strings mirror the ALTER TABLE statements in
 * migrations/2026_03_10_add_users_columns.sql — keep them in sync when
 * adding new columns.  The migration file wraps each in a COL_LENGTH guard
 * for manual runs; here the guard is applied dynamically in
 * applyMissingUsersColumns().
 *
 * NOTE: Column names are compile-time constants — no user input is interpolated.
 */
const COLUMN_DDL: Record<UsersMigrationColumn, string> = {
  AvatarUrl:          "ALTER TABLE Users ADD AvatarUrl NVARCHAR(1000) NULL",
  IsDeleted:          "ALTER TABLE Users ADD IsDeleted BIT NOT NULL DEFAULT 0",
  DeletedAt:          "ALTER TABLE Users ADD DeletedAt DATETIME2 NULL",
  VerificationStatus: "ALTER TABLE Users ADD VerificationStatus NVARCHAR(50) NOT NULL DEFAULT 'NONE'",
  UpdatedAt:          "ALTER TABLE Users ADD UpdatedAt DATETIME2 NULL DEFAULT GETUTCDATE()",
};

/**
 * Checks whether all migration-tracked Users columns exist in the live database.
 * Uses COL_LENGTH (returns NULL when a column is absent) so the check is cheap
 * and idempotent — safe to call on every auth request.
 *
 * NOTE: USERS_MIGRATION_COLUMNS is a compile-time constant array of known column
 * names (no user input). The interpolation below is safe by design; do not add
 * user-supplied values to USERS_MIGRATION_COLUMNS.
 */
export async function checkUsersSchema(): Promise<UsersSchemaResult> {
  const pool = await getPool();
  const selects = USERS_MIGRATION_COLUMNS.map(
    (col) => `COL_LENGTH('Users','${col}') AS [${col}]`
  ).join(", ");
  const result = await pool.request().query(`SELECT ${selects}`);
  const row: Record<string, number | null> = result.recordset[0] ?? {};
  const missingColumns = USERS_MIGRATION_COLUMNS.filter(
    (col) => row[col] == null
  );
  return { schemaOk: missingColumns.length === 0, missingColumns };
}

/**
 * Applies DDL migrations for any missing Users columns.
 * Each ALTER TABLE is wrapped in an idempotent COL_LENGTH guard so the
 * function is safe to call concurrently — concurrent requests will both
 * succeed rather than one failing with "column already exists".
 *
 * @returns The list of columns that were added (empty when schema was already up-to-date).
 */
export async function applyMissingUsersColumns(
  missingColumns: string[],
  logger?: (msg: string) => void
): Promise<string[]> {
  if (missingColumns.length === 0) return [];
  const pool = await getPool();
  const applied: string[] = [];
  for (const col of missingColumns) {
    // Security: only interpolate column names that exist in the compile-time COLUMN_DDL allowlist.
    if (!(col in COLUMN_DDL)) {
      if (logger) {
        logger(
          `[usersSchemaCheck] no DDL migration available for missing column '${col}'. ` +
            `This column must exist from init.sql; manual database repair is required.`
        );
      }
      continue;
    }
    const ddl = COLUMN_DDL[col as UsersMigrationColumn];
    try {
      // Re-check with COL_LENGTH inside the server to guard against a concurrent migration.
      // `col` is safe here because it passed the COLUMN_DDL allowlist check above.
      await pool
        .request()
        .query(`IF COL_LENGTH('Users','${col}') IS NULL BEGIN ${ddl} END`);
      applied.push(col);
    } catch (err) {
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
