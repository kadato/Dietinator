export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** YAZIO API accepts `YYYY-MM-DD` without timezone shifting. */
export function toYazioApiDate(dateKey: string): string {
  return dateKey;
}

/** Match `YYYY-MM-DD` or `YYYY-MM-DD HH:mm:ss` from consumed-item payloads. */
export function matchesDateKey(itemDate: string | undefined, dateKey: string): boolean {
  if (!itemDate) return true;
  const head = itemDate.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) && head === dateKey;
}

export function toDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(dateKey: string): string {
  const today = toDateKey();
  if (dateKey === today) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === toDateKey(yesterday)) return 'Yesterday';

  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
