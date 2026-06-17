import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../firebase';

const MAX_SECONDS = 60;
const WAVEFORM_BARS = 60;

const STATES = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
};

function getSupportedMimeType() {
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

function getFileExtension(mimeType) {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'mp4';
  return 'webm';
}

export default function PublicView({ mostraTitle, mostraImage }) {
  const [status, setStatus] = useState(STATES.IDLE);
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS);
  const [waveform, setWaveform] = useState(Array(WAVEFORM_BARS).fill(2));
  const [progress, setProgress] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const startTimeRef = useRef(null);
  const mimeTypeRef = useRef('audio/webm');

  const stopAll = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  const drawWaveform = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const step = Math.floor(data.length / WAVEFORM_BARS);
    const bars = Array.from({ length: WAVEFORM_BARS }, (_, i) => {
      const avg = data.slice(i * step, (i + 1) * step).reduce((a, b) => a + b, 0) / step;
      return Math.max(2, (avg / 255) * 100);
    });
    setWaveform(bars);
    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  const processAndUpload = useCallback(async (chunks, mimeType) => {
    setStatus(STATES.PROCESSING);
    setProgress(20);
    try {
      const audioBlob = new Blob(chunks, { type: mimeType });
      setProgress(50);

      const ext = getFileExtension(mimeType);
      const timestamp = Date.now();
      const fileName = `vocali/${timestamp}.${ext}`;
      const storageRef = ref(storage, fileName);

      await uploadBytes(storageRef, audioBlob, { contentType: mimeType });
      setProgress(80);

      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'vocali'), {
        fileName,
        downloadURL,
        mimeType,
        createdAt: serverTimestamp(),
        size: audioBlob.size,
      });

      setProgress(100);
      setStatus(STATES.SUCCESS);
      setTimeout(() => {
        setStatus(STATES.IDLE);
        setSecondsLeft(MAX_SECONDS);
        setWaveform(Array(WAVEFORM_BARS).fill(2));
        setProgress(0);
      }, 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setStatus(STATES.ERROR);
      setTimeout(() => {
        setStatus(STATES.IDLE);
        setSecondsLeft(MAX_SECONDS);
        setProgress(0);
      }, 4000);
    }
  }, []);

  const stopRecording = useCallback(() => {
    stopAll();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, [stopAll]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      chunksRef.current = [];
      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType;

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        processAndUpload(chunksRef.current, mimeTypeRef.current);
      };

      mediaRecorder.start(100);
      startTimeRef.current = Date.now();
      setStatus(STATES.RECORDING);
      setSecondsLeft(MAX_SECONDS);
      drawWaveform();

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const left = MAX_SECONDS - elapsed;
        if (left <= 0) {
          clearInterval(timerRef.current);
          stopRecording();
        } else {
          setSecondsLeft(left);
        }
      }, 500);
    } catch (err) {
      console.error('Mic error:', err);
      setStatus(STATES.ERROR);
      setTimeout(() => setStatus(STATES.IDLE), 3000);
    }
  }, [drawWaveform, stopRecording, processAndUpload]);

  useEffect(() => () => stopAll(), [stopAll]);

  const isRecording = status === STATES.RECORDING;
  const isProcessing = status === STATES.PROCESSING;
  const isSuccess = status === STATES.SUCCESS;
  const isError = status === STATES.ERROR;
  const isIdle = status === STATES.IDLE;

  return (
    <div style={styles.container}>
      <div style={styles.imageWrap}>
        {mostraImage ? (
          <img src={mostraImage} alt={mostraTitle} style={styles.mostraImg} />
        ) : (
          <div style={styles.imagePlaceholder}>
            <span style={styles.placeholderTitle}>{mostraTitle || 'Mostra'}</span>
          </div>
        )}
      </div>

      <div style={styles.recordSection}>
        <div style={styles.waveformContainer}>
          {waveform.map((h, i) => (
            <div
              key={i}
              style={{
                ...styles.waveBar,
                height: `${h}%`,
                opacity: isRecording ? 1 : 0.2,
                background: isRecording
                  ? `hsl(${i * 3}, 80%, 55%)`
                  : '#888',
                transition: isRecording ? 'height 0.05s ease' : 'opacity 0.3s',
              }}
            />
          ))}
        </div>

        <div style={styles.timerRow}>
          {isRecording && (
            <>
              <div style={styles.recDot} />
              <span style={styles.timerText}>{secondsLeft}s</span>
            </>
          )}
          {isProcessing && (
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
            </div>
          )}
          {isSuccess && <span style={styles.successText}>✓ Grazie! Commento salvato.</span>}
          {isError && <span style={styles.errorText}>Errore. Riprova.</span>}
          {isIdle && <span style={styles.hintText}>Premi per lasciare un commento vocale</span>}
        </div>

        <button
          style={{
            ...styles.recButton,
            ...(isRecording ? styles.recButtonActive : {}),
            ...(isProcessing || isSuccess ? styles.recButtonDisabled : {}),
          }}
          onClick={isRecording ? stopRecording : isIdle ? startRecording : undefined}
          disabled={isProcessing || isSuccess || isError}
          aria-label={isRecording ? 'Ferma registrazione' : 'Inizia registrazione'}
        >
          {isRecording ? (
            <div style={styles.stopIcon} />
          ) : isProcessing ? (
            <div style={styles.spinner} />
          ) : isSuccess ? (
            <span style={styles.checkIcon}>✓</span>
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
              <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <line x1="8" y1="23" x2="16" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {isRecording && <p style={styles.tapToStop}>Tocca per fermare</p>}
      </div>
      <div style={styles.copyright}>© Martins Osemwengie</div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  imageWrap: {
    width: '100%',
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    maxHeight: '55vh',
  },
  mostraImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    minHeight: '40vh',
    background: '#1a1a1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitle: {
    color: '#666',
    fontSize: 28,
    fontWeight: 300,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  recordSection: {
    width: '100%',
    background: '#0a0a0a',
    padding: '24px 0 48px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
  },
  waveformContainer: {
    width: '90%',
    maxWidth: 420,
    height: 80,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  waveBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 2,
  },
  timerRow: {
    height: 32,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#e74c3c',
    animation: 'pulse 1s infinite',
  },
  timerText: {
    color: '#e74c3c',
    fontSize: 20,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'monospace',
  },
  progressBar: {
    width: 200,
    height: 4,
    background: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#e74c3c',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  successText: { color: '#2ecc71', fontSize: 16, fontWeight: 500 },
  errorText: { color: '#e74c3c', fontSize: 16 },
  hintText: { color: '#555', fontSize: 14, textAlign: 'center' },
  recButton: {
    width: 140,
    height: 140,
    borderRadius: '50%',
    background: '#e74c3c',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.1s, box-shadow 0.3s',
    WebkitTapHighlightColor: 'transparent',
    outline: 'none',
  },
  recButtonActive: {
    boxShadow: '0 0 0 20px rgba(231,76,60,0.15), 0 0 0 40px rgba(231,76,60,0.05)',
  },
  recButtonDisabled: {
    background: '#333',
    cursor: 'default',
  },
  stopIcon: {
    width: 40,
    height: 40,
    background: 'white',
    borderRadius: 6,
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid rgba(255,255,255,0.2)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  checkIcon: { color: 'white', fontSize: 56, lineHeight: 1 },
  tapToStop: { color: '#555', fontSize: 14, margin: 0 },
  copyright: { color: '#333', fontSize: 11, padding: '12px 0', textAlign: 'center', width: '100%', background: '#0a0a0a' },
};
