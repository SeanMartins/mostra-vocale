import React from 'react';

/**
 * Forma d'onda a barre.
 * - live: le barre scorrono da destra verso sinistra fino alla linea di riproduzione (stile Memo Vocali)
 * - statica: i picchi della registrazione, con la parte già ascoltata evidenziata (progress 0–1)
 */
export function LiveWaveform({ levels, bars = 72, className }) {
  const slice = levels.slice(-bars);
  const pad = Array(Math.max(0, bars - slice.length)).fill(0);
  const values = [...pad, ...slice];
  return (
    <div className={`live-wave ${className || ''}`} aria-hidden="true">
      <div className="live-wave__bars">
        {values.map((v, i) => (
          <span key={i} style={{ height: `${Math.max(4, v)}%` }} className={v ? 'is-on' : ''} />
        ))}
      </div>
      <div className="live-wave__head" />
    </div>
  );
}

export function PeaksWaveform({ peaks, progress = 0, onSeek, label }) {
  const values = peaks && peaks.length ? peaks : Array(48).fill(8);
  const handle = (e) => {
    if (!onSeek) return;
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };
  const keys = (e) => {
    if (!onSeek) return;
    if (e.key === 'ArrowRight') onSeek(Math.min(1, progress + 0.05));
    if (e.key === 'ArrowLeft') onSeek(Math.max(0, progress - 0.05));
  };
  return (
    <div
      className="peaks"
      onClick={handle}
      onKeyDown={keys}
      role={onSeek ? 'slider' : undefined}
      tabIndex={onSeek ? 0 : undefined}
      aria-label={label}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
    >
      {values.map((v, i) => (
        <span
          key={i}
          className={i / values.length < progress ? 'is-played' : ''}
          style={{ height: `${Math.max(10, v)}%` }}
        />
      ))}
    </div>
  );
}
