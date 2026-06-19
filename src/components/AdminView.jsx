import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { getAllLocalRecordings, deleteLocalRecording, downloadBlob } from '../localDB';

const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || 'mostra2024';

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateLocal(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(bytes) {
  if (!bytes) return '—';
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function AdminView() {
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState('');
  const [pwdError, setPwdError] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [localRecs, setLocalRecs] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [transcribing, setTranscribing] = useState(null);
  const [tab, setTab] = useState('firebase');
  const audioRef = useRef(null);

  useEffect(() => {
    if (!authed) return;
    const q = query(collection(db, 'vocali'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRecordings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    loadLocal();
    return () => unsub();
  }, [authed]);

  const loadLocal = async () => {
    const recs = await getAllLocalRecordings();
    setLocalRecs(recs.sort((a, b) => b.timestamp - a.timestamp));
  };

  const login = () => {
    if (pwd === ADMIN_PASSWORD) { setAuthed(true); setPwdError(false); }
    else setPwdError(true);
  };

  const playPause = (id, url) => {
    if (playing === id) {
      audioRef.current?.pause();
      setPlaying(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
      setPlaying(id);
    }
  };

  const deleteRec = async (rec) => {
    if (!window.confirm('Eliminare questa registrazione?')) return;
    setDeleting(rec.id);
    try {
      await deleteObject(ref(storage, rec.fileName));
      await deleteDoc(doc(db, 'vocali', rec.id));
    } catch (e) { alert('Errore durante l\'eliminazione'); }
    setDeleting(null);
  };

  const transcribeNow = async (rec) => {
    setTranscribing(rec.id);
    try {
      // Scarica l'audio da Firebase
      const audioRes = await fetch(rec.downloadURL);
      const audioBlob = await audioRes.blob();
      const ext = rec.fileName.split('.').pop();

      const formData = new FormData();
      const file = new File([audioBlob], `audio.${ext}`, { type: rec.mimeType || audioBlob.type });
      formData.append('file', file);
      formData.append('model', 'whisper-1');
      formData.append('language', 'it');

      const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(JSON.stringify(err));
      }
      const data = await response.json();
      const transcription = data.text || '(nessun testo rilevato)';

      await updateDoc(doc(db, 'vocali', rec.id), { transcription });
    } catch (e) {
      console.error('Errore trascrizione:', e);
      alert('Errore durante la trascrizione. Riprova.');
    }
    setTranscribing(null);
  };

  const deleteLocalRec = async (id) => {
    if (!window.confirm('Eliminare dal backup locale?')) return;
    await deleteLocalRecording(id);
    loadLocal();
  };

  const downloadLocal = (rec) => {
    const ext = rec.mimeType?.includes('ogg') ? 'ogg' : rec.mimeType?.includes('mp4') ? 'mp4' : 'webm';
    downloadBlob(rec.blob, `backup_${rec.timestamp}.${ext}`);
  };

  const downloadAll = () => {
    recordings.forEach((rec, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = rec.downloadURL;
        a.download = `vocale_${i + 1}.webm`;
        a.click();
      }, i * 300);
    });
  };

  const downloadAllLocal = () => {
    localRecs.forEach((rec, i) => {
      setTimeout(() => downloadLocal(rec), i * 300);
    });
  };

  if (!authed) {
    return (
      <div style={s.loginWrap}>
        <div style={s.loginCard}>
          <h1 style={s.loginTitle}>Admin · Archivio Vocali</h1>
          <input
            type="password"
            placeholder="Password"
            value={pwd}
            onChange={e => { setPwd(e.target.value); setPwdError(false); }}
            onKeyDown={e => e.key === 'Enter' && login()}
            style={{ ...s.input, ...(pwdError ? s.inputError : {}) }}
            autoFocus
          />
          {pwdError && <p style={s.errorMsg}>Password errata</p>}
          <button onClick={login} style={s.loginBtn}>Accedi</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <audio ref={audioRef} onEnded={() => setPlaying(null)} />

      <div style={s.header}>
        <div>
          <h1 style={s.title}>Archivio Vocali</h1>
          <p style={s.subtitle}>{recordings.length} su Firebase · {localRecs.length} backup locale</p>
        </div>
        <button onClick={() => setAuthed(false)} style={s.logoutBtn}>Esci</button>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        <button onClick={() => setTab('firebase')} style={{ ...s.tab, ...(tab === 'firebase' ? s.tabActive : {}) }}>
          ☁️ Firebase ({recordings.length})
        </button>
        <button onClick={() => setTab('local')} style={{ ...s.tab, ...(tab === 'local' ? s.tabActive : {}) }}>
          📱 Backup Locale ({localRecs.length})
        </button>
      </div>

      {/* Firebase tab */}
      {tab === 'firebase' && (
        <>
          {recordings.length > 0 && (
            <button onClick={downloadAll} style={s.downloadAllBtn}>↓ Scarica tutti</button>
          )}
          <p style={s.hint}>📝 = trascrivi con Whisper (~$0.006 a registrazione)</p>
          {recordings.length === 0 ? (
            <div style={s.empty}><p>Nessuna registrazione su Firebase.</p></div>
          ) : (
            <div style={s.list}>
              {recordings.map((rec, i) => (
                <div key={rec.id} style={s.recRow}>
                  <div style={s.recIndex}>{recordings.length - i}</div>
                  <button onClick={() => playPause(rec.id, rec.downloadURL)} style={{ ...s.playBtn, background: playing === rec.id ? '#e74c3c' : '#1a1a1a' }}>
                    {playing === rec.id ? '⏸' : '▶'}
                  </button>
                  <div style={s.recMeta}>
                    <span style={s.recDate}>{formatDate(rec.createdAt)}</span>
                    <span style={s.recDetails}>{formatSize(rec.size)}</span>
                    {rec.transcription && (
                      <span style={s.transcription}>📄 {rec.transcription}</span>
                    )}
                  </div>
                  <div style={s.recActions}>
                    {!rec.transcription && (
                      <button
                        onClick={() => transcribeNow(rec)}
                        style={s.transcribeBtn}
                        disabled={transcribing === rec.id}
                        title="Trascrivi con Whisper (~$0.006)"
                      >
                        {transcribing === rec.id ? '...' : '📝'}
                      </button>
                    )}
                    <a href={rec.downloadURL} download={`vocale_${i + 1}.webm`} style={s.dlBtn}>↓</a>
                    <button onClick={() => deleteRec(rec)} style={s.delBtn} disabled={deleting === rec.id}>
                      {deleting === rec.id ? '...' : '✕'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Local backup tab */}
      {tab === 'local' && (
        <>
          {localRecs.length > 0 && (
            <button onClick={downloadAllLocal} style={s.downloadAllBtn}>↓ Scarica tutti i backup</button>
          )}
          {localRecs.length === 0 ? (
            <div style={s.empty}>
              <p>Nessun backup locale.</p>
              <p style={{ color: '#555', fontSize: 14 }}>I backup vengono salvati su questo dispositivo.</p>
            </div>
          ) : (
            <div style={s.list}>
              {localRecs.map((rec, i) => (
                <div key={rec.id} style={s.recRow}>
                  <div style={s.recIndex}>{localRecs.length - i}</div>
                  <button
                    onClick={() => {
                      const url = URL.createObjectURL(rec.blob);
                      playPause(`local-${rec.id}`, url);
                    }}
                    style={{ ...s.playBtn, background: playing === `local-${rec.id}` ? '#e74c3c' : '#1a1a1a' }}
                  >
                    {playing === `local-${rec.id}` ? '⏸' : '▶'}
                  </button>
                  <div style={s.recMeta}>
                    <span style={s.recDate}>{formatDateLocal(rec.timestamp)}</span>
                    <span style={s.recDetails}>
                      {formatSize(rec.size)} · {rec.uploadedToFirebase ? '✓ Sincronizzato' : '⚠ Non sincronizzato'}
                    </span>
                  </div>
                  <div style={s.recActions}>
                    <button onClick={() => downloadLocal(rec)} style={s.dlBtn}>↓</button>
                    <button onClick={() => deleteLocalRec(rec.id)} style={s.delBtn}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ textAlign: 'center', color: '#333', fontSize: 11, padding: '32px 0 8px' }}>© Martins Osemwengie</div>
    </div>
  );
}

const s = {
  loginWrap: { minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loginCard: { background: '#111', border: '1px solid #222', borderRadius: 12, padding: '40px 32px', width: 320, display: 'flex', flexDirection: 'column', gap: 16 },
  loginTitle: { color: '#fff', fontSize: 18, fontWeight: 400, margin: 0, textAlign: 'center', letterSpacing: 1 },
  input: { background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff', padding: '12px 16px', fontSize: 16, outline: 'none', width: '100%', boxSizing: 'border-box' },
  inputError: { borderColor: '#e74c3c' },
  errorMsg: { color: '#e74c3c', fontSize: 13, margin: 0, textAlign: 'center' },
  loginBtn: { background: '#e74c3c', border: 'none', borderRadius: 8, color: '#fff', padding: '12px', fontSize: 16, cursor: 'pointer', fontWeight: 500 },
  container: { minHeight: '100vh', background: '#0a0a0a', padding: '24px 20px', maxWidth: 800, margin: '0 auto', color: '#fff' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 24, fontWeight: 300, margin: 0, letterSpacing: 2, textTransform: 'uppercase' },
  subtitle: { color: '#555', fontSize: 14, margin: '4px 0 0' },
  logoutBtn: { background: 'transparent', border: '1px solid #333', borderRadius: 8, color: '#666', padding: '8px 12px', fontSize: 14, cursor: 'pointer' },
  tabs: { display: 'flex', gap: 8, marginBottom: 20 },
  tab: { background: 'transparent', border: '1px solid #333', borderRadius: 8, color: '#666', padding: '8px 16px', fontSize: 14, cursor: 'pointer' },
  tabActive: { border: '1px solid #555', color: '#fff', background: '#1a1a1a' },
  downloadAllBtn: { background: 'transparent', border: '1px solid #333', borderRadius: 8, color: '#aaa', padding: '8px 16px', fontSize: 14, cursor: 'pointer', marginBottom: 16, display: 'block' },
  empty: { textAlign: 'center', padding: '80px 0', color: '#777' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  recRow: { background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 },
  recIndex: { color: '#444', fontSize: 12, fontFamily: 'monospace', minWidth: 24, textAlign: 'right' },
  playBtn: { width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s' },
  recMeta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  recDate: { color: '#ccc', fontSize: 14 },
  recDetails: { color: '#555', fontSize: 12, fontFamily: 'monospace' },
  recActions: { display: 'flex', gap: 8, alignItems: 'center' },
  dlBtn: { background: 'transparent', border: '1px solid #333', borderRadius: 6, color: '#aaa', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, textDecoration: 'none', cursor: 'pointer' },
  delBtn: { background: 'transparent', border: '1px solid #2a1a1a', borderRadius: 6, color: '#633', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer' },
  transcription: { color: '#aaa', fontSize: 12, fontStyle: 'italic', marginTop: 4, lineHeight: 1.4 },
  transcriptionPending: { color: '#444', fontSize: 11, marginTop: 4 },
  transcribeBtn: { background: 'transparent', border: '1px solid #2a3a4a', borderRadius: 6, color: '#5a9bd5', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer' },
  hint: { color: '#444', fontSize: 12, margin: '0 0 16px' },
};
