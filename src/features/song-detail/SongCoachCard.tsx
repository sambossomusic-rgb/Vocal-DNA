import { useMemo } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion, bumpDataVersion } from '../../db/dataVersion';
import type { Song, Rating } from '../../types/domain';
import { computeSongCoach } from '../../analytics/songCoachEngine';
import { getCoachState, setCoachDecision, clearCoachState, type CoachState } from '../../db/coachState';

interface Props {
  song: Song;
  rating: Rating | undefined;
}

function stars(confidence: number): string {
  return '★'.repeat(confidence) + '☆'.repeat(5 - confidence);
}

/**
 * Song Coach (V5 item 4) — practical, plain-language advice for one song, plus
 * the Vocal Efficiency Review with Accept / Ignore / Test Later. Accepting
 * applies the suggested key inside VocalDNA only (never StageTraxx). Changing
 * the key by hand elsewhere marks the song "Review Pending" until it's
 * reassessed; this card reflects that state.
 */
export function SongCoachCard({ song, rating }: Props): JSX.Element {
  const dataVersion = useDataVersion();
  const allSongs = useLiveQuery<Song[]>(() => db.songs.toArray(), [dataVersion], []);
  const allRatings = useLiveQuery<Rating[]>(() => db.ratings.toArray(), [dataVersion], []);
  const coachState = useLiveQuery<CoachState | null>(() => getCoachState(song.id), [song.id, dataVersion], null);

  const coach = useMemo(
    () => computeSongCoach(song, rating, allSongs, allRatings),
    [song, rating, allSongs, allRatings]
  );

  const { insights, efficiency } = coach;
  const hasSuggestion = efficiency.verdict === 'experiment-specific-key' || efficiency.verdict === 'experiment-lower';

  async function accept(): Promise<void> {
    if (efficiency.suggestedKey) {
      await db.songs.update(song.id, { keyNote: efficiency.suggestedKey, updatedAt: new Date().toISOString() });
    }
    await setCoachDecision(song.id, 'accepted', efficiency.suggestedKey);
    bumpDataVersion();
  }
  async function ignore(): Promise<void> {
    await setCoachDecision(song.id, 'ignored', efficiency.suggestedKey);
    bumpDataVersion();
  }
  async function testLater(): Promise<void> {
    await setCoachDecision(song.id, 'test-later', efficiency.suggestedKey);
    bumpDataVersion();
  }
  async function reconsider(): Promise<void> {
    await clearCoachState(song.id);
    bumpDataVersion();
  }

  return (
    <div>
      {!coach.hasRating ? (
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          Rate this song below to unlock its performance coaching.
        </div>
      ) : (
        <>
          {insights.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: hasSuggestion || coachState ? 16 : 0 }}>
              {insights.map((ins) => (
                <div
                  key={ins.kind}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    paddingBottom: 10,
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: 20, lineHeight: '22px' }}>{ins.icon}</span>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: ins.tone === 'positive' ? 'var(--success)' : ins.tone === 'suggestion' ? 'var(--warning)' : 'var(--text)',
                      }}
                    >
                      {ins.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{ins.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Review Pending — key was changed by hand and not yet reassessed. */}
          {coachState?.decision === 'review-pending' && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--warning)' }}>
              <div style={{ fontWeight: 700, color: 'var(--warning)', marginBottom: 2 }}>⏳ Review Pending</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                You changed the key by hand. Reassess this song (below) after you’ve performed it in the new key to
                refresh its coaching.
              </div>
            </div>
          )}

          {/* Vocal Efficiency Review + decision buttons. */}
          {coachState?.decision !== 'review-pending' && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontWeight: 700 }}>{efficiency.headline}</div>
                {hasSuggestion && (
                  <span style={{ fontSize: 12, color: 'var(--warning)', whiteSpace: 'nowrap' }}>{stars(efficiency.confidence)}</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2 }}>{efficiency.detail}</div>

              {coachState?.decision === 'accepted' && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--success)' }}>
                  ✓ Accepted{coachState.suggestedKey ? ` — now set to ${coachState.suggestedKey} in VocalDNA` : ''}. Reassess after you’ve performed it.{' '}
                  <button className="clickable-row" style={{ width: 'auto', color: 'var(--accent)', fontWeight: 600 }} onClick={reconsider}>
                    Undo
                  </button>
                </div>
              )}

              {coachState?.decision === 'ignored' && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)' }}>
                  Keeping {efficiency.currentKey}. You can revisit anytime.{' '}
                  <button className="clickable-row" style={{ width: 'auto', color: 'var(--accent)', fontWeight: 600 }} onClick={reconsider}>
                    Reconsider
                  </button>
                </div>
              )}

              {hasSuggestion && (coachState === null || coachState.decision === 'test-later') && (
                <>
                  {coachState?.decision === 'test-later' && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)' }}>⏱ Marked to test later.</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button className="button-primary" style={{ padding: '8px 14px', minHeight: 40 }} onClick={accept}>
                      Accept recommendation
                    </button>
                    <button className="button-secondary" style={{ padding: '8px 14px', minHeight: 40 }} onClick={testLater}>
                      Test later
                    </button>
                    <button className="button-secondary" style={{ padding: '8px 14px', minHeight: 40 }} onClick={ignore}>
                      Ignore
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
