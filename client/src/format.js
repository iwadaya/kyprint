export function parseAppDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return new Date(`${value}T12:00:00`);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function splitDateTimeForForm(value) {
  const d = parseAppDate(value);
  if (!d) return { date: '', time: '' };
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function combineDateTimeForApi(date, time) {
  if (!date) return null;
  const t = time || '17:00';
  return `${date}T${t}:00`;
}

export function formatDate(value) {
  const d = parseAppDate(value);
  if (!d) return '—';
  const weekday = d.toLocaleDateString('en-ZA', { weekday: 'short' });
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-ZA', { month: 'short' });
  const hasTime = typeof value === 'string' && /T\d{2}:\d{2}/.test(value);
  if (!hasTime) return `${weekday} ${day} ${month}`;
  const time = d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${weekday} ${day} ${month} ${time}`;
}

export function isThisMonth(value) {
  const d = parseAppDate(value);
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function monthLabel() {
  return new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
}

export function monthFoot() {
  return monthLabel();
}
