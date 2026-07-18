import type { AssessMetric } from '../../types/domain';
import { ASSESS_METRICS, assessMetricLabel } from '../../types/domain';

interface Props {
  selected: Set<AssessMetric>;
  onChange: (next: Set<AssessMetric>) => void;
}

/** Checkbox row choosing which metrics the Assess walk collects (Version 3 — no forced order or set). */
export function MetricToggles({ selected, onChange }: Props): JSX.Element {
  function toggle(metric: AssessMetric): void {
    const next = new Set(selected);
    if (next.has(metric)) next.delete(metric);
    else next.add(metric);
    onChange(next);
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {ASSESS_METRICS.map((metric) => (
        <button
          key={metric}
          className={`tag-chip ${selected.has(metric) ? 'tag-chip-assigned' : ''}`}
          onClick={() => toggle(metric)}
        >
          {selected.has(metric) ? '☑ ' : '☐ '}
          {assessMetricLabel(metric)}
        </button>
      ))}
    </div>
  );
}
