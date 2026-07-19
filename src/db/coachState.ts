import { db } from './db';

/**
 * Per-song coach decision state (V5 item 4). When VocalDNA suggests a key
 * review, the performer can Accept, Ignore, or Test Later. If they change the
 * key by hand instead, the song is marked "Review Pending" until it's
 * reassessed. This is a VocalDNA-only decision layer — it never touches the
 * StageTraxx-owned song fields or the sacred ratings/assessmentHistory tables.
 *
 * Stored in the existing `settings` table (key `coach:{songId}`) so it needs
 * no schema migration. Writers bump the data version themselves.
 */

export type CoachDecision = 'accepted' | 'ignored' | 'test-later' | 'review-pending';

export interface CoachState {
  decision: CoachDecision;
  suggestedKey: string | null;
  decidedAt: string;
}

function settingKey(songId: string): string {
  return `coach:${songId}`;
}

export async function getCoachState(songId: string): Promise<CoachState | null> {
  const row = await db.settings.get(settingKey(songId));
  if (!row) return null;
  try {
    return JSON.parse(row.value) as CoachState;
  } catch {
    return null;
  }
}

/** All coach states, keyed by songId — for screens that summarise many songs. */
export async function getAllCoachStates(): Promise<Map<string, CoachState>> {
  const rows = await db.settings.where('key').startsWith('coach:').toArray();
  const map = new Map<string, CoachState>();
  for (const row of rows) {
    try {
      map.set(row.key.slice('coach:'.length), JSON.parse(row.value) as CoachState);
    } catch {
      // ignore malformed rows
    }
  }
  return map;
}

export async function setCoachDecision(
  songId: string,
  decision: CoachDecision,
  suggestedKey: string | null
): Promise<void> {
  const state: CoachState = { decision, suggestedKey, decidedAt: new Date().toISOString() };
  await db.settings.put({ key: settingKey(songId), value: JSON.stringify(state) });
}

export async function clearCoachState(songId: string): Promise<void> {
  await db.settings.delete(settingKey(songId));
}
