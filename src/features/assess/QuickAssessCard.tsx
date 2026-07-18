import type { Song, Artist, RepertoireStatus } from '../../types/domain';

interface Props {
  song: Song;
  artist?: Artist;
  onAnswer: (status: RepertoireStatus) => void;
}

const OPTIONS: Array<{ status: RepertoireStatus; emoji: string; label: string }> = [
  { status: 'regular', emoji: '🎤', label: 'Regular' },
  { status: 'occasional', emoji: '🎵', label: 'Occasional' },
  { status: 'learning', emoji: '📚', label: 'Learning' },
  { status: 'unexplored', emoji: '🌱', label: 'Unexplored' },
];

/** Constitution Feature 1 — one question, one tap, auto-advance. */
export function QuickAssessCard({ song, artist, onAnswer }: Props): JSX.Element {
  return (
    <div>
      <div className="song-title" style={{ fontSize: 22, marginBottom: 4 }}>
        {song.title.trim() || 'Untitled'}
      </div>
      <div className="song-meta" style={{ fontSize: 15, marginBottom: 28 }}>
        {artist?.name ?? 'Unknown artist'}
        {song.keyNote ? ` · Key ${song.keyNote}` : ''}
      </div>

      <div className="section-title" style={{ marginTop: 0 }}>
        How often do you currently perform this song?
      </div>

      <div className="quick-assess-grid">
        {OPTIONS.map(({ status, emoji, label }) => (
          <button key={status} className="quick-assess-button" onClick={() => onAnswer(status)}>
            <span className="quick-assess-emoji">{emoji}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
