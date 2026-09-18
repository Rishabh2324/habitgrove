import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { addDays, dayKey } from './dates';
import type { SpeciesId } from './growth';

export interface Habit {
  id: string;
  name: string;
  species: SpeciesId;
  createdAt: string; // day key
  done: string[]; // completed day keys
  reminder?: Reminder | null; // daily nudge time, local
}

export interface Reminder {
  hour: number; // 0-23
  minute: number;
}

const KEY = 'habitgrove/habits/v1';

export function useHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setHabits(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((fn: (prev: Habit[]) => Habit[]) => {
    setHabits((prev) => {
      const next = fn(prev);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const plant = useCallback(
    (name: string, species: SpeciesId, priorDays = 0) => {
      // An existing streak carried in from elsewhere: the `priorDays` days ending yesterday, so today is still open to water.
      const now = new Date();
      const done = Array.from({ length: priorDays }, (_, i) => dayKey(addDays(now, i - priorDays)));
      const habit: Habit = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        name,
        species,
        createdAt: done[0] ?? dayKey(),
        done,
      };
      update((prev) => [...prev, habit]);
      return habit.id;
    },
    [update],
  );

  const toggleDay = useCallback(
    (id: string, key: string = dayKey()) =>
      update((prev) =>
        prev.map((h) =>
          h.id !== id
            ? h
            : { ...h, done: h.done.includes(key) ? h.done.filter((d) => d !== key) : [...h.done, key].sort() },
        ),
      ),
    [update],
  );

  const remove = useCallback((id: string) => update((prev) => prev.filter((h) => h.id !== id)), [update]);

  const setReminder = useCallback(
    (id: string, reminder: Reminder | null) => update((prev) => prev.map((h) => (h.id === id ? { ...h, reminder } : h))),
    [update],
  );

  return { habits, loaded, plant, toggleDay, remove, setReminder };
}
