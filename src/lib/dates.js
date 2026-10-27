export function recDate(rec) {
  if (rec.recordedAt) return new Date(rec.recordedAt);
  if (rec.createdAt?.toDate) return rec.createdAt.toDate();
  return new Date();
}

export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dayLabel(d) {
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return 'Oggi';
  if (dayKey(d) === dayKey(yest)) return 'Ieri';
  const s = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const timeLabel = (d) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
