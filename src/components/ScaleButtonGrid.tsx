import type { RatingValue } from '../types/domain';
import { RATING_SCALE, RATING_SCALE_LABELS } from '../types/domain';

interface Props {
  label: string;
  value: RatingValue | null;
  onChange: (value: RatingValue) => void;
}

/** Five large 1-tap buttons (Constitution Priority 1) — replaces sliders/1-10 grids everywhere a rating is entered. */
export function ScaleButtonGrid({ label, value, onChange }: Props): JSX.Element {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontSize: 14, color: 'var(--text-dim)' }}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{value !== null ? RATING_SCALE_LABELS[value] : '—'}</span>
      </div>
      <div className="scale-button-grid">
        {RATING_SCALE.map((n) => (
          <button
            key={n}
            className={`scale-button ${n === value ? 'scale-button-selected' : ''}`}
            onClick={() => onChange(n)}
          >
            <span className="scale-button-number">{n}</span>
            <span className="scale-button-label">{RATING_SCALE_LABELS[n]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
