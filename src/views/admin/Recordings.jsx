import React, { useEffect, useMemo, useRef, useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { formatDuration } from '../../lib/mostra';
import { recDate, dayKey, dayLabel, timeLabel } from '../../lib/dates';
import { transcribeRecording } from '../../lib/transcribe';
import { extensionFor, getAllLocalRecordings } from '../../lib/localDB';
import { syncPending } from '../../lib/uploads';
import { PeaksWaveform } from '../../components/Waveform';
import Icon from '../../components/Icon';

const PERIODS = [
  { id: 'all', label: 'Sempre' },
  { id: 'today', label: 'Oggi' },
  { id: '7d', label: 'Ultimi 7 giorni' },
];

function csvCell(v) {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fileNameFor(rec, opereById) {
  const d = recDate(rec);
  const stamp = `${dayKey(d)}_${timeLabel(d).replace(':', '-')}`;
  const opera = opereById[rec.operaId]?.titolo;
  const slug = opera ? `_${opera.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}` : '';
  return `commento_${stamp}${slug}.${extensionFor(rec.mimeType)}`;
}

export default function Recordings({ recordings, loaded, opere }) {
  const [search, setSearch] = useState('');
  const [operaFilter, setOperaFilter] = useState('all');
  const [period, setPeriod] = useState('all');
  const [playing, setPlaying] = useState(null);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [working, setWorking] = useState({}); // id -> 'transcribe' | 'delete'
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [bulk, setBulk] = useState(null); // { done, total }
  const [notice, setNotice] = useState(null);
  const [pendingLocal, setPendingLocal] = useState(0);
  const audioRef = useRef(null);

  const opereById = useMemo(() => Object.fromEntries(opere.map((o) => [o.id, o])), [opere]);

  useEffect(() => {
    getAllLocalRecordings().then((all) => setPendingLocal(all.filter((r) => !r.uploadedToFirebase).length));
  }, [recordings.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    return recordings.filter((r) => {
      if (operaFilter === 'none' && r.operaId) return false;
      if (operaFilter !== 'all' && operaFilter !== 'none' && r.operaId !== operaFilter) return false;
      const d = recDate(r);
      if (period === 'today' && dayKey(d) !== dayKey(now)) return false;
      if (period === '7d' && now - d > 7 * 864e5) return false;
      if (q && !(r.transcription || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [recordings, search, operaFilter, period]);

  const groups = useMemo(() => {
    const out = [];
    filtered.forEach((r) => {
      const d = recDate(r);
      const k = dayKey(d);
      if (!out.length || out[out.length - 1].key !== k) out.push({ key: k, label: dayLabel(d), items: [] });
      out[out.length - 1].items.push(r);
    });
    return out;
  }, [filtered]);

  const untranscribed = filtered.filter((r) => !r.transcription);

  // ---- player
  const play = (rec) => {
    const a = audioRef.current;
    if (!a) return;
    if (playing === rec.id) {
      if (a.paused) a.play();
      else a.pause();
      return;
    }
    a.src = rec.downloadURL;
    setProgress(0);
    setPlaying(rec.id);
    a.play().catch(() => setNotice({ tone: 'error', text: 'Questo file non si può riprodurre nel browser. Scaricalo per ascoltarlo.' }));
  };
  const seek = (rec, p) => {
    const a = audioRef.current;
    if (playing !== rec.id) {
      play(rec);
      a.addEventListener('loadedmetadata', () => { a.currentTime = p * (a.duration || rec.duration || 0); }, { once: true });
      return;
    }
    if (a.duration) a.currentTime = p * a.duration;
  };
  // ---- azioni
  const transcribe = async (rec) => {
    setWorking((w) => ({ ...w, [rec.id]: 'transcribe' }));
    try {
      await transcribeRecording(rec);
      setExpanded((e) => ({ ...e, [rec.id]: true }));
    } catch (err) {
      setNotice({ tone: 'error', text: `Trascrizione non riuscita: ${err.message}` });
    }
    setWorking((w) => ({ ...w, [rec.id]: undefined }));
  };

  const transcribeAll = async () => {
    const list = [...untranscribed];
    setBulk({ done: 0, total: list.length });
    let failed = 0;
    for (let i = 0; i < list.length; i++) {
      try {
        await transcribeRecording(list[i]);
      } catch {
        failed += 1;
      }
      setBulk({ done: i + 1, total: list.length });
    }
    setBulk(null);
    setNotice(
      failed
        ? { tone: 'error', text: `${list.length - failed} trascritti, ${failed} non riusciti. Puoi riprovare.` }
        : { tone: 'ok', text: `${list.length} commenti trascritti.` }
    );
  };

  const remove = async (rec) => {
    setConfirmDelete(null);
    setWorking((w) => ({ ...w, [rec.id]: 'delete' }));
    try {
      if (playing === rec.id) audioRef.current?.pause();
      await deleteObject(ref(storage, rec.fileName)).catch((e) => {
        if (e.code !== 'storage/object-not-found') throw e;
      });
      await deleteDoc(doc(db, 'vocali', rec.id));
    } catch (err) {
      setNotice({ tone: 'error', text: 'Eliminazione non riuscita. Controlla la connessione e riprova.' });
      setWorking((w) => ({ ...w, [rec.id]: undefined }));
    }
  };

  const download = async (rec) => {
    try {
      const res = await fetch(rec.downloadURL);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileNameFor(rec, opereById);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      window.open(rec.downloadURL, '_blank', 'noopener');
    }
  };

  const downloadAll = async () => {
    setBulk({ done: 0, total: filtered.length, label: 'Download' });
    for (let i = 0; i < filtered.length; i++) {
      await download(filtered[i]);
      setBulk({ done: i + 1, total: filtered.length, label: 'Download' });
      await new Promise((r) => setTimeout(r, 350));
    }
    setBulk(null);
  };

  const exportCsv = () => {
    const head = ['Data', 'Ora', 'Durata (s)', 'Opera', 'Autore', 'Postazione', 'Trascrizione', 'File'];
    const rows = filtered.map((r) => {
      const d = recDate(r);
      const o = opereById[r.operaId];
      return [
        d.toLocaleDateString('it-IT'),
        timeLabel(d),
        r.duration ?? '',
        o?.titolo || '',
        o?.autore || '',
        r.source === 'mobile' ? 'Telefono' : r.source === 'kiosk' ? 'Postazione' : '',
        r.transcription || '',
        r.downloadURL,
      ];
    });
    const csv = '﻿' + [head, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `commenti_${dayKey(new Date())}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const sendLocal = async () => {
    const n = await syncPending();
    const left = (await getAllLocalRecordings()).filter((r) => !r.uploadedToFirebase).length;
    setPendingLocal(left);
    setNotice(left ? { tone: 'error', text: `Inviati ${n}. Ne restano ${left}: controlla la connessione.` } : { tone: 'ok', text: `Inviati ${n} commenti salvati sul dispositivo.` });
  };

  const filtersActive = search || operaFilter !== 'all' || period !== 'all';

  return (
    <section className="recordings">
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onEnded={() => {
          setPaused(true);
          setProgress(1);
        }}
        preload="none"
      />

      {pendingLocal > 0 && (
        <div className="banner">
          <Icon name="cloudOff" />
          <span>
            Su questo dispositivo {pendingLocal === 1 ? 'c’è 1 commento non ancora inviato' : `ci sono ${pendingLocal} commenti non ancora inviati`}.
          </span>
          <button className="btn btn--small" onClick={sendLocal}>Invia ora</button>
        </div>
      )}

      {notice && (
        <div className={`banner banner--${notice.tone}`} role="status">
          <span>{notice.text}</span>
          <button className="btn btn--icon btn--small" onClick={() => setNotice(null)} aria-label="Chiudi">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <input
            type="search"
            placeholder="Cerca nelle trascrizioni"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cerca nelle trascrizioni"
          />
        </label>
        <select value={operaFilter} onChange={(e) => setOperaFilter(e.target.value)} aria-label="Filtra per opera">
          <option value="all">Tutte le opere</option>
          <option value="none">Postazione generale</option>
          {opere.map((o) => (
            <option key={o.id} value={o.id}>
              {o.numero ? `${o.numero}. ` : ''}{o.titolo}
            </option>
          ))}
        </select>
        <div className="segmented" role="group" aria-label="Periodo">
          {PERIODS.map((p) => (
            <button key={p.id} className={period === p.id ? 'is-active' : ''} onClick={() => setPeriod(p.id)} aria-pressed={period === p.id}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="toolbar__actions">
          <button className="btn" onClick={transcribeAll} disabled={!untranscribed.length || !!bulk} title="Circa 0,006 $ al minuto di audio (OpenAI Whisper)">
            <Icon name="text" size={16} />
            Trascrivi {untranscribed.length ? `(${untranscribed.length})` : ''}
          </button>
          <button className="btn" onClick={exportCsv} disabled={!filtered.length}>
            <Icon name="table" size={16} />
            Esporta CSV
          </button>
          <button className="btn" onClick={downloadAll} disabled={!filtered.length || !!bulk}>
            <Icon name="download" size={16} />
            Scarica audio
          </button>
        </div>
      </div>

      {bulk && (
        <div className="progress" role="progressbar" aria-valuenow={bulk.done} aria-valuemax={bulk.total}>
          <span>{bulk.label || 'Trascrizione'} {bulk.done} di {bulk.total}</span>
          <div className="progress__bar"><div style={{ width: `${(bulk.done / bulk.total) * 100}%` }} /></div>
        </div>
      )}

      {recordings.length > 0 && <p className="result-count muted">
        {loaded ? `${filtered.length} ${filtered.length === 1 ? 'commento' : 'commenti'}${filtersActive ? ' con questi filtri' : ''}` : 'Caricamento…'}
        {filtersActive && (
          <button className="btn btn--link" onClick={() => { setSearch(''); setOperaFilter('all'); setPeriod('all'); }}>
            Azzera filtri
          </button>
        )}
      </p>}

      {loaded && !recordings.length && (
        <div className="empty">
          <Icon name="mic" size={28} />
          <h2>Ancora nessun commento</h2>
          <p className="muted">Quando un visitatore registra un commento dalla postazione o dal QR di un’opera, compare qui in tempo reale.</p>
        </div>
      )}
      {loaded && recordings.length > 0 && !filtered.length && (
        <div className="empty">
          <h2>Nessun commento con questi filtri</h2>
          <p className="muted">Prova a cambiare opera, periodo o testo cercato.</p>
        </div>
      )}

      {groups.map((g) => (
        <div className="day" key={g.key}>
          <h2 className="day__head">
            {g.label} <span className="muted">{g.items.length} {g.items.length === 1 ? 'commento' : 'commenti'}</span>
          </h2>
          <ul className="rec-list">
            {g.items.map((r) => {
              const d = recDate(r);
              const o = opereById[r.operaId];
              const isCurrent = playing === r.id;
              const busy = working[r.id];
              const open = expanded[r.id];
              return (
                <li key={r.id} className={`rec ${isCurrent ? 'is-current' : ''} ${busy === 'delete' ? 'is-removing' : ''}`}>
                  <button
                    className="rec__play"
                    onClick={() => play(r)}
                    aria-label={isCurrent && !paused ? 'Pausa' : `Ascolta il commento delle ${timeLabel(d)}`}
                  >
                    <Icon name={isCurrent && !paused ? 'pause' : 'play'} size={16} />
                  </button>
                  <div className="rec__wave">
                    <PeaksWaveform
                      peaks={r.peaks}
                      progress={isCurrent ? progress : 0}
                      onSeek={(p) => seek(r, p)}
                      label={`Posizione nel commento delle ${timeLabel(d)}`}
                    />
                  </div>
                  <div className="rec__meta">
                    <span className="rec__time">{timeLabel(d)}</span>
                    <span className="rec__dur">{r.duration ? formatDuration(r.duration) : '—'}</span>
                  </div>
                  <div className="rec__context">
                    <span className="rec__opera">{o ? o.titolo : r.operaId ? 'Opera eliminata' : 'Postazione generale'}</span>
                    {r.source && <span className="tag">{r.source === 'mobile' ? 'Telefono' : 'Postazione'}</span>}
                  </div>
                  <div className="rec__actions">
                    {!r.transcription && (
                      <button className="btn btn--icon" onClick={() => transcribe(r)} disabled={!!busy} title="Trascrivi" aria-label="Trascrivi">
                        {busy === 'transcribe' ? <span className="spinner" /> : <Icon name="text" />}
                      </button>
                    )}
                    <button className="btn btn--icon" onClick={() => download(r)} title="Scarica" aria-label="Scarica">
                      <Icon name="download" />
                    </button>
                    {confirmDelete === r.id ? (
                      <span className="confirm">
                        <button className="btn btn--small btn--danger" onClick={() => remove(r)}>Elimina</button>
                        <button className="btn btn--small" onClick={() => setConfirmDelete(null)}>Annulla</button>
                      </span>
                    ) : (
                      <button className="btn btn--icon" onClick={() => setConfirmDelete(r.id)} disabled={!!busy} title="Elimina" aria-label="Elimina">
                        <Icon name="trash" />
                      </button>
                    )}
                  </div>
                  {r.transcription && (
                    <button className={`rec__text ${open ? 'is-open' : ''}`} onClick={() => setExpanded((e) => ({ ...e, [r.id]: !open }))} aria-expanded={!!open}>
                      {r.transcription}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
