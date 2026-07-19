import type { KeyReviewCandidate } from '../../analytics/recommendationEngine';
import { VOCAL_EFFICIENCY_REVIEW_TITLE } from '../../analytics/recommendationEngine';

interface Props {
  candidates: KeyReviewCandidate[];
  onOpenSong: (songId: string, contextIds: string[]) => void;
}

function stars(confidence: number): string {
  return '★'.repeat(confidence) + '☆'.repeat(5 - confidence);
}

/**
 * The Vocal Efficiency Review list (V5 item 12). Not automatic key changes and
 * never "you're singing it wrong" — a supportive, ranked list of songs worth
 * experimenting with, with the performer's own data as the reason.
 */
export function KeyReviewList({ candidates, onOpenSong }: Props): JSX.Element {
  const ids = candidates.map((c) => c.songId);

  return (
    <>
      <div className="section-title" style={{ marginTop: 0 }}>
        {VOCAL_EFFICIENCY_REVIEW_TITLE} {candidates.length > 0 && `(${candidates.length})`}
      </div>
      <div className="card">
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 0 }}>
          Songs where a different key might sit more comfortably — supportive experiments to try, ranked by
          vocal demand, reliability, and fatigue. Nothing changes automatically.
        </p>
        {candidates.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--success)' }}>
            Nothing flagged — your active keys look comfortable. ✓
          </div>
        ) : (
          candidates.slice(0, 25).map((rec) => (
            <button
              key={rec.songId}
              className="clickable-row"
              style={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 2,
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
              }}
              onClick={() => onOpenSong(rec.songId, ids)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>{rec.title.trim() || 'Untitled'}</span>
                <span>
                  {rec.currentKey}
                  {rec.suggestedTestKey && rec.suggestedTestKey !== rec.currentKey ? (
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
          ))
        )}
      </div>
    </>
  );
}
