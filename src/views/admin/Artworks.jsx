import React, { useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import Icon from '../../components/Icon';
import QrCode from '../../components/QrCode';

const EMPTY = { numero: '', titolo: '', autore: '', anno: '' };

export const operaUrl = (id) => `${window.location.origin}/opera/${id}`;
export const kioskUrl = () => `${window.location.origin}/?kiosk`;

function ArtworkForm({ initial, onSave, onCancel, saving }) {
  const [v, setV] = useState({ ...EMPTY, ...initial });
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="art-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.titolo.trim()) onSave(v);
      }}
    >
      <label className="field field--narrow">
        <span>N.</span>
        <input inputMode="numeric" value={v.numero} onChange={set('numero')} />
      </label>
      <label className="field field--grow">
        <span>Titolo</span>
        <input value={v.titolo} onChange={set('titolo')} required autoFocus />
      </label>
      <label className="field">
        <span>Autore</span>
        <input value={v.autore} onChange={set('autore')} />
      </label>
      <label className="field field--narrow">
        <span>Anno</span>
        <input value={v.anno} onChange={set('anno')} />
      </label>
      <div className="art-form__actions">
        <button className="btn btn--primary" disabled={saving || !v.titolo.trim()}>{saving ? 'Salvataggio…' : 'Salva'}</button>
        <button type="button" className="btn" onClick={onCancel}>Annulla</button>
      </div>
    </form>
  );
}

export default function Artworks({ opere, recordings, mostra }) {
  const [editing, setEditing] = useState(null); // id | 'new' | null
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const counts = useMemo(() => {
    const c = {};
    recordings.forEach((r) => {
      if (r.operaId) c[r.operaId] = (c[r.operaId] || 0) + 1;
    });
    return c;
  }, [recordings]);

  const save = async (v, id) => {
    setSaving(true);
    setError('');
    const data = {
      numero: v.numero === '' ? opere.length + 1 : Number(v.numero) || 0,
      titolo: v.titolo.trim(),
      autore: v.autore.trim(),
      anno: String(v.anno).trim(),
    };
    try {
      if (id) await updateDoc(doc(db, 'opere', id), data);
      else await addDoc(collection(db, 'opere'), data);
      setEditing(null);
    } catch {
      setError('Salvataggio non riuscito. Controlla di avere i permessi e la connessione.');
    }
    setSaving(false);
  };

  const remove = async (o) => {
    setConfirm(null);
    try {
      await deleteDoc(doc(db, 'opere', o.id));
    } catch {
      setError('Eliminazione non riuscita.');
    }
  };

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      window.prompt('Copia il link:', text);
    }
  };

  return (
    <section className="artworks">
      <div className="section-head">
        <div>
          <h1>Opere e codici QR</h1>
          <p className="muted">Ogni opera ha un codice QR: chi lo inquadra registra un commento collegato a quell’opera.</p>
        </div>
        <div className="section-head__actions">
          <button className="btn" onClick={() => window.print()} disabled={!opere.length}>
            <Icon name="printer" size={16} />
            Stampa cartellini QR
          </button>
          <button className="btn btn--primary" onClick={() => setEditing('new')} disabled={editing === 'new'}>
            <Icon name="plus" size={16} />
            Aggiungi opera
          </button>
        </div>
      </div>

      {error && <div className="banner banner--error">{error}</div>}

      <div className="panel kiosk-link">
        <QrCode text={kioskUrl()} size={88} alt="Codice QR della postazione generale" />
        <div>
          <h2>Postazione generale</h2>
          <p className="muted">Apri questo link sull’iPad della mostra e aggiungilo alla schermata Home. I commenti registrati qui non sono legati a un’opera.</p>
          <div className="link-row">
            <code>{kioskUrl()}</code>
            <button className="btn btn--small" onClick={() => copy(kioskUrl(), 'kiosk')}>
              <Icon name="link" size={14} />
              {copied === 'kiosk' ? 'Copiato' : 'Copia link'}
            </button>
          </div>
        </div>
      </div>

      {editing === 'new' && (
        <div className="panel">
          <ArtworkForm initial={{ numero: String(opere.length + 1) }} onSave={(v) => save(v)} onCancel={() => setEditing(null)} saving={saving} />
        </div>
      )}

      {!opere.length && editing !== 'new' ? (
        <div className="empty">
          <Icon name="qr" size={28} />
          <h2>Nessuna opera</h2>
          <p className="muted">Aggiungi le opere esposte per stampare un codice QR da mettere accanto a ciascuna.</p>
        </div>
      ) : (
        <ul className="art-list">
          {opere.map((o) =>
            editing === o.id ? (
              <li key={o.id} className="art art--editing">
                <ArtworkForm initial={{ ...o, numero: String(o.numero ?? '') }} onSave={(v) => save(v, o.id)} onCancel={() => setEditing(null)} saving={saving} />
              </li>
            ) : (
              <li key={o.id} className="art">
                <QrCode text={operaUrl(o.id)} size={72} alt={`Codice QR di ${o.titolo}`} />
                <div className="art__info">
                  <strong>{o.numero ? `${o.numero}. ` : ''}{o.titolo}</strong>
                  <span className="muted">{[o.autore, o.anno].filter(Boolean).join(', ') || '—'}</span>
                </div>
                <span className="art__count">{counts[o.id] || 0} <span className="muted">commenti</span></span>
                <div className="art__actions">
                  <button className="btn btn--small" onClick={() => copy(operaUrl(o.id), o.id)}>
                    <Icon name="link" size={14} />
                    {copied === o.id ? 'Copiato' : 'Link'}
                  </button>
                  <button className="btn btn--icon" onClick={() => setEditing(o.id)} aria-label={`Modifica ${o.titolo}`} title="Modifica">
                    <Icon name="pencil" />
                  </button>
                  {confirm === o.id ? (
                    <span className="confirm">
                      <button className="btn btn--small btn--danger" onClick={() => remove(o)}>Elimina</button>
                      <button className="btn btn--small" onClick={() => setConfirm(null)}>Annulla</button>
                    </span>
                  ) : (
                    <button className="btn btn--icon" onClick={() => setConfirm(o.id)} aria-label={`Elimina ${o.titolo}`} title="Elimina">
                      <Icon name="trash" />
                    </button>
                  )}
                </div>
              </li>
            )
          )}
        </ul>
      )}

      {/* foglio di stampa: un cartellino per opera */}
      <div className="print-sheet" aria-hidden="true">
        {opere.map((o) => (
          <div className="label-card" key={o.id}>
            <div className="label-card__text">
              <p className="label-card__mostra">{mostra.titolo}</p>
              <p className="label-card__title">{o.titolo}</p>
              <p className="label-card__author">{[o.autore, o.anno].filter(Boolean).join(', ')}</p>
              <p className="label-card__cta">Cosa ne pensi? Inquadra il codice e lascia un commento vocale.</p>
            </div>
            <QrCode text={operaUrl(o.id)} size={132} alt="" />
          </div>
        ))}
      </div>
    </section>
  );
}
