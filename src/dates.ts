// All dates are local calendar days encoded as "YYYY-MM-DD".

export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Current streak: consecutive completed days ending today.
 * If today isn't done yet, a streak ending yesterday is still alive.
 */
export function currentStreak(done: Set<string>, today: Date = new Date()): number {
  let cursor = done.has(dayKey(today)) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(dayKey(cursor))) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function bestStreak(done: Set<string>): number {
  let best = 0;
  for (const key of done) {
    // Only start counting at the first day of a run.
    if (done.has(dayKey(addDays(parseKey(key), -1)))) continue;
    let n = 0;
    let cursor = parseKey(key);
    while (done.has(dayKey(cursor))) {
      n++;
      cursor = addDays(cursor, 1);
    }
    best = Math.max(best, n);
  }
  return best;
}
