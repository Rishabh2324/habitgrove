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

/** Whole calendar days from `a` to `b`. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((addDays(b, 0).getTime() - addDays(a, 0).getTime()) / 86400000);
}

export type Health = 'healthy' | 'fallen' | 'dead';

export interface StreakStatus {
  streak: number; // 0 once the tree is dead
  health: Health;
  lost: number; // the streak the tree had when it died (0 unless dead)
}

/**
 * Where a habit's tree stands today.
 * - Watered today or yesterday: healthy.
 * - One missed day: the tree falls over but the streak is kept. Watering today stands it back up.
 * - Two missed days in a row: the tree is destroyed and the streak is lost. The next watering starts a new seed.
 * A single missed day inside a run doesn't break it (the tree was only lying down), so streaks bridge it.
 */
export function streakStatus(done: Set<string>, today: Date = new Date()): StreakStatus {
  const todayKey = dayKey(today);
  let last: string | null = null;
  for (const k of done) if (k <= todayKey && (!last || k > last)) last = k;
  if (!last) return { streak: 0, health: 'healthy', lost: 0 };

  const lastDay = parseKey(last);
  let run = 0;
  let cursor = lastDay;
  while (done.has(dayKey(cursor))) {
    run++;
    const prev = addDays(cursor, -1);
    cursor = done.has(dayKey(prev)) ? prev : addDays(cursor, -2);
  }

  const missed = daysBetween(lastDay, today) - 1;
  if (missed >= 2) return { streak: 0, health: 'dead', lost: run };
  return { streak: run, health: missed === 1 ? 'fallen' : 'healthy', lost: 0 };
}

export function currentStreak(done: Set<string>, today: Date = new Date()): number {
  return streakStatus(done, today).streak;
}

export function bestStreak(done: Set<string>): number {
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of [...done].sort()) {
    const day = parseKey(key);
    run = prev && daysBetween(prev, day) <= 2 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}
