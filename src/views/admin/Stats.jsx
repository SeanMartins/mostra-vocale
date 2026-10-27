import React, { useMemo } from 'react';
import { formatDuration } from '../../lib/mostra';
import { recDate, dayKey } from '../../lib/dates';

function BarChart({ data, height = 160, label, format = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = [max, Math.round(max / 2), 0].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <figure className="chart" aria-label={label}>
      <div className="chart__plot" style={{ height }}>
        <div className="chart__grid" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ bottom: `${(t / max) * 100}%` }}>
              <em>{t}</em>
            </span>
          ))}
        </div>
        <div className="chart__bars">
          {data.map((d) => (
            <div key={d.key} className="chart__col" title={`${d.title || d.label}: ${format(d.value)}`}>
              <div className="chart__bar" style={{ height: `${(d.value / max) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="chart__labels" aria-hidden="true">
        {data.map((d) => (
          <span key={d.key}>{d.label}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}><th>{d.title || d.label}</th><td>{d.value}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export default function Stats({ recordings, loaded, opere }) {
  const s = useMemo(() => {
    const total = recordings.length;
    const durations = recordings.map((r) => r.duration || 0);
    const totalSec = durations.reduce((a, b) => a + b, 0);
    const withDur = durations.filter(Boolean).length;
    const transcribed = recordings.filter((r) => r.transcription).length;
    const mobile = recordings.filter((r) => r.source === 'mobile').length;
    const kiosk = recordings.filter((r) => r.source === 'kiosk').length;

    // per giorno: dal primo commento a oggi (max 31 giorni)
    const byDay = new Map();
    recordings.forEach((r) => {
      const k = dayKey(recDate(r));
      byDay.set(k, (byDay.get(k) || 0) + 1);
    });
    const days = [];
    if (total) {
      const first = recordings.reduce((m, r) => Math.min(m, recDate(r).getTime()), Date.now());
      const start = new Date(Math.max(first, Date.now() - 30 * 864e5));
      start.setHours(0, 0, 0, 0);
      for (let d = new Date(start); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const k = dayKey(d);
        days.push({
          key: k,
          value: byDay.get(k) || 0,
          label: String(d.getDate()),
          title: d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }),
        });
      }
    }

    const byHour = Array.from({ length: 24 }, (_, h) => ({ key: h, value: 0, label: h % 3 === 0 ? String(h) : '', title: `Ore ${h}:00–${h}:59` }));
    recordings.forEach((r) => {
      byHour[recDate(r).getHours()].value += 1;
    });
    const firstHour = byHour.findIndex((h) => h.value);
    const lastHour = 23 - [...byHour].reverse().findIndex((h) => h.value);
    const hours = firstHour === -1 ? [] : byHour.slice(Math.max(0, firstHour - 1), Math.min(24, lastHour + 2));

    const perOpera = opere.map((o) => {
      const recs = recordings.filter((r) => r.operaId === o.id);
      const sec = recs.reduce((a, r) => a + (r.duration || 0), 0);
      return { id: o.id, numero: o.numero, titolo: o.titolo, autore: o.autore, count: recs.length, avg: recs.length ? sec / recs.length : 0 };
    });
    const general = recordings.filter((r) => !r.operaId).length;
    perOpera.sort((a, b) => b.count - a.count);

    return { total, totalSec, avg: withDur ? totalSec / withDur : 0, transcribed, mobile, kiosk, days, hours, perOpera, general };
  }, [recordings, opere]);

  if (!loaded) return <p className="muted">Caricamento…</p>;
  if (!s.total) {
    return (
      <div className="empty">
        <h2>Le statistiche compaiono con i primi commenti</h2>
        <p className="muted">Qui vedrai quanti commenti arrivano ogni giorno, in quali ore e per quali opere.</p>
      </div>
    );
  }

  const maxOpera = Math.max(1, ...s.perOpera.map((o) => o.count), s.general);

  return (
    <section className="stats">
      <dl className="summary">
        <div><dt>Commenti</dt><dd>{s.total}</dd></div>
        <div><dt>Audio raccolto</dt><dd>{formatDuration(s.totalSec)}</dd></div>
        <div><dt>Durata media</dt><dd>{formatDuration(s.avg)}</dd></div>
        <div><dt>Trascritti</dt><dd>{s.transcribed} <small>di {s.total}</small></dd></div>
        <div><dt>Da telefono (QR)</dt><dd>{s.mobile} <small>postazione {s.kiosk}</small></dd></div>
      </dl>

      <div className="stats__grid">
        <section className="panel">
          <h2>Commenti per giorno</h2>
          <BarChart data={s.days} label="Commenti per giorno" />
        </section>
        <section className="panel">
          <h2>Ore di maggiore partecipazione</h2>
          <BarChart data={s.hours.map((h) => ({ ...h, label: String(h.key) }))} label="Commenti per ora del giorno" />
        </section>
      </div>

      <section className="panel">
        <h2>Per opera</h2>
        {!s.perOpera.length ? (
          <p className="muted">Aggiungi le opere nella sezione “Opere e QR” per vedere i commenti di ciascuna.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Opera</th>
                <th scope="col" className="num">Commenti</th>
                <th scope="col" className="num">Durata media</th>
                <th scope="col" className="table__barcol"><span className="sr-only">Proporzione</span></th>
              </tr>
            </thead>
            <tbody>
              {s.perOpera.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.numero ? `${o.numero}. ` : ''}{o.titolo}</strong>
                    {o.autore && <span className="muted"> · {o.autore}</span>}
                  </td>
                  <td className="num">{o.count}</td>
                  <td className="num">{o.count ? formatDuration(o.avg) : '—'}</td>
                  <td className="table__barcol"><div className="hbar"><div style={{ width: `${(o.count / maxOpera) * 100}%` }} /></div></td>
                </tr>
              ))}
              <tr className="table__muted">
                <td>Postazione generale</td>
                <td className="num">{s.general}</td>
                <td className="num">—</td>
                <td className="table__barcol"><div className="hbar"><div style={{ width: `${(s.general / maxOpera) * 100}%` }} /></div></td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
