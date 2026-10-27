// Proxy verso OpenAI Whisper. Accetta solo richieste di un utente admin autenticato con Firebase,
// così la chiave OpenAI non può essere usata da chiunque conosca l'indirizzo.
export const config = { api: { bodyParser: false } };

const MAX_BYTES = 25 * 1024 * 1024; // limite di Whisper

async function verifyFirebaseToken(idToken) {
  const key = process.env.REACT_APP_FIREBASE_API_KEY;
  if (!key || !idToken) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data.users && data.users[0] ? data.users[0] : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Chiave OpenAI non configurata sul server' });

  const auth = req.headers.authorization || '';
  const user = await verifyFirebaseToken(auth.startsWith('Bearer ') ? auth.slice(7) : '').catch(() => null);
  if (!user) return res.status(401).json({ error: 'Accesso non autorizzato: effettua di nuovo il login' });

  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BYTES) return res.status(413).json({ error: 'File troppo grande per la trascrizione' });
      chunks.push(chunk);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': req.headers['content-type'] },
      body: Buffer.concat(chunks),
    });
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Errore proxy trascrizione:', err);
    return res.status(500).json({ error: 'Errore durante la trascrizione' });
  }
}
