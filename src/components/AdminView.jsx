import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || 'mostra2024';

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
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
  const [playing, setPlaying] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!authed) return;
    const q = query(collection(db, 'vocali'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRecordings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [authed]);

  const login = () => {
    if (pwd === ADMIN_PASSWORD) {
      setAuthed(true);
      setPwdError(false);
    } else {
      setPwdError(true);
    }
  };

  const playPause = (rec) => {
    if (playing === rec.id) {
      audioRef.current?.pause();
      setPlaying(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = rec.downloadURL;
        audioRef.current.play();
      }
      setPlaying(rec.id);
    }
  };

  const deleteRec = async (rec) => {
    if (!window.confirm('Eliminare questa registrazione?')) return;
    setDeleting(rec.id);
    try {
      const storageRef = ref(storage, rec.fileName);
      await deleteObject(storageRef);
      await deleteDoc(doc(db, 'vocali', rec.id));
    } catch (e) {
      console.error(e);
      alert('Errore durante l\'eliminazione');
    }
    setDeleting(null);
  };

  const downloadAll = () => {
    recordings.forEach((rec, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = rec.downloadURL;
        a.download = `vocale_${i + 1}.mp3`;
        a.click();
      }, i * 300);
    });
  };

  if (!authed) {
    return (
      <div style={adminStyles.loginWrap}>
        <div style={adminStyles.loginCard}>
          <h1 style={adminStyles.loginTitle}>Admin · Archivio Vocali</h1>
          <input
            type="password"
            placeholder="Password"
            value={pwd}
            onChange={e => { setPwd(e.target.value); setPwdError(false); }}
            onKeyDown={e => e.key === 'Enter' && login()}
            style={{ ...adminStyles.input, ...(pwdError ? adminStyles.inputError : {}) }}
            autoFocus
          />
          {pwdError && <p style={adminStyles.errorMsg}>Password errata</p>}
          <button onClick={login} style={adminStyles.loginBtn}>Accedi</button>
        </div>
      </div>
    );
  }

  return (
    <div style={adminStyles.container}>
      <audio ref={audioRef} onEnded={() => setPlaying(null)} />

      <div style={adminStyles.header}>
        <div>
          <h1 style={adminStyles.title}>Archivio Vocali</h1>
          <p style={adminStyles.subtitle}>{recordings.length} registrazioni totali</p>
        </div>
        <div style={adminStyles.headerActions}>
          {recordings.length > 0 && (
            <button onClick={downloadAll} style={adminStyles.downloadAllBtn}>
              ↓ Scarica tutti
            </button>
          )}
          <button onClick={() => setAuthed(false)} style={adminStyles.logoutBtn}>Esci</button>
        </div>
      </div>

      {recordings.length === 0 ? (
        <div style={adminStyles.empty}>
          <p>Nessuna registrazione ancora.</p>
          <p style={{ color: '#555', fontSize: 14 }}>Le registrazioni appariranno qui in tempo reale.</p>
        </div>
      ) : (
        <div style={adminStyles.list}>
          {recordings.map((rec, i) => (
            <div key={rec.id} style={adminStyles.recRow}>
              <div style={adminStyles.recIndex}>{recordings.length - i}</div>

              <button
                onClick={() => playPause(rec)}
                style={{
                  ...adminStyles.playBtn,
                  background: playing === rec.id ? '#e74c3c' : '#1a1a1a',
                }}
                aria-label={playing === rec.id ? 'Pausa' : 'Riproduci'}
              >
                {playing === rec.id ? '⏸' : '▶'}
              </button>

              <div style={adminStyles.recMeta}>
                <span style={adminStyles.recDate}>{formatDate(rec.createdAt)}</span>
                <span style={adminStyles.recDetails}>
                  {formatDuration(rec.duration)} · {formatSize(rec.size)}
                </span>
              </div>

              <div style={adminStyles.recActions}>
                <a
                  href={rec.downloadURL}
                  download={`vocale_${i + 1}.mp3`}
                  style={adminStyles.dlBtn}
                  aria-label="Download MP3"
                >
                  ↓
                </a>
                <button
                  onClick={() => deleteRec(rec)}
                  style={adminStyles.delBtn}
                  disabled={deleting === rec.id}
                  aria-label="Elimina"
                >
                  {deleting === rec.id ? '...' : '✕'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{textAlign:'center', color:'#333', fontSize:11, padding:'32px 0 8px'}}>© Martins Osemwengie</div>
    </div>
  );
}

const adminStyles = {
  loginWrap: {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginCard: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: 12,
    padding: '40px 32px',
    width: 320,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  loginTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 400,
    margin: 0,
    textAlign: 'center',
    letterSpacing: 1,
  },
  input: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    padding: '12px 16px',
    fontSize: 16,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  errorMsg: {
    color: '#e74c3c',
    fontSize: 13,
    margin: 0,
    textAlign: 'center',
  },
  loginBtn: {
    background: '#e74c3c',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    padding: '12px',
    fontSize: 16,
    cursor: 'pointer',
    fontWeight: 500,
  },
  container: {
    minHeight: '100vh',
    background: '#0a0a0a',
    padding: '24px 20px',
    maxWidth: 800,
    margin: '0 auto',
    color: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 32,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 300,
    margin: 0,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: '#555',
    fontSize: 14,
    margin: '4px 0 0',
  },
  headerActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  downloadAllBtn: {
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#aaa',
    padding: '8px 16px',
    fontSize: 14,
    cursor: 'pointer',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#666',
    padding: '8px 12px',
    fontSize: 14,
    cursor: 'pointer',
  },
  empty: {
    textAlign: 'center',
    padding: '80px 0',
    color: '#777',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  recRow: {
    background: '#111',
    border: '1px solid #1e1e1e',
    borderRadius: 10,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  recIndex: {
    color: '#444',
    fontSize: 12,
    fontFamily: 'monospace',
    minWidth: 24,
    textAlign: 'right',
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    color: '#fff',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.2s',
  },
  recMeta: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  recDate: {
    color: '#ccc',
    fontSize: 14,
  },
  recDetails: {
    color: '#555',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  recActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  dlBtn: {
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#aaa',
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    textDecoration: 'none',
    cursor: 'pointer',
  },
  delBtn: {
    background: 'transparent',
    border: '1px solid #2a1a1a',
    borderRadius: 6,
    color: '#633',
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    cursor: 'pointer',
  },
};
