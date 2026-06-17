const DB_NAME = 'mostra-vocale-backup';
const DB_VERSION = 2;
const STORE_NAME = 'vocali';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function saveLocalBackup(blob, mimeType, timestamp) {
  try {
    console.log('saveLocalBackup: inizio', { size: blob.size, mimeType, timestamp });
    const db = await openDB();
    console.log('saveLocalBackup: DB aperto');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add({
        blob,
        mimeType,
        timestamp,
        size: blob.size,
        uploadedToFirebase: false,
      });
      req.onsuccess = () => { console.log('saveLocalBackup: salvato, id=', req.result); resolve(req.result); };
      req.onerror = () => { console.error('saveLocalBackup: errore store', req.error); reject(req.error); };
    });
  } catch (err) {
    console.error('saveLocalBackup: eccezione', err);
    return null;
  }
}

export async function markUploaded(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
          record.uploadedToFirebase = true;
          store.put(record);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.warn('markUploaded failed:', err);
  }
}

export async function getAllLocalRecordings() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('getAllLocalRecordings failed:', err);
    return [];
  }
}

export async function deleteLocalRecording(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('deleteLocalRecording failed:', err);
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
