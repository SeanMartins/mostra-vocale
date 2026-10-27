import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { saveLocalBackup, markUploaded, getAllLocalRecordings, extensionFor } from './localDB';

// Carica una registrazione su Storage + Firestore. Lancia un errore se qualcosa fallisce.
export async function uploadRecording({ blob, mimeType, timestamp, duration, peaks, operaId, source }) {
  const fileName = `vocali/${timestamp}.${extensionFor(mimeType)}`;
  const storageRef = ref(storage, fileName);
  await uploadBytes(storageRef, blob, { contentType: mimeType.split(';')[0] });
  const downloadURL = await getDownloadURL(storageRef);
  await addDoc(collection(db, 'vocali'), {
    fileName,
    downloadURL,
    mimeType,
    size: blob.size,
    duration: Math.round(duration * 10) / 10,
    peaks,
    operaId: operaId || null,
    source,
    createdAt: serverTimestamp(),
    recordedAt: timestamp,
  });
}

// Salva prima in locale, poi prova a inviare.
// Ritorna 'uploaded' oppure 'local' (salvata solo sul dispositivo, verrà inviata dopo).
export async function saveRecording(rec) {
  const localId = await saveLocalBackup(rec);
  try {
    await uploadRecording(rec);
    if (localId) await markUploaded(localId);
    return 'uploaded';
  } catch (err) {
    console.warn('Invio non riuscito, resta il backup locale:', err);
    if (localId) return 'local';
    throw err; // né inviata né salvata: l'interfaccia deve dirlo
  }
}

let syncing = false;
// Reinvia le registrazioni rimaste solo sul dispositivo. Ritorna quante ne ha inviate.
export async function syncPending() {
  if (syncing || !navigator.onLine) return 0;
  syncing = true;
  let sent = 0;
  try {
    const pending = (await getAllLocalRecordings()).filter((r) => !r.uploadedToFirebase && r.blob);
    for (const r of pending.reverse()) {
      try {
        await uploadRecording({
          blob: r.blob,
          mimeType: r.mimeType || r.blob.type || 'audio/webm',
          timestamp: r.timestamp,
          duration: r.duration || 0,
          peaks: r.peaks || [],
          operaId: r.operaId || null,
          source: r.source || 'kiosk',
        });
        await markUploaded(r.id);
        sent += 1;
      } catch (err) {
        break; // rete ancora assente: riprova più tardi
      }
    }
  } finally {
    syncing = false;
  }
  return sent;
}
