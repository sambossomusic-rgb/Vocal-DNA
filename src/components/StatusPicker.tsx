import type { RepertoireStatus } from '../types/domain';
import { REPERTOIRE_STATUSES, REPERTOIRE_STATUS_LABELS } from '../types/domain';

interface Props {
  value: RepertoireStatus;
  onChange: (status: RepertoireStatus) => void;
}

/** One-tap picker for the four repertoire statuses — same visual pattern as Quick Assessment. */
export function StatusPicker({ value, onChange }: Props): JSX.Element {
  return (
    <div className="quick-assess-grid" style={{ marginBottom: 18 }}>
      {REPERTOIRE_STATUSES.map((status) => (
        <button
          key={status}
          className={`quick-assess-button ${status === value ? 'quick-assess-button-selected' : ''}`}
          onClick={() => onChange(status)}
          style={{ minHeight: 64, flexDirection: 'row', fontSize: 15 }}
        >
          {REPERTOIRE_STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  );
}
