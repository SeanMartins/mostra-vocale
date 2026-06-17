// Salva direttamente in WebM/Opus - nessuna conversione necessaria
// I file sono riproducibili su tutti i browser moderni e scaricabili
export async function encodeToMp3(audioBuffer) {
  // Ricostruiamo il blob WebM dai dati audio grezzi
  // Questa funzione riceve audioBuffer ma noi passiamo già il blob raw
  // Vedi PublicView.jsx - ora passa direttamente rawBlob
  throw new Error('Use getRawBlob instead');
}

export function getAudioMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm';
}
