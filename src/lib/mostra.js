import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export const DEFAULT_ACCENT = '#E5392F';

export const DEFAULT_MOSTRA = {
  titolo: process.env.REACT_APP_MOSTRA_TITLE || 'Mostra',
  sottotitolo: '',
  date: '',
  luogo: '',
  immagineUrl: process.env.REACT_APP_MOSTRA_IMAGE || '/image.jpeg',
  accento: DEFAULT_ACCENT,
  durataMax: 60,
};

export const MOSTRA_DOC = () => doc(db, 'impostazioni', 'mostra');

// Impostazioni della mostra (titolo, immagine, colore) da Firestore, con i valori di default
// finché non sono state salvate dall'admin.
export function useMostra() {
  const [mostra, setMostra] = useState(DEFAULT_MOSTRA);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    return onSnapshot(
      MOSTRA_DOC(),
      (snap) => {
        setMostra({ ...DEFAULT_MOSTRA, ...(snap.exists() ? snap.data() : {}) });
        setLoaded(true);
      },
      () => setLoaded(true)
    );
  }, []);
  return { mostra, loaded };
}

export function useOpere() {
  const [opere, setOpere] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const q = query(collection(db, 'opere'), orderBy('numero', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        setOpere(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoaded(true);
      },
      () => setLoaded(true)
    );
  }, []);
  return { opere, loaded };
}

// Colore leggibile (bianco o quasi nero) sopra un colore di sfondo.
export function onColor(hex) {
  const c = (hex || DEFAULT_ACCENT).replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.05) ? '#FFFFFF' : '#111113';
}

export function formatDuration(s) {
  const t = Math.max(0, Math.round(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
