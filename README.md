# Mostra Vocale 🎙️

App per raccogliere commenti vocali dei visitatori durante una mostra.
Deploy su Vercel + Firebase Storage/Firestore.

---

## Stack

- **React** (Create React App) — PWA fullscreen su iPad
- **lamejs** — encoding MP3 client-side (nessun server necessario)
- **Firebase Storage** — archiviazione MP3
- **Firebase Firestore** — metadati registrazioni (data, durata, URL)
- **Vercel** — deploy

---

## Setup in 5 passi

### 1. Firebase — crea il progetto

Nella **Firebase Console** (console.firebase.google.com):

1. Crea un nuovo progetto (o usa uno esistente)
2. Aggiungi un'**app Web** → copia le credenziali
3. Attiva **Firestore Database** (modalità produzione)
4. Attiva **Storage** (modalità produzione)
5. Incolla le regole da `firebase.rules.txt` in Firestore → Regole e Storage → Regole

### 2. Configura le variabili d'ambiente

```bash
cp .env.example .env.local
```

Compila `.env.local` con le credenziali Firebase copiate al passo 1.

Per l'immagine della locandina (`REACT_APP_MOSTRA_IMAGE`):
- Caricala su Firebase Storage manualmente
- Oppure usa qualsiasi URL pubblico
- Se lasci vuoto, appare il nome della mostra come testo

### 3. Installa e testa in locale

```bash
npm install
npm start
```

- **Schermata pubblica:** `http://localhost:3000`
- **Pannello admin:** `http://localhost:3000/admin`

### 4. Deploy su Vercel

```bash
npm install -g vercel
vercel --prod
```

Oppure collega il repository GitHub a Vercel e aggiungi le variabili d'ambiente nella dashboard Vercel (Settings → Environment Variables).

### 5. Configura l'iPad per la mostra

1. Apri Safari sull'iPad → vai all'URL dell'app
2. Tocca **Condividi → Aggiungi a schermata Home**
3. Apri l'app dalla schermata Home → va in fullscreen automatico
4. Su iPad: Impostazioni → Accessibilità → Zoom OFF, Guided Access ON (opzionale, blocca l'app)

---

## Struttura cartelle

```
src/
  components/
    PublicView.jsx    # Schermata visitatori (tasto rosso + waveform)
    AdminView.jsx     # Archivio admin con player e download
  firebase.js         # Configurazione Firebase
  mp3encoder.js       # Encoding WebM→MP3 con lamejs
  App.js              # Router (/ → pubblico, /admin → admin)
  App.css             # Animazioni globali
```

---

## Funzionamento tecnico

1. Il browser acquisisce audio dal microfono tramite `getUserMedia`
2. `MediaRecorder` salva chunks in formato WebM/Opus
3. Allo stop, `AudioContext.decodeAudioData` decodifica il WebM
4. `lamejs` ri-encode in MP3 128kbps client-side (nessun server!)
5. Il Blob MP3 viene caricato su Firebase Storage
6. I metadati (URL, durata, data) vengono salvati in Firestore

---

## Pannello Admin

URL: `/admin`
Password: valore di `REACT_APP_ADMIN_PASSWORD` nel file `.env.local`

Funzioni:
- Lista registrazioni in tempo reale (WebSocket Firestore)
- Player integrato (play/pause per ogni traccia)
- Download singolo MP3
- Download massivo (tutti i file)
- Eliminazione singola (rimuove da Storage + Firestore)

---

## Note iOS/Safari

Safari su iOS richiede che l'`AudioContext` venga creato in risposta a un gesto dell'utente — questa app lo gestisce correttamente creando il context solo al tap del tasto REC.

La conversione MP3 avviene interamente nel browser; nessun dato audio transita su server intermedi.
