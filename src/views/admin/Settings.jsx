import React, { useEffect, useState } from 'react';
import { setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';
import { MOSTRA_DOC, DEFAULT_ACCENT, onColor } from '../../lib/mostra';

const DURATIONS = [30, 60, 90];

export default function Settings({ mostra }) {
  const [v, setV] = useState(mostra);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(mostra.immagineUrl);
  const [state, setState] = useState(''); // '' | saving | saved | error
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setV(mostra);
      setPreview(mostra.immagineUrl);
    }
  }, [mostra, dirty]);

  useEffect(() => {
    if (!file) return undefined;
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const set = (k) => (e) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    setDirty(true);
    setState('');
  };

  const save = async (e) => {
    e.preventDefault();
    setState('saving');
    try {
      let immagineUrl = v.immagineUrl;
      if (file) {
        const r = ref(storage, `impostazioni/immagine-${Date.now()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`);
        await uploadBytes(r, file, { contentType: file.type });
        immagineUrl = await getDownloadURL(r);
      }
      await setDoc(
        MOSTRA_DOC(),
        {
          titolo: v.titolo.trim() || 'Mostra',
          sottotitolo: (v.sottotitolo || '').trim(),
          date: (v.date || '').trim(),
          luogo: (v.luogo || '').trim(),
          immagineUrl,
          accento: v.accento || DEFAULT_ACCENT,
          durataMax: Number(v.durataMax) || 60,
        },
        { merge: true }
      );
      setFile(null);
      setDirty(false);
      setState('saved');
    } catch (err) {
      setState('error');
    }
  };

  const accent = v.accento || DEFAULT_ACCENT;

  return (
    <section className="settings">
      <div className="section-head">
        <div>
          <h1>Impostazioni della mostra</h1>
          <p className="muted">Nome, immagine e colore compaiono sulla postazione e sui telefoni dei visitatori.</p>
        </div>
      </div>

      <div className="settings__grid">
        <form className="panel form" onSubmit={save}>
          <label className="field">
            <span>Titolo della mostra</span>
            <input value={v.titolo} onChange={set('titolo')} required />
          </label>
          <label className="field">
            <span>Sottotitolo <em>facoltativo</em></span>
            <input value={v.sottotitolo || ''} onChange={set('sottotitolo')} />
          </label>
          <div className="form__row">
            <label className="field">
              <span>Date <em>es. 12 ottobre – 30 novembre 2026</em></span>
              <input value={v.date || ''} onChange={set('date')} />
            </label>
            <label className="field">
              <span>Luogo <em>facoltativo</em></span>
              <input value={v.luogo || ''} onChange={set('luogo')} />
            </label>
          </div>

          <div className="field">
            <span>Immagine della mostra</span>
            <div className="file-row">
              <label className="btn">
                Scegli immagine…
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setDirty(true);
                    setState('');
                  }}
                />
              </label>
              <span className="muted">{file ? file.name : 'Locandina o opera principale, in verticale o orizzontale.'}</span>
            </div>
          </div>

          <div className="form__row">
            <label className="field">
              <span>Colore della mostra</span>
              <span className="color-row">
                <input type="color" value={accent} onChange={set('accento')} aria-label="Colore della mostra" />
                <input value={accent} onChange={set('accento')} className="mono" maxLength={7} aria-label="Codice colore" />
              </span>
            </label>
            <label className="field">
              <span>Durata massima del commento</span>
              <select value={v.durataMax || 60} onChange={set('durataMax')}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>{d} secondi</option>
                ))}
              </select>
            </label>
          </div>

          <div className="form__footer">
            <button className="btn btn--primary" disabled={state === 'saving' || !dirty}>
              {state === 'saving' ? 'Salvataggio…' : 'Salva modifiche'}
            </button>
            {state === 'saved' && <span className="form-info" role="status">Salvato. La postazione si aggiorna da sola.</span>}
            {state === 'error' && <span className="form-error" role="alert">Salvataggio non riuscito. Controlla i permessi e la connessione.</span>}
          </div>
        </form>

        <aside className="device-preview" aria-label="Anteprima della postazione" style={{ '--accent': accent, '--on-accent': onColor(accent) }}>
          <div className="device-preview__screen">
            {preview ? <img src={preview} alt="" /> : <div className="device-preview__empty" />}
            <div className="device-preview__panel">
              <strong>{v.titolo || 'Mostra'}</strong>
              <span>{[v.sottotitolo, v.date].filter(Boolean).join(' · ')}</span>
              <i className="device-preview__button" />
            </div>
          </div>
          <p className="muted">Anteprima della postazione</p>
        </aside>
      </div>
    </section>
  );
}
