import { useState } from 'react';
import type { Song, Artist, Rating, AssessMetric, RatingValue, RepertoireStatus } from '../../types/domain';
import { metricLabel } from '../../types/domain';
import type { SongPrediction } from '../../analytics/predictionEngine';
import { ScaleButtonGrid } from '../../components/ScaleButtonGrid';
import { StatusPicker } from '../../components/StatusPicker';

export interface AssessPatch {
  status?: RepertoireStatus;
  demand?: RatingValue;
  reliability?: RatingValue;
  enjoyment?: RatingValue;
  fatigue?: RatingValue;
  isInstrumental: boolean;
}

interface Props {
  song: Song;
  artist?: Artist;
  rating?: Rating;
  metrics: Set<AssessMetric>;
  prediction: SongPrediction | null;
  index: number; // 0-based position in the assess queue
  total: number;
  onCommit: (patch: AssessPatch, delta: number) => void;
}

const MID: RatingValue = 3;

/**
 * One song's assessment card. Shows controls for only the selected metrics
 * (Version 3 — assess one metric or all), with vocal/instrumental-aware
 * labels, prefilled from any existing rating (or the statistical prediction
 * for demand/reliability). Save & Next / Previous walk the filtered queue.
 */
export function AssessCard({ song, artist, rating, metrics, prediction, index, total, onCommit }: Props): JSX.Element {
  const [status, setStatus] = useState<RepertoireStatus>(rating?.status ?? 'unexplored');
  const [demand, setDemand] = useState<RatingValue>(rating?.demand ?? prediction?.predictedDemand ?? MID);
  const [reliability, setReliability] = useState<RatingValue>(
    rating?.reliability ?? prediction?.predictedReliability ?? MID
  );
  const [enjoyment, setEnjoyment] = useState<RatingValue>(rating?.enjoyment ?? MID);
  const [fatigue, setFatigue] = useState<RatingValue>(rating?.fatigue ?? MID);
  const [isInstrumental, setIsInstrumental] = useState<boolean>(song.isInstrumental ?? false);

  function buildPatch(): AssessPatch {
    const patch: AssessPatch = { isInstrumental };
    if (metrics.has('status')) patch.status = status;
    if (metrics.has('demand')) patch.demand = demand;
    if (metrics.has('reliability')) patch.reliability = reliability;
    if (metrics.has('enjoyment')) patch.enjoyment = enjoyment;
    if (metrics.has('fatigue')) patch.fatigue = fatigue;
    return patch;
  }

  const isLast = index >= total - 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div className="song-title" style={{ fontSize: 22 }}>{song.title.trim() || 'Untitled'}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          {index + 1} of {total}
        </div>
      </div>
      <div className="song-meta" style={{ fontSize: 15, marginBottom: 14 }}>
        {artist?.name ?? 'Unknown artist'}
        {song.keyNote ? ` · Key ${song.keyNote}` : ''}
      </div>

      <button
        className={`tag-chip ${isInstrumental ? 'tag-chip-assigned' : ''}`}
        style={{ marginBottom: 16 }}
        onClick={() => setIsInstrumental((v) => !v)}
      >
        {isInstrumental ? '🎸 Instrumental' : '🎤 Vocal'}
      </button>

      {metrics.has('status') && (
        <>
          <div className="section-title" style={{ marginTop: 0 }}>
            Status
          </div>
          <StatusPicker value={status} onChange={setStatus} />
        </>
      )}

      {prediction !== null && prediction.sampleSize > 0 && (metrics.has('demand') || metrics.has('reliability')) && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
          Demand / Reliability predicted from {prediction.sampleSize} previous rating
          {prediction.sampleSize === 1 ? '' : 's'} — adjust or just save.
        </div>
      )}

      {metrics.has('demand') && (
        <ScaleButtonGrid label={metricLabel('demand', isInstrumental)} value={demand} onChange={setDemand} />
      )}
      {metrics.has('reliability') && (
        <ScaleButtonGrid label={metricLabel('reliability', isInstrumental)} value={reliability} onChange={setReliability} />
      )}
      {metrics.has('enjoyment') && (
        <ScaleButtonGrid label={metricLabel('enjoyment', isInstrumental)} value={enjoyment} onChange={setEnjoyment} />
      )}
      {metrics.has('fatigue') && (
        <ScaleButtonGrid label={metricLabel('fatigue', isInstrumental)} value={fatigue} onChange={setFatigue} />
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          className="button-secondary"
          disabled={index === 0}
          onClick={() => onCommit(buildPatch(), -1)}
        >
          ◀ Previous
        </button>
        <button className="button-primary" style={{ flex: 1 }} onClick={() => onCommit(buildPatch(), 1)}>
          {isLast ? 'Save & Finish' : 'Save & Next ▶'}
        </button>
      </div>
    </div>
  );
}
