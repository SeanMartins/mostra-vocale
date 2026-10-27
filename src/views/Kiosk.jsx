import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useMostra, onColor, formatDuration } from '../lib/mostra';
import { useRecorder } from '../lib/useRecorder';
import { saveRecording, syncPending } from '../lib/uploads';
import { LiveWaveform } from '../components/Waveform';
import Icon from '../components/Icon';

const RESET_AFTER_MS = 6000;

function detectSource() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('kiosk')) return 'kiosk';
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
  return standalone ? 'kiosk' : 'mobile';
}

export default function Kiosk({ operaId }) {
  const { mostra } = useMostra();
  const [opera, setOpera] = useState(null);
  const [operaMissing, setOperaMissing] = useState(false);
  const [phase, setPhase] = useState('ready'); // ready | saving | uploaded | local | tooShort | failed
  const source = useMemo(detectSource, []);
  const maxSeconds = mostra.durataMax || 60;

  useEffect(() => {
    if (!operaId) return;
    getDoc(doc(db, 'opere', operaId))
      .then((snap) => (snap.exists() ? setOpera({ id: snap.id, ...snap.data() }) : setOperaMissing(true)))
      .catch(() => setOperaMissing(true));
  }, [operaId]);

  // reinvia ciò che è rimasto sul dispositivo
  useEffect(() => {
    syncPending();
    const onOnline = () => syncPending();
    window.addEventListener('online', onOnline);
    const t = setInterval(syncPending, 60000);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(t);
    };
  }, []);

  const onFinish = useCallback(
    async ({ blob, mimeType, duration, peaks }) => {
      setPhase('saving');
      try {
        const result = await saveRecording({
          blob,
          mimeType,
          duration,
          peaks,
          timestamp: Date.now(),
          operaId: operaId && !operaMissing ? operaId : null,
          source,
        });
        setPhase(result);
      } catch (err) {
        setPhase('failed');
      }
    },
    [operaId, operaMissing, source]
  );

  const rec = useRecorder({ maxSeconds, onFinish, onTooShort: () => setPhase('tooShort') });
  const resetRecorder = rec.reset;

  // dopo la conferma il kiosk torna pronto per il visitatore successivo
  useEffect(() => {
    if (!['uploaded', 'local', 'tooShort', 'failed'].includes(phase)) return;
    const t = setTimeout(() => {
      setPhase('ready');
      resetRecorder();
    }, phase === 'tooShort' ? 3000 : RESET_AFTER_MS);
    return () => clearTimeout(t);
  }, [phase, resetRecorder]);

  useEffect(() => {
    document.title = opera ? `${opera.titolo} — ${mostra.titolo}` : mostra.titolo;
  }, [mostra.titolo, opera]);

  const recording = rec.status === 'recording';
  const busy = phase === 'saving' || rec.status === 'starting';
  const accent = mostra.accento;

  const toggle = () => {
    if (recording) return rec.stop();
    if (phase !== 'ready' && phase !== 'tooShort') {
      setPhase('ready');
      rec.reset();
    }
    rec.start();
  };

  const remaining = Math.max(0, maxSeconds - rec.elapsed);

  let message;
  let tone = '';
  if (rec.status === 'unsupported') {
    message = 'Questo browser non permette di registrare. Apri la pagina con Safari o Chrome aggiornati.';
    tone = 'warn';
  } else if (rec.status === 'denied') {
    message =
      source === 'kiosk'
        ? 'Il microfono è bloccato. Chiedi al personale della mostra di abilitarlo nelle impostazioni del dispositivo.'
        : 'Il microfono è bloccato. Consenti l’accesso al microfono nelle impostazioni del browser e ricarica la pagina.';
    tone = 'warn';
  } else if (rec.status === 'error') {
    message = 'Non riesco ad accedere al microfono. Riprova.';
    tone = 'warn';
  } else if (recording) {
    message = 'Sto registrando. Tocca di nuovo quando hai finito.';
  } else if (phase === 'saving') {
    message = 'Salvataggio in corso…';
  } else if (phase === 'uploaded') {
    message = 'Grazie. Il tuo commento è stato salvato.';
    tone = 'ok';
  } else if (phase === 'local') {
    message = 'Grazie. Il commento è salvato su questo dispositivo e verrà inviato appena torna la connessione.';
    tone = 'ok';
  } else if (phase === 'tooShort') {
    message = 'Troppo breve. Tocca il pulsante, parla, poi toccalo di nuovo.';
    tone = 'warn';
  } else if (phase === 'failed') {
    message = 'Non è stato possibile salvare il commento. Riprova tra poco.';
    tone = 'warn';
  } else {
    message = `Tocca il pulsante e parla. Hai fino a ${maxSeconds} secondi.`;
  }

  const title = opera ? opera.titolo : mostra.titolo;
  const subtitle = opera
    ? [[opera.autore, opera.anno].filter(Boolean).join(', ')]
    : [mostra.sottotitolo, [mostra.date, mostra.luogo].filter(Boolean).join(' · ')];

  return (
    <div
      className={`kiosk ${recording ? 'is-recording' : ''}`}
      style={{ '--accent': accent, '--on-accent': onColor(accent) }}
    >
      <figure className="kiosk__art">
        {mostra.immagineUrl ? (
          <img src={opera?.immagineUrl || mostra.immagineUrl} alt="" draggable="false" />
        ) : (
          <div className="kiosk__art-empty">{mostra.titolo}</div>
        )}
      </figure>

      <main className="kiosk__panel">
        <header className="kiosk__heading">
          {opera && <p className="kiosk__context">{mostra.titolo}</p>}
          <h1>{title}</h1>
          {subtitle.filter(Boolean).map((line) => (
            <p className="kiosk__sub" key={line}>{line}</p>
          ))}
        </header>

        <section className="kiosk__recorder" aria-live="polite">
          <LiveWaveform levels={recording ? rec.levels : []} />
          <div className="kiosk__time" aria-hidden={!recording}>
            <span className="kiosk__elapsed">{formatDuration(rec.elapsed)}</span>
            <span className="kiosk__limit">{recording ? `−${formatDuration(remaining)}` : formatDuration(maxSeconds)}</span>
          </div>

          <button
            type="button"
            className={`rec-button ${recording ? 'is-on' : ''} ${busy ? 'is-busy' : ''}`}
            onClick={toggle}
            disabled={busy || rec.status === 'unsupported'}
            aria-label={recording ? 'Ferma la registrazione' : 'Registra un commento'}
          >
            <span className="rec-button__core" />
          </button>

          <p className={`kiosk__message ${tone ? `is-${tone}` : ''}`}>
            {tone && <Icon name={phase === 'local' ? 'cloudOff' : tone === 'ok' ? 'check' : 'alert'} size={20} />}
            <span>{message}</span>
          </p>
        </section>

        <footer className="kiosk__footer">
          <span>Non serve lasciare il tuo nome: le registrazioni sono anonime.</span>
          <span className="kiosk__credit">© Martins Osemwengie</span>
        </footer>
      </main>
    </div>
  );
}
