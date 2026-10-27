# Design — Mostra Vocale

Standard pulito, white-label. L'immagine e il colore della mostra guidano; l'interfaccia si fa da parte.

## Due superfici, due luci
- **Postazione / telefono** (`.kiosk`): fondo quasi nero `#0c0c0d`, testo `#f5f5f4`, secondario `#a6a6a1`, linee `rgba(255,255,255,.12)`. Pensata per sale espositive con luce controllata: l'immagine resta protagonista.
- **Archivio** (`.admin`): fondo `#f6f6f5`, superfici `#ffffff`, linee `#e4e4e1`, testo `#161618`, secondario `#5c5c58`. Modalità scura automatica (`prefers-color-scheme`).

## Colore della mostra
`--accent` arriva da Firestore (`impostazioni/mostra.accento`, default `#E5392F`). Usato solo per: nucleo del pulsante di registrazione, testina della forma d'onda, barre dei grafici, quadratino del marchio in archivio. `--on-accent` è calcolato per il contrasto (`onColor`).

## Tipografia
Font di sistema (SF su iPad/iPhone, Segoe UI Variable su Windows). Titoli 650, tracking −0.015/−0.025em. Numeri sempre `tabular-nums`.

## Firma
Ogni registrazione è disegnata con la sua forma d'onda reale: dal vivo nella postazione (barre che scorrono verso la testina, stile Memo Vocali) e come cursore di riproduzione in archivio (64 picchi salvati con il commento).

## Componenti
- Pulsante di registrazione: anello bianco 4px, nucleo accento 88px che diventa quadrato arrotondato 40px durante la registrazione.
- Pulsanti: altezza 36px, raggio 8px; primario quasi nero; icone disegnate a mano, tratto 1.75 (`components/Icon.jsx`).
- Elenchi in contenitore unico con divisori, non card separate. Stati vuoti con bordo tratteggiato.
- Stampa: cartellini QR A4 due per riga.

## Movimento
`cubic-bezier(.16,1,.3,1)`; una sola trasformazione significativa (pulsante cerchio→quadrato). `prefers-reduced-motion` rispettato.
