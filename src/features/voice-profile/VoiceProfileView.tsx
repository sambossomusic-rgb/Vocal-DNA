import { useMemo, useState } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion } from '../../db/dataVersion';
import type { Song, Rating, RepertoireStatus } from '../../types/domain';
import { computeVoiceProfile } from '../../analytics/voiceProfileEngine';
import { computeKeyReviewCandidates } from '../../analytics/recommendationEngine';
import type { FilterState } from '../library/FilterPanel';

interface Props {
  onOpenSong: (songId: string, contextIds: string[]) => void;
  onNavigateToLibrary: (filterPatch: Partial<FilterState>, label?: string) => void;
}

function stars(confidence: number): string {
  return '★'.repeat(confidence) + '☆'.repeat(5 - confidence);
}

export function VoiceProfileView({ onOpenSong, onNavigateToLibrary }: Props): JSX.Element {
  const dataVersion = useDataVersion();
  const [includeLearning, setIncludeLearning] = useState(false);

  const songs = useLiveQuery<Song[]>(() => db.songs.toArray(), [dataVersion], []);
  const ratings = useLiveQuery<Rating[]>(() => db.ratings.toArray(), [dataVersion], []);
  const songById = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

  const includeStatuses = useMemo<RepertoireStatus[]>(
    () => (includeLearning ? ['regular', 'occasional', 'learning'] : ['regular', 'occasional']),
    [includeLearning]
  );

  const profile = useMemo(
    () => computeVoiceProfile(songs, ratings, { includeStatuses }),
    [songs, ratings, includeStatuses]
  );
  const keyReviews = useMemo(
    () => computeKeyReviewCandidates(songs, ratings, { includeStatuses }),
    [songs, ratings, includeStatuses]
  );

  const maxKeyReliability = Math.max(1, ...profile.strongestKeys.map((k) => k.averageReliability));
  const fatigueTrendSongIds = [...new Set(profile.fatigueTrend.map((p) => p.songId))];
  const keyReviewSongIds = keyReviews.map((r) => r.songId);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Voice Profile</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
        Built from your active repertoire — {profile.ratedSongCount} rated song
        {profile.ratedSongCount === 1 ? '' : 's'}. Unexplored songs are excluded.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={`tag-chip ${!includeLearning ? 'tag-chip-assigned' : ''}`}
          onClick={() => setIncludeLearning(false)}
        >
          🎤 Active only
        </button>
        <button
          className={`tag-chip ${includeLearning ? 'tag-chip-assigned' : ''}`}
          onClick={() => setIncludeLearning(true)}
        >
          + 📚 Include Learning
        </button>
      </div>

      {profile.ratedSongCount === 0 ? (
        <div className="empty-state">
          No rated songs in your active repertoire yet. Mark songs Regular or Occasional and rate
          their Performance Reliability to build your profile.
        </div>
      ) : (
        <>
          {keyReviews.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 0 }}>
                Recommended key reviews ({keyReviews.length})
              </div>
              <div className="card">
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 0 }}>
                  Not automatic key changes — a working list of songs worth experimenting with, ranked by
                  vocal demand, reliability, and fatigue. Tap a song to open it, then update the key in
                  StageTraxx yourself.
                </p>
                {keyReviews.slice(0, 25).map((rec) => (
                  <button
                    key={rec.songId}
                    className="clickable-row"
                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 0', borderBottom: '1px solid var(--border)' }}
                    onClick={() => onOpenSong(rec.songId, keyReviewSongIds)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 14 }}>
                      <span style={{ fontWeight: 600 }}>{rec.title.trim() || 'Untitled'}</span>
                      <span>
                        {rec.currentKey}
                        {rec.suggestedTestKey ? (
                          <>
                            {' '}
                            → try <strong style={{ color: 'var(--success)' }}>{rec.suggestedTestKey}</strong>
                          </>
                        ) : (
                          ''
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{rec.reason}</span>
                      <span style={{ fontSize: 12, color: 'var(--warning)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                        {stars(rec.confidence)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="section-title">Strongest keys (by reliability)</div>
          <div className="card">
            {profile.strongestKeys.slice(0, 8).map((k) => (
              <button
                key={k.key}
                className="clickable-row bar-row"
                onClick={() => onNavigateToLibrary({ keyNote: k.key }, `Key ${k.key}`)}
              >
                <div style={{ width: 32, fontSize: 13, color: 'var(--text-dim)' }}>{k.key}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(k.averageReliability / maxKeyReliability) * 100}%` }}
                  />
                </div>
                <div style={{ width: 100, textAlign: 'right', fontSize: 12, color: 'var(--text-dim)' }}>
                  reliability {k.averageReliability.toFixed(1)} · {k.songCount} song{k.songCount === 1 ? '' : 's'}
                </div>
              </button>
            ))}
          </div>

          <div className="section-title">Weakest keys (by reliability)</div>
          <div className="card">
            {profile.weakestKeys.slice(0, 8).map((k) => (
              <button
                key={k.key}
                className="clickable-row"
                style={{ justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}
                onClick={() => onNavigateToLibrary({ keyNote: k.key }, `Key ${k.key}`)}
              >
                <span>Key {k.key}</span>
                <span style={{ color: 'var(--text-dim)' }}>
                  reliability {k.averageReliability.toFixed(1)} · {k.songCount} song
                  {k.songCount === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>

          <div className="section-title">Repertoire map</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {profile.quadrants.map((q) => (
              <div className="card" key={q.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <div style={{ fontWeight: 700 }}>{q.label}</div>
                  {q.songIds.length > 0 && (
                    <button
                      className="clickable-row"
                      style={{ width: 'auto', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}
                      onClick={() => onNavigateToLibrary({ songIds: q.songIds }, q.label)}
                    >
                      View all →
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>{q.description}</div>
                {q.songIds.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>No songs here yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {q.songIds.slice(0, 6).map((id) => {
                      const song = songById.get(id);
                      if (!song) return null;
                      return (
                        <button
                          key={id}
                          onClick={() => onOpenSong(id, q.songIds)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text)',
                            textAlign: 'left',
                            fontSize: 13,
                            padding: '4px 0',
                            cursor: 'pointer',
                          }}
                        >
                          {song.title.trim() || 'Untitled'}
                        </button>
                      );
                    })}
                    {q.songIds.length > 6 && (
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>+{q.songIds.length - 6} more</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>Recent fatigue trend</span>
            {fatigueTrendSongIds.length > 0 && (
              <button
                className="button-secondary"
                style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
                onClick={() => onNavigateToLibrary({ songIds: fatigueTrendSongIds }, 'Recent fatigue trend')}
              >
                View all in Library
              </button>
            )}
          </div>
          <div className="card">
            {profile.fatigueTrend.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Not enough rated songs yet.</div>
            )}
            {profile.fatigueTrend.map((point, i) => (
              <button
                key={`${point.ratedAt}-${i}`}
                className="clickable-row"
                style={{ justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}
                onClick={() => onOpenSong(point.songId, fatigueTrendSongIds)}
              >
                <span style={{ color: 'var(--text-dim)' }}>{point.songTitle}</span>
                <span>{'●'.repeat(point.fatigue)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
