import type { SongSuggestion } from '../../analytics/recommendationEngine';

interface Props {
  title: string;
  blurb: string;
  suggestions: SongSuggestion[];
  emptyText: string;
  onOpenSong: (songId: string, contextIds: string[]) => void;
  onViewAll?: (songIds: string[], label: string) => void;
}

/**
 * One recommendation list on the Recommendations screen (V5 item 5). Every row
 * opens the song; an optional "View all in Library" surfaces the full filtered
 * set. Kept deliberately uniform so the whole screen reads consistently.
 */
export function SuggestionList({
  title,
  blurb,
  suggestions,
  emptyText,
  onOpenSong,
  onViewAll,
}: Props): JSX.Element {
  const ids = suggestions.map((s) => s.songId);

  return (
    <>
      <div
        className="section-title"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <span>
          {title} {suggestions.length > 0 && `(${suggestions.length})`}
        </span>
        {onViewAll && ids.length > 0 && (
          <button
            className="button-secondary"
            style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
            onClick={() => onViewAll(ids, title)}
          >
            View all
          </button>
        )}
      </div>
      <div className="card">
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 0, marginBottom: suggestions.length ? 10 : 0 }}>
          {blurb}
        </p>
        {suggestions.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{emptyText}</div>
        ) : (
          suggestions.slice(0, 12).map((s) => (
            <button
              key={s.songId}
              className="clickable-row"
              style={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 2,
                padding: '9px 0',
                borderBottom: '1px solid var(--border)',
              }}
              onClick={() => onOpenSong(s.songId, ids)}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>{s.title.trim() || 'Untitled'}</span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{s.reason}</span>
            </button>
          ))
        )}
        {suggestions.length > 12 && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', paddingTop: 8 }}>
            +{suggestions.length - 12} more — tap View all.
          </div>
        )}
      </div>
    </>
  );
}
