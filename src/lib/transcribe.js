import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { extensionFor } from './localDB';

// Trascrive con Whisper tramite /api/transcribe (accesso solo con login admin).
export async function transcribeRecording(rec) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessione scaduta: accedi di nuovo.');
  const token = await user.getIdToken();

  const audio = await fetch(rec.downloadURL);
  if (!audio.ok) throw new Error('File audio non raggiungibile.');
  const blob = await audio.blob();
  const type = (rec.mimeType || blob.type || 'audio/webm').split(';')[0];

  const form = new FormData();
  form.append('file', new File([blob], `audio.${extensionFor(type)}`, { type }));
  form.append('model', 'whisper-1');
  form.append('language', 'it');

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || data?.error || `Errore ${res.status}`);

  const text = (data.text || '').trim();
  await updateDoc(doc(db, 'vocali', rec.id), { transcription: text || '(nessun parlato riconosciuto)' });
  return text;
}
