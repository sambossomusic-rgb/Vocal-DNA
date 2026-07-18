import type { VocalDnaDatabase } from '../db/db';
import type { EntityType } from '../types/domain';

/**
 * Looks up the VocalDNA-internal UUID previously assigned to a given external
 * record. Returns undefined if this external record has never been imported.
 * Must be called within an active Dexie transaction that includes `externalIds`.
 */
export async function findInternalId(
  db: VocalDnaDatabase,
  entityType: EntityType,
  sourceSystem: string,
  sourceId: string
): Promise<string | undefined> {
  const row = await db.externalIds.get([entityType, sourceSystem, sourceId]);
  return row?.internalId;
}

/**
 * Records that a given external record now maps to a given internal UUID.
 * Call this exactly once, right after inserting a brand-new internal row.
 */
export async function recordExternalId(
  db: VocalDnaDatabase,
  entityType: EntityType,
  sourceSystem: string,
  sourceId: string,
  internalId: string
): Promise<void> {
  await db.externalIds.put({ entityType, sourceSystem, sourceId, internalId });
}

/**
 * Finds the existing internal UUID for a source record, or mints a new one.
 * Returns { internalId, isNew } so callers know whether to add or update the
 * actual entity row, and whether to count it as "inserted" or "updated".
 */
export async function resolveInternalId(
  db: VocalDnaDatabase,
  entityType: EntityType,
  sourceSystem: string,
  sourceId: string
): Promise<{ internalId: string; isNew: boolean }> {
  const existing = await findInternalId(db, entityType, sourceSystem, sourceId);
  if (existing) {
    return { internalId: existing, isNew: false };
  }
  const internalId = crypto.randomUUID();
  await recordExternalId(db, entityType, sourceSystem, sourceId, internalId);
  return { internalId, isNew: true };
}
