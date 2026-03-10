/**
 * Tests for api/src/utils/usersSchemaCheck.ts
 *
 * All DB interactions are mocked so tests run entirely in-process.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── hoisted mock state ───────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockQuery = vi.fn().mockResolvedValue({ recordset: [{}], rowsAffected: [0] });
  const mockPool = { request: vi.fn().mockImplementation(() => ({ query: mockQuery })) };
  return { mockQuery, mockPool };
});

vi.mock('../../db', () => ({
  getPool: vi.fn().mockResolvedValue(mocks.mockPool),
}));

import { checkUsersSchema, applyMissingUsersColumns, USERS_MIGRATION_COLUMNS } from '../usersSchemaCheck';

beforeEach(() => {
  mocks.mockQuery.mockReset();
  mocks.mockPool.request.mockImplementation(() => ({ query: mocks.mockQuery }));
});

// ─── checkUsersSchema ──────────────────────────────────────────────────────

describe('checkUsersSchema()', () => {
  it('returns schemaOk=true when all columns are present', async () => {
    // All COL_LENGTH values are non-null (column exists)
    const row: Record<string, number> = {};
    for (const col of USERS_MIGRATION_COLUMNS) row[col] = 1;
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [row] });

    const result = await checkUsersSchema();
    expect(result.schemaOk).toBe(true);
    expect(result.missingColumns).toHaveLength(0);
  });

  it('returns schemaOk=false and lists missing columns when some are absent', async () => {
    // VerificationStatus and IsDeleted are NULL (missing)
    const row: Record<string, number | null> = {};
    for (const col of USERS_MIGRATION_COLUMNS) row[col] = 1;
    row['VerificationStatus'] = null;
    row['IsDeleted'] = null;
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [row] });

    const result = await checkUsersSchema();
    expect(result.schemaOk).toBe(false);
    expect(result.missingColumns).toContain('VerificationStatus');
    expect(result.missingColumns).toContain('IsDeleted');
    expect(result.missingColumns).toHaveLength(2);
  });

  it('returns all columns missing when recordset is empty', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });

    const result = await checkUsersSchema();
    expect(result.schemaOk).toBe(false);
    expect(result.missingColumns).toHaveLength(USERS_MIGRATION_COLUMNS.length);
  });
});

// ─── applyMissingUsersColumns ──────────────────────────────────────────────

describe('applyMissingUsersColumns()', () => {
  it('returns empty array when no columns are missing', async () => {
    const applied = await applyMissingUsersColumns([]);
    expect(applied).toHaveLength(0);
    expect(mocks.mockQuery).not.toHaveBeenCalled();
  });

  it('applies DDL for each known missing column', async () => {
    mocks.mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [0] });

    const applied = await applyMissingUsersColumns(['VerificationStatus', 'IsDeleted']);
    expect(applied).toContain('VerificationStatus');
    expect(applied).toContain('IsDeleted');
    // One query per missing column
    expect(mocks.mockQuery).toHaveBeenCalledTimes(2);
  });

  it('ignores unknown column names (not in COLUMN_DDL allowlist)', async () => {
    const warnings: string[] = [];
    const applied = await applyMissingUsersColumns(
      ['SomeUnknownColumn'],
      (msg) => warnings.push(msg)
    );
    expect(applied).toHaveLength(0);
    expect(warnings.some((w) => w.includes('SomeUnknownColumn'))).toBe(true);
    expect(mocks.mockQuery).not.toHaveBeenCalled();
  });

  it('treats "already exists" SQL errors as success (concurrent migration)', async () => {
    mocks.mockQuery.mockRejectedValueOnce(
      new Error('Column names in each table must be unique.')
    );

    const applied = await applyMissingUsersColumns(['AvatarUrl']);
    expect(applied).toContain('AvatarUrl');
  });

  it('rethrows unexpected SQL errors', async () => {
    mocks.mockQuery.mockRejectedValueOnce(new Error('Unexpected SQL error'));

    await expect(applyMissingUsersColumns(['IsDeleted'])).rejects.toThrow('Unexpected SQL error');
  });
});
