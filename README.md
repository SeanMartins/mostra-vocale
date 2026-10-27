# Mostra Vocale

Commenti vocali dei visitatori di una mostra: una postazione (iPad) e un codice QR accanto a ogni opera.
Ogni mostra ha il proprio nome, immagine e colore (white-label).

## Percorsi

| Indirizzo | Uso |
|---|---|
| `/?kiosk` | Postazione generale (iPad). Aggiungila alla schermata Home: si apre a schermo intero. |
| `/opera/<id>` | Pagina aperta dal QR accanto a un'opera: il commento resta collegato a quell'opera. |
| `/admin` | Archivio: commenti, statistiche, opere e QR, impostazioni della mostra. |

## Funzioni

- Registrazione fino a 30/60/90 secondi con forma d'onda dal vivo; salvataggio locale prima dell'invio e reinvio automatico quando torna la rete.
- Messaggi onesti al visitatore: salvato, salvato solo sul dispositivo, microfono bloccato, registrazione troppo breve.
- Archivio con forma d'onda reale di ogni commento, ricerca nelle trascrizioni, filtri per opera e periodo, trascrizione con Whisper (singola o in blocco), export CSV, download audio con nomi leggibili.
- Statistiche: commenti per giorno, per ora, per opera, durata media.
- Opere e QR: elenco opere, link e QR per ciascuna, stampa dei cartellini.
- Impostazioni: titolo, sottotitolo, date, luogo, immagine, colore, durata massima.

## Stack

React (Create React App) · Firebase Firestore + Storage + Authentication · Vercel (funzione `api/transcribe.js` verso OpenAI Whisper).

## Configurazione

1. **Firebase Authentication** → Metodo di accesso → attiva *Email/password* e crea l'utente dell'organizzatore (Users → Aggiungi utente). Il login admin usa questo account (la vecchia `REACT_APP_ADMIN_PASSWORD` non è più usata).
2. **Regole**: incolla `firebase.rules.txt` in Firestore → Regole e Storage → Regole.
3. **Variabili Vercel** (già presenti): `REACT_APP_FIREBASE_*`, `OPENAI_API_KEY`. `REACT_APP_MOSTRA_TITLE` e `REACT_APP_MOSTRA_IMAGE` restano come valori iniziali finché non salvi le impostazioni dall'admin.

## Sviluppo

```bash
npm install
npm start
```
