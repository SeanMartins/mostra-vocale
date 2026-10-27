import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useMostra, useOpere } from '../../lib/mostra';
import Icon from '../../components/Icon';
import Recordings from './Recordings';
import Stats from './Stats';
import Artworks from './Artworks';
import Settings from './Settings';

const TABS = [
  { id: 'commenti', label: 'Commenti' },
  { id: 'statistiche', label: 'Statistiche' },
  { id: 'opere', label: 'Opere e QR' },
  { id: 'impostazioni', label: 'Impostazioni' },
];

function tabFromHash() {
  const h = window.location.hash.replace('#', '');
  return TABS.some((t) => t.id === h) ? h : 'commenti';
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = err.code || '';
      if (code.includes('operation-not-allowed') || code.includes('configuration-not-found')) {
        setError('L’accesso con email non è ancora attivo nel progetto Firebase (Authentication → Metodo di accesso → Email/password).');
      } else if (code.includes('too-many-requests')) {
        setError('Troppi tentativi. Attendi qualche minuto e riprova.');
      } else if (code.includes('network')) {
        setError('Nessuna connessione. Controlla la rete e riprova.');
      } else {
        setError('Email o password non corrette.');
      }
    }
    setBusy(false);
  };

  const reset = async () => {
    if (!email) return setError('Scrivi la tua email, poi premi di nuovo “Password dimenticata”.');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo(`Ti abbiamo inviato un link per reimpostare la password a ${email.trim()}.`);
      setError('');
    } catch {
      setError('Non è stato possibile inviare l’email. Controlla l’indirizzo.');
    }
  };

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit} noValidate>
        <h1>Archivio commenti</h1>
        <p className="muted">Accedi per ascoltare e gestire i commenti vocali della mostra.</p>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {info && <p className="form-info" role="status">{info}</p>}
        <button className="btn btn--primary btn--block" disabled={busy || !email || !password}>
          {busy ? 'Accesso…' : 'Accedi'}
        </button>
        <button type="button" className="btn btn--link" onClick={reset}>
          Password dimenticata
        </button>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState(tabFromHash);
  const [recordings, setRecordings] = useState([]);
  const [recLoaded, setRecLoaded] = useState(false);
  const [recError, setRecError] = useState('');
  const { mostra } = useMostra();
  const { opere } = useOpere();

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.title = `Archivio · ${mostra.titolo}`;
  }, [mostra.titolo]);

  useEffect(() => {
    if (!user) return undefined;
    const q = query(collection(db, 'vocali'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        setRecordings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setRecLoaded(true);
        setRecError('');
      },
      (err) => {
        setRecLoaded(true);
        setRecError(err.code === 'permission-denied' ? 'Il tuo account non ha i permessi per leggere i commenti.' : 'Impossibile caricare i commenti.');
      }
    );
  }, [user]);

  if (user === undefined) return <div className="admin-loading" aria-busy="true" />;
  if (!user) return <Login />;

  const go = (id) => {
    window.location.hash = id;
    setTab(id);
  };

  return (
    <div className="admin" style={{ '--accent': mostra.accento }}>
      <header className="topbar">
        <div className="topbar__inner">
          <div className="topbar__brand">
            <span className="swatch" aria-hidden="true" />
            <div>
              <strong>{mostra.titolo}</strong>
              <span className="muted">Archivio commenti vocali</span>
            </div>
          </div>
          <nav className="tabs" aria-label="Sezioni">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tabs__item ${tab === t.id ? 'is-active' : ''}`}
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={() => go(t.id)}
              >
                {t.label}
                {t.id === 'commenti' && recLoaded && <span className="tabs__count">{recordings.length}</span>}
              </button>
            ))}
          </nav>
          <div className="topbar__user">
            <span className="muted topbar__email">{user.email}</span>
            <button className="btn btn--icon" onClick={() => signOut(auth)} title="Esci" aria-label="Esci">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </header>

      <main className="admin__main">
        {recError && <div className="banner banner--error">{recError}</div>}
        {tab === 'commenti' && <Recordings recordings={recordings} loaded={recLoaded} opere={opere} user={user} />}
        {tab === 'statistiche' && <Stats recordings={recordings} loaded={recLoaded} opere={opere} />}
        {tab === 'opere' && <Artworks opere={opere} recordings={recordings} mostra={mostra} />}
        {tab === 'impostazioni' && <Settings mostra={mostra} />}
      </main>

      <footer className="admin__footer">© Martins Osemwengie</footer>
    </div>
  );
}
