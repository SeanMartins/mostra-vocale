import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_SECONDS = 1.5;
export const PEAK_COUNT = 64;

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

// Riduce i livelli raccolti durante la registrazione a PEAK_COUNT valori 0–100.
export function downsample(levels, count = PEAK_COUNT) {
  if (!levels.length) return Array(count).fill(0);
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = Math.floor((i * levels.length) / count);
    const b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / count));
    let m = 0;
    for (let j = a; j < b; j++) m = Math.max(m, levels[j]);
    out.push(Math.round(m));
  }
  return out;
}

/**
 * Registrazione microfono con livelli live (per la forma d'onda) e limite di durata.
 * status: idle | starting | recording | denied | unsupported | error
 * onFinish({ blob, mimeType, duration, peaks }) | onTooShort()
 */
export function useRecorder({ maxSeconds = 60, onFinish, onTooShort }) {
  const [status, setStatus] = useState(() => (pickMimeType() === null || !navigator.mediaDevices ? 'unsupported' : 'idle'));
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState([]);

  const recRef = useRef(null);
  const streamRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const chunksRef = useRef([]);
  const levelsRef = useRef([]);
  const lastSampleRef = useRef(0);
  const cbRef = useRef({ onFinish, onTooShort });
  cbRef.current = { onFinish, onTooShort };

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (ctxRef.current && ctxRef.current.state !== 'closed') ctxRef.current.close();
    ctxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    if (status === 'recording' || status === 'starting') return;
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recRef.current = rec;
      chunksRef.current = [];
      levelsRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const duration = (performance.now() - startRef.current) / 1000;
        setStatus('idle');
        if (duration < MIN_SECONDS) {
          cbRef.current.onTooShort?.();
          return;
        }
        const type = rec.mimeType || mimeType || 'audio/webm';
        cbRef.current.onFinish?.({
          blob: new Blob(chunksRef.current, { type }),
          mimeType: type,
          duration,
          peaks: downsample(levelsRef.current),
        });
      };

      rec.start(250);
      startRef.current = performance.now();
      lastSampleRef.current = 0;
      setElapsed(0);
      setLevels([]);
      setStatus('recording');

      const tick = () => {
        const t = (performance.now() - startRef.current) / 1000;
        if (t - lastSampleRef.current >= 0.05) {
          lastSampleRef.current = t;
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          // scala percettiva: il parlato normale arriva a 40–80
          const level = Math.min(100, Math.max(2, Math.sqrt(rms) * 190));
          levelsRef.current.push(level);
          setLevels(levelsRef.current.slice(-160));
          setElapsed(t);
        }
        if (t >= maxSeconds) {
          stop();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      cleanup();
      const name = err && err.name;
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
    }
  }, [status, maxSeconds, stop, cleanup]);

  const reset = useCallback(() => {
    setStatus((s) => (s === 'unsupported' ? s : 'idle'));
    setElapsed(0);
    setLevels([]);
  }, []);

  useEffect(() => () => {
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.onstop = null;
      recRef.current.stop();
    }
    cleanup();
  }, [cleanup]);

  return { status, elapsed, levels, start, stop, reset };
}
