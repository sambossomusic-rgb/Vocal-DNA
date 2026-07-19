import { useMemo, useState } from 'react';
import { db } from '../../db/db';
import { useLiveQuery } from '../../db/useLiveQuery';
import { useDataVersion } from '../../db/dataVersion';
import type { Song, Artist, Folder, Rating, RepertoireStatus } from '../../types/domain';
import { REPERTOIRE_STATUS_LABELS, DEMAND_SCALE_LABELS, metricLabel } from '../../types/domain';
import { computeStats } from '../../analytics/statsEngine';
import { computeVoiceProfile } from '../../analytics/voiceProfileEngine';
import {
  computeKeyReviewCandidates,
  computeSongsToLearnNext,
  computeRediscoverSongs,
  computeSongsReadyForPromotion,
  computeSongsNeedingPractice,
  computeHiddenGems,
  computeRecoverySongs,
  computeHighDemandSongs,
} from '../../analytics/recommendationEngine';
import type { FilterState } from '../library/FilterPanel';
import { SuggestionList } from './SuggestionList';
import { KeyReviewList } from './KeyReviewList';

export type InsightsTab = 'voice' | 'repertoire' | 'recommendations' | 'health';

interface Props {
  tab: InsightsTab;
  onTabChange: (tab: InsightsTab) => void;
  onOpenSong: (songId: string, contextIds: string[]) => void;
  onNavigateToLibrary: (filterPatch: Partial<FilterState>, label?: string) => void;
}

const TABS: Array<{ key: InsightsTab; label: string }> = [
  { key: 'voice', label: 'Your Voice' },
  { key: 'repertoire', label: 'Your Repertoire' },
  { key: 'recommendations', label: 'Recommendations' },
  { key: 'health', label: 'Library Health' },
];

/**
 * Insights (V5 item 2) — Voice Profile and Statistics merged into one section
 * with four decision-focused tabs. Non-actionable charts (fatigue trend,
 * weakest-keys-by-reliability) are gone; every card here opens a filtered song
 * list, so analysis always becomes an action.
 */
export function InsightsView({ tab, onTabChange, onOpenSong, onNavigateToLibrary }: Props): JSX.Element {
  const dataVersion = useDataVersion();

  const songs = useLiveQuery<Song[]>(() => db.songs.toArray(), [dataVersion], []);
  const artists = useLiveQuery<Artist[]>(() => db.artists.toArray(), [dataVersion], []);
  const folders = useLiveQuery<Folder[]>(() => db.folders.toArray(), [dataVersion], []);
  const ratings = useLiveQuery<Rating[]>(() => db.ratings.toArray(), [dataVersion], []);

  if (songs.length === 0) {
    return <div className="empty-state">Sync a library to see insights.</div>;
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Insights</h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-button ${tab === t.key ? 'active' : ''}`}
            style={{ flex: '0 0 auto', padding: '10px 16px' }}
            onClick={() => onTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'voice' && <YourVoicePanel songs={songs} ratings={ratings} onOpenSong={onOpenSong} onNavigateToLibrary={onNavigateToLibrary} />}
      {tab === 'repertoire' && (
        <YourRepertoirePanel songs={songs} artists={artists} folders={folders} ratings={ratings} onNavigateToLibrary={onNavigateToLibrary} />
      )}
      {tab === 'recommendations' && (
        <RecommendationsPanel songs={songs} ratings={ratings} onOpenSong={onOpenSong} onNavigateToLibrary={onNavigateToLibrary} />
      )}
      {tab === 'health' && (
        <LibraryHealthPanel songs={songs} artists={artists} folders={folders} ratings={ratings} onNavigateToLibrary={onNavigateToLibrary} />
      )}
    </div>
  );
}

// --- Your Voice ------------------------------------------------------------

interface VoicePanelProps {
  songs: Song[];
  ratings: Rating[];
  onOpenSong: (songId: string, contextIds: string[]) => void;
  onNavigateToLibrary: (filterPatch: Partial<FilterState>, label?: string) => void;
}

function YourVoicePanel({ songs, ratings, onOpenSong, onNavigateToLibrary }: VoicePanelProps): JSX.Element {
  const [includeLearning, setIncludeLearning] = useState(false);
  const includeStatuses = useMemo<RepertoireStatus[]>(
    () => (includeLearning ? ['regular', 'occasional', 'learning'] : ['regular', 'occasional']),
    [includeLearning]
  );

  const profile = useMemo(() => computeVoiceProfile(songs, ratings, { includeStatuses }), [songs, ratings, includeStatuses]);
  const keyReviews = useMemo(() => computeKeyReviewCandidates(songs, ratings, { includeStatuses }), [songs, ratings, includeStatuses]);

  const comfortZone = profile.quadrants.find((q) => q.label === 'Comfort zone');
  const highestDemandKeys = useMemo(
    () => [...profile.strongestKeys].sort((a, b) => b.averageDemand - a.averageDemand).slice(0, 6),
    [profile.strongestKeys]
  );
  const maxKeyReliability = Math.max(1, ...profile.strongestKeys.map((k) => k.averageReliability));

  // Vocal Demand distribution across the active repertoire (V5 item 3).
  const demandDist = useMemo(() => {
    const active = new Set(includeStatuses);
    const statusBySong = new Map(ratings.map((r) => [r.songId, r.status]));
    const counts: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const r of ratings) {
      if (r.demand === null) continue;
      if (!active.has(statusBySong.get(r.songId) ?? 'unexplored')) continue;
      counts[r.demand].push(r.songId);
    }
    return counts;
  }, [ratings, includeStatuses]);
  const maxDemand = Math.max(1, ...Object.values(demandDist).map((ids) => ids.length));

  return (
    <div>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
        Built from your active repertoire — {profile.ratedSongCount} rated song
        {profile.ratedSongCount === 1 ? '' : 's'}. Unexplored songs are never included.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`tag-chip ${!includeLearning ? 'tag-chip-assigned' : ''}`} onClick={() => setIncludeLearning(false)}>
          🎤 Active only
        </button>
        <button className={`tag-chip ${includeLearning ? 'tag-chip-assigned' : ''}`} onClick={() => setIncludeLearning(true)}>
          + 📚 Include Learning
        </button>
      </div>

      {profile.ratedSongCount === 0 ? (
        <div className="empty-state">
          No rated songs in your active repertoire yet. Mark songs Regular or Occasional and rate their
          Performance Reliability to build your profile.
        </div>
      ) : (
        <>
          {keyReviews.length > 0 && <KeyReviewList candidates={keyReviews} onOpenSong={onOpenSong} />}

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
                  <div className="bar-fill" style={{ width: `${(k.averageReliability / maxKeyReliability) * 100}%` }} />
                </div>
                <div style={{ width: 108, textAlign: 'right', fontSize: 12, color: 'var(--text-dim)' }}>
                  reliability {k.averageReliability.toFixed(1)} · {k.songCount} song{k.songCount === 1 ? '' : 's'}
                </div>
              </button>
            ))}
          </div>

          <div className="section-title">Highest vocal demand keys</div>
          <div className="card">
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 0 }}>
              Where your most demanding numbers sit — useful when planning a set’s pacing.
            </p>
            {highestDemandKeys.map((k) => (
              <button
                key={k.key}
                className="clickable-row"
                style={{ justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}
                onClick={() => onNavigateToLibrary({ keyNote: k.key }, `Key ${k.key}`)}
              >
                <span>Key {k.key}</span>
                <span style={{ color: 'var(--text-dim)' }}>
                  demand {k.averageDemand.toFixed(1)} · {k.songCount} song{k.songCount === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>

          {comfortZone && (
            <>
              <div
                className="section-title"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
              >
                <span>Comfort zone ({comfortZone.songIds.length})</span>
                {comfortZone.songIds.length > 0 && (
                  <button
                    className="button-secondary"
                    style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
                    onClick={() => onNavigateToLibrary({ songIds: comfortZone.songIds }, 'Comfort zone')}
                  >
                    View all
                  </button>
                )}
              </div>
              <div className="card">
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 0 }}>{comfortZone.description}</p>
                {comfortZone.songIds.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Nothing here yet.</div>
                ) : (
                  comfortZone.songIds.slice(0, 10).map((id) => {
                    const song = songs.find((s) => s.id === id);
                    if (!song) return null;
                    return (
                      <button
                        key={id}
                        className="clickable-row"
                        style={{ padding: '6px 0', fontSize: 14 }}
                        onClick={() => onOpenSong(id, comfortZone.songIds)}
                      >
                        {song.title.trim() || 'Untitled'}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          <div className="section-title">Vocal demand distribution</div>
          <div className="card">
            {[5, 4, 3, 2, 1].map((level) => {
              const ids = demandDist[level];
              return (
                <button
                  key={level}
                  className="clickable-row bar-row"
                  disabled={ids.length === 0}
                  onClick={() => ids.length > 0 && onNavigateToLibrary({ songIds: ids }, `${DEMAND_SCALE_LABELS[level as 1 | 2 | 3 | 4 | 5]} demand`)}
                >
                  <div style={{ width: 92, fontSize: 12, color: 'var(--text-dim)' }}>
                    {DEMAND_SCALE_LABELS[level as 1 | 2 | 3 | 4 | 5]}
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${(ids.length / maxDemand) * 100}%`, background: level >= 4 ? 'var(--warning)' : 'var(--accent)' }}
                    />
                  </div>
                  <div style={{ width: 32, textAlign: 'right', fontSize: 13 }}>{ids.length}</div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// --- Your Repertoire -------------------------------------------------------

interface RepertoirePanelProps {
  songs: Song[];
  artists: Artist[];
  folders: Folder[];
  ratings: Rating[];
  onNavigateToLibrary: (filterPatch: Partial<FilterState>, label?: string) => void;
}

function YourRepertoirePanel({ songs, artists, folders, ratings, onNavigateToLibrary }: RepertoirePanelProps): JSX.Element {
  const stats = useMemo(() => computeStats(songs, artists, folders, ratings), [songs, artists, folders, ratings]);
  const maxFolderCount = Math.max(1, ...stats.songsPerFolder.map((f) => f.count));
  const maxKeyCount = Math.max(1, ...stats.keyDistribution.map((k) => k.count));

  return (
    <div>
      <div className="stat-grid">
        <div className="card">
          <div className="stat-number">{stats.totalSongs}</div>
          <div className="stat-label">Songs</div>
        </div>
        <div className="card">
          <div className="stat-number">{stats.totalArtists}</div>
          <div className="stat-label">Artists</div>
        </div>
        <div className="card">
          <div className="stat-number">{stats.totalFolders}</div>
          <div className="stat-label">Folders</div>
        </div>
        <div className="card">
          <div className="stat-number">{stats.averageBpm ? Math.round(stats.averageBpm) : '—'}</div>
          <div className="stat-label">Avg BPM</div>
        </div>
        <div className="card">
          <div className="stat-number">{Math.round(stats.ratingCoverage.percentRated)}%</div>
          <div className="stat-label">Songs assessed</div>
        </div>
      </div>

      <div className="section-title">Rating status breakdown</div>
      <div className="card">
        {stats.statusDistribution.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No songs assessed yet.</div>
        )}
        {stats.statusDistribution.map((s) => (
          <button
            key={s.status}
            className="clickable-row"
            style={{ justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}
            onClick={() => onNavigateToLibrary({ status: s.status }, REPERTOIRE_STATUS_LABELS[s.status])}
          >
            <span className={`pill pill-status-${s.status}`}>{REPERTOIRE_STATUS_LABELS[s.status]}</span>
            <span>{s.count}</span>
          </button>
        ))}
      </div>

      <div className="section-title">Average ratings (across assessed songs)</div>
      <div className="stat-grid">
        <RatingAvgCard label={metricLabel('demand')} value={stats.averageRatings.demand} />
        <RatingAvgCard label={metricLabel('reliability')} value={stats.averageRatings.reliability} />
        <RatingAvgCard label="Enjoyment" value={stats.averageRatings.enjoyment} />
        <RatingAvgCard label="Fatigue" value={stats.averageRatings.fatigue} />
      </div>

      <div className="section-title">Songs per folder</div>
      <div className="card">
        {stats.songsPerFolder.map((f) => (
          <button
            key={f.folderName}
            className="clickable-row bar-row"
            onClick={() => onNavigateToLibrary({ folderId: f.folderId }, f.folderName)}
          >
            <div style={{ width: 140, fontSize: 13, color: 'var(--text-dim)' }}>{f.folderName}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(f.count / maxFolderCount) * 100}%` }} />
            </div>
            <div style={{ width: 32, textAlign: 'right', fontSize: 13 }}>{f.count}</div>
          </button>
        ))}
      </div>

      <div className="section-title">Key distribution</div>
      <div className="card">
        {stats.keyDistribution.map((k) => (
          <button
            key={k.key}
            className="clickable-row bar-row"
            onClick={() => onNavigateToLibrary({ keyNote: k.key }, `Key ${k.key}`)}
          >
            <div style={{ width: 32, fontSize: 13, color: 'var(--text-dim)' }}>{k.key}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(k.count / maxKeyCount) * 100}%` }} />
            </div>
            <div style={{ width: 32, textAlign: 'right', fontSize: 13 }}>{k.count}</div>
          </button>
        ))}
      </div>

      <div className="section-title">Top artists</div>
      <div className="card">
        {stats.topArtistsBySongCount.map((a) => (
          <button
            key={a.artistId}
            className="clickable-row"
            style={{ justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}
            onClick={() => onNavigateToLibrary({ artistId: a.artistId }, a.artistName)}
          >
            <span>{a.artistName}</span>
            <span style={{ color: 'var(--text-dim)' }}>{a.count} songs</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RatingAvgCard({ label, value }: { label: string; value: number | null }): JSX.Element {
  return (
    <div className="card">
      <div className="stat-number">{value ? value.toFixed(1) : '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// --- Recommendations -------------------------------------------------------

interface RecommendationsPanelProps {
  songs: Song[];
  ratings: Rating[];
  onOpenSong: (songId: string, contextIds: string[]) => void;
  onNavigateToLibrary: (filterPatch: Partial<FilterState>, label?: string) => void;
}

function RecommendationsPanel({ songs, ratings, onOpenSong, onNavigateToLibrary }: RecommendationsPanelProps): JSX.Element {
  const keyReviews = useMemo(() => computeKeyReviewCandidates(songs, ratings), [songs, ratings]);
  const learnNext = useMemo(() => computeSongsToLearnNext(songs, ratings), [songs, ratings]);
  const rediscover = useMemo(() => computeRediscoverSongs(songs, ratings), [songs, ratings]);
  const promotion = useMemo(() => computeSongsReadyForPromotion(songs, ratings), [songs, ratings]);
  const practice = useMemo(() => computeSongsNeedingPractice(songs, ratings), [songs, ratings]);
  const gems = useMemo(() => computeHiddenGems(songs, ratings), [songs, ratings]);
  const recovery = useMemo(() => computeRecoverySongs(songs, ratings), [songs, ratings]);
  const highDemand = useMemo(() => computeHighDemandSongs(songs, ratings), [songs, ratings]);

  return (
    <div>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 0, marginBottom: 8 }}>
        Practical calls for your repertoire — what to revive, learn, promote, practise, or rest. Every list is
        built purely from your own ratings and play history.
      </p>

      <KeyReviewList candidates={keyReviews} onOpenSong={onOpenSong} />

      <SuggestionList
        title="Rediscover songs"
        blurb="Rated well and still suit your voice, but not played in a long time — bring them back."
        suggestions={rediscover}
        emptyText="Nothing to rediscover yet."
        onOpenSong={onOpenSong}
        onViewAll={onNavigateToLibrary ? (ids, label) => onNavigateToLibrary({ songIds: ids }, label) : undefined}
      />
      <SuggestionList
        title="Ready for promotion"
        blurb="Learning songs you now perform reliably — move them into rotation."
        suggestions={promotion}
        emptyText="No Learning songs are gig-ready yet."
        onOpenSong={onOpenSong}
        onViewAll={(ids, label) => onNavigateToLibrary({ songIds: ids }, label)}
      />
      <SuggestionList
        title="Needs practice"
        blurb="In rotation but reliability is lagging — the priority practice list."
        suggestions={practice}
        emptyText="Nothing in rotation is struggling. ✓"
        onOpenSong={onOpenSong}
        onViewAll={(ids, label) => onNavigateToLibrary({ songIds: ids }, label)}
      />
      <SuggestionList
        title="Songs to learn next"
        blurb="What you’re already learning, highest-enjoyment first."
        suggestions={learnNext}
        emptyText="No songs marked Learning."
        onOpenSong={onOpenSong}
        onViewAll={(ids, label) => onNavigateToLibrary({ songIds: ids }, label)}
      />
      <SuggestionList
        title="Hidden gems"
        blurb="Songs you enjoy and nail, but aren’t featuring enough — worth more airtime."
        suggestions={gems}
        emptyText="No hidden gems surfaced yet."
        onOpenSong={onOpenSong}
        onViewAll={(ids, label) => onNavigateToLibrary({ songIds: ids }, label)}
      />
      <SuggestionList
        title="Recovery songs"
        blurb="Reliable and easy on the voice — reach for these after something demanding."
        suggestions={recovery}
        emptyText="No recovery songs identified yet."
        onOpenSong={onOpenSong}
        onViewAll={(ids, label) => onNavigateToLibrary({ songIds: ids }, label)}
      />
      <SuggestionList
        title="High demand songs"
        blurb="Your Tough/Challenging numbers — space these out across a set."
        suggestions={highDemand}
        emptyText="No high-demand songs rated yet."
        onOpenSong={onOpenSong}
        onViewAll={(ids, label) => onNavigateToLibrary({ songIds: ids }, label)}
      />
    </div>
  );
}

// --- Library Health --------------------------------------------------------

function LibraryHealthPanel({ songs, artists, folders, ratings, onNavigateToLibrary }: RepertoirePanelProps): JSX.Element {
  const stats = useMemo(() => computeStats(songs, artists, folders, ratings), [songs, artists, folders, ratings]);
  const h = stats.metadataHealth;
  const rows: Array<{ label: string; ids: string[] }> = [
    { label: 'Missing Key', ids: h.missingKey.map((s) => s.songId) },
    { label: 'Missing BPM', ids: h.missingBpm.map((s) => s.songId) },
    { label: 'Missing artist', ids: h.missingArtist.map((s) => s.songId) },
    { label: 'Unknown folder', ids: h.noFolder.map((s) => s.songId) },
  ];
  const anyIssues = rows.some((r) => r.ids.length > 0) || h.duplicateTitles.length > 0;

  return (
    <div>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
        Gaps to fix in StageTraxx, then re-sync. Tap a row to open those songs in the Library.
      </p>
      <div className="card">
        {!anyIssues ? (
          <div style={{ fontSize: 14, color: 'var(--success)' }}>All clear — no metadata gaps. ✓</div>
        ) : (
          <>
            {rows.map((r) => (
              <button
                key={r.label}
                className="clickable-row"
                style={{ justifyContent: 'space-between', padding: '10px 0', fontSize: 14 }}
                disabled={r.ids.length === 0}
                onClick={() => r.ids.length > 0 && onNavigateToLibrary({ songIds: r.ids }, r.label)}
              >
                <span>{r.label}</span>
                <span style={{ color: r.ids.length ? 'var(--warning)' : 'var(--text-dim)' }}>{r.ids.length}</span>
              </button>
            ))}
            {h.duplicateTitles.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>Duplicate titles ({h.duplicateTitles.length})</div>
                {h.duplicateTitles.slice(0, 20).map((g) => (
                  <button
                    key={g.title}
                    className="clickable-row"
                    style={{ justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}
                    onClick={() => onNavigateToLibrary({ songIds: g.songIds }, `Duplicates of "${g.title}"`)}
                  >
                    <span style={{ color: 'var(--text-dim)' }}>{g.title}</span>
                    <span>{g.count}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
