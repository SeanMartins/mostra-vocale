// Backup locale (IndexedDB): ogni registrazione viene salvata qui PRIMA dell'invio,
// così non si perde nulla se la rete cade. Le registrazioni non inviate vengono
// reinviate da syncPending() all'apertura dell'app e quando torna la connessione.
const DB_NAME = 'mostra-vocale-backup';
const DB_VERSION = 2;
const STORE = 'vocali';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function run(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export async function saveLocalBackup(record) {
  try {
    return await run('readwrite', (s) => s.add({ ...record, uploadedToFirebase: false }));
  } catch (err) {
    console.warn('Backup locale non disponibile:', err);
    return null;
  }
}

export async function markUploaded(id) {
  try {
    const rec = await run('readonly', (s) => s.get(id));
    if (rec) await run('readwrite', (s) => s.put({ ...rec, uploadedToFirebase: true }));
  } catch (err) {
    console.warn('markUploaded:', err);
  }
}

export async function getAllLocalRecordings() {
  try {
    const all = await run('readonly', (s) => s.getAll());
    return (all || []).sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    return [];
  }
}

export async function deleteLocalRecording(id) {
  try {
    await run('readwrite', (s) => s.delete(id));
  } catch (err) {
    console.warn('deleteLocalRecording:', err);
  }
}

export function extensionFor(mimeType = '') {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4') || mimeType.includes('aac')) return 'm4a';
  if (mimeType.includes('mpeg')) return 'mp3';
  return 'webm';
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
