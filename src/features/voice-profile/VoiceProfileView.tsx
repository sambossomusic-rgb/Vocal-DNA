import { useMemo } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion } from '../../db/dataVersion';
import type { Song, Rating } from '../../types/domain';
import { computeVoiceProfile } from '../../analytics/voiceProfileEngine';
import type { FilterState } from '../library/FilterPanel';

interface Props {
  onOpenSong: (songId: string) => void;
  onNavigateToLibrary: (filterPatch: Partial<FilterState>, label?: string) => void;
}

export function VoiceProfileView({ onOpenSong, onNavigateToLibrary }: Props): JSX.Element {
  const dataVersion = useDataVersion();
  const songs = useLiveQuery<Song[]>(() => db.songs.toArray(), [dataVersion], []);
  const ratings = useLiveQuery<Rating[]>(() => db.ratings.toArray(), [dataVersion], []);
  const songById = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

  const profile = useMemo(() => computeVoiceProfile(songs, ratings), [songs, ratings]);

  if (profile.ratedSongCount === 0) {
    return (
      <div className="empty-state">
        Rate some songs first — your Voice Profile is built entirely from your own
        demand/reliability/enjoyment/fatigue/transpose ratings, so it has nothing to show yet.
      </div>
    );
  }

  const maxKeyReliability = Math.max(1, ...profile.strongestKeys.map((k) => k.averageReliability));
  const maxTransposeCount = Math.max(1, ...profile.transposePatterns.map((t) => t.songCount));
  const fatigueTrendSongIds = [...new Set(profile.fatigueTrend.map((p) => p.songId))];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Voice Profile</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 0, marginBottom: 20 }}>
        Built from {profile.ratedSongCount} rated song{profile.ratedSongCount === 1 ? '' : 's'}.
      </p>

      <div className="section-title" style={{ marginTop: 0 }}>
        Strongest keys (by reliability)
      </div>
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

      <div className="section-title">Transpose patterns</div>
      <div className="card">
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10 }}>
          Average transpose: {profile.averageTranspose !== null ? profile.averageTranspose.toFixed(1) : '—'}{' '}
          semitones
        </div>
        {profile.transposePatterns.slice(0, 8).map((t) => (
          <div className="bar-row" key={t.transpose}>
            <div style={{ width: 48, fontSize: 13, color: 'var(--text-dim)' }}>
              {t.transpose > 0 ? `+${t.transpose}` : t.transpose}
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(t.songCount / maxTransposeCount) * 100}%` }}
              />
            </div>
            <div style={{ width: 60, textAlign: 'right', fontSize: 12 }}>{t.songCount}</div>
          </div>
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
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
              {q.description}
            </div>
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
                      onClick={() => onOpenSong(id)}
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
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    +{q.songIds.length - 6} more
                  </div>
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
            onClick={() => onOpenSong(point.songId)}
          >
            <span style={{ color: 'var(--text-dim)' }}>{point.songTitle}</span>
            <span>{'●'.repeat(point.fatigue)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
