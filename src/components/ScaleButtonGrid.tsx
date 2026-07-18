interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

/** A row of large 1-tap buttons (1..max) replacing sliders — faster and more accurate on iPad. */
export function ScaleButtonGrid({ label, value, onChange, max = 10 }: Props): JSX.Element {
  const options = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontSize: 14, color: 'var(--text-dim)' }}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{value}</span>
      </div>
      <div className="scale-button-grid">
        {options.map((n) => (
          <button
            key={n}
            className={`scale-button ${n === value ? 'scale-button-selected' : ''}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
