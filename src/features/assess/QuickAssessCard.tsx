import type { Song, Artist, PerformanceFrequency } from '../../types/domain';

interface Props {
  song: Song;
  artist?: Artist;
  onAnswer: (frequency: PerformanceFrequency) => void;
}

const OPTIONS: Array<{ frequency: PerformanceFrequency; emoji: string; label: string }> = [
  { frequency: 'regular', emoji: '🎤', label: 'Regular' },
  { frequency: 'occasional', emoji: '🎵', label: 'Occasional' },
  { frequency: 'learning', emoji: '📚', label: 'Learning' },
  { frequency: 'never', emoji: '🚫', label: 'Never' },
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
        {OPTIONS.map(({ frequency, emoji, label }) => (
          <button
            key={frequency}
            className="quick-assess-button"
            onClick={() => onAnswer(frequency)}
          >
            <span className="quick-assess-emoji">{emoji}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
