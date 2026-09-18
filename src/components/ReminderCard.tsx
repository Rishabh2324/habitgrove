import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ensurePermission, formatTime, remindersSupported, remindersUnavailableReason } from '../reminders';
import type { Reminder } from '../store';
import { C } from '../theme';

const DEFAULT: Reminder = { hour: 18, minute: 30 };
const PRESETS: { emoji: string; label: string; time: Reminder }[] = [
  { emoji: '🌅', label: 'Morning', time: { hour: 8, minute: 0 } },
  { emoji: '☀️', label: 'Midday', time: { hour: 12, minute: 30 } },
  { emoji: '🌇', label: 'Evening', time: { hour: 18, minute: 30 } },
  { emoji: '🌙', label: 'Night', time: { hour: 21, minute: 0 } },
];

interface Props {
  reminder: Reminder | null | undefined;
  onChange: (reminder: Reminder | null) => void;
}

export function ReminderCard({ reminder, onChange }: Props) {
  const [denied, setDenied] = useState(false);
  const on = !!reminder;

  const toggle = async (next: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    if (!next) return onChange(null);
    const ok = await ensurePermission().catch(() => false);
    setDenied(!ok);
    if (ok) onChange(DEFAULT);
  };

  const set = (time: Reminder) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(time);
  };

  // Steps a component while keeping the other fixed; minutes move in 5s and wrap within the hour.
  const shift = (field: 'hour' | 'minute', delta: number) => {
    if (!reminder) return;
    if (field === 'hour') set({ ...reminder, hour: (reminder.hour + delta + 24) % 24 });
    else set({ ...reminder, minute: (Math.round(reminder.minute / 5) * 5 + delta + 60) % 60 });
  };

  const subtitle = !remindersSupported
    ? remindersUnavailableReason
    : on
      ? `Every day at ${formatTime(reminder)} · skipped once watered`
      : 'Get a nudge if you haven’t watered yet';

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={{ fontSize: 26 }}>🔔</Text>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.title}>Daily reminder</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
        </View>
        <Switch
          value={on}
          onValueChange={toggle}
          disabled={!remindersSupported}
          trackColor={{ true: C.green, false: '#DDD5C3' }}
          thumbColor="#fff"
          accessibilityLabel="Daily reminder"
        />
      </View>

      {denied && !on && (
        <Pressable onPress={() => Linking.openSettings().catch(() => {})} style={s.denied}>
          <Text style={s.deniedText}>Notifications are turned off for HabitGrove. Tap to open Settings.</Text>
        </Pressable>
      )}

      {on && (
        <>
          <View style={s.picker}>
            <Stepper value={String(reminder.hour % 12 || 12)} onMinus={() => shift('hour', -1)} onPlus={() => shift('hour', 1)} label="hour" />
            <Text style={s.colon}>:</Text>
            <Stepper value={String(reminder.minute).padStart(2, '0')} onMinus={() => shift('minute', -5)} onPlus={() => shift('minute', 5)} label="minutes" />
            <View style={s.ampm}>
              {(['AM', 'PM'] as const).map((p) => {
                const active = (reminder.hour >= 12) === (p === 'PM');
                return (
                  <Pressable
                    key={p}
                    onPress={() => !active && set({ ...reminder, hour: (reminder.hour + 12) % 24 })}
                    style={[s.ampmBtn, active && s.ampmOn]}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[s.ampmText, active && { color: '#fff' }]}>{p}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.presets}>
            {PRESETS.map((p) => {
              const active = p.time.hour === reminder.hour && p.time.minute === reminder.minute;
              return (
                <Pressable key={p.label} onPress={() => set(p.time)} style={[s.preset, active && s.presetOn]}>
                  <Text style={{ fontSize: 18 }}>{p.emoji}</Text>
                  <Text style={s.presetLabel}>{p.label}</Text>
                  <Text style={s.presetTime}>{formatTime(p.time)}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

function Stepper({ value, onMinus, onPlus, label }: { value: string; onMinus: () => void; onPlus: () => void; label: string }) {
  return (
    <View style={s.stepper}>
      <Pressable onPress={onPlus} hitSlop={6} style={s.stepBtn} accessibilityLabel={`Later ${label}`}>
        <Text style={s.stepText}>▲</Text>
      </Pressable>
      <Text style={s.stepValue}>{value}</Text>
      <Pressable onPress={onMinus} hitSlop={6} style={s.stepBtn} accessibilityLabel={`Earlier ${label}`}>
        <Text style={s.stepText}>▼</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, marginTop: 16, borderWidth: 1, borderColor: C.line },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: C.ink },
  subtitle: { fontSize: 13, color: C.inkSoft, marginTop: 2, lineHeight: 18 },
  denied: { marginTop: 12, backgroundColor: '#FBEAE7', borderRadius: 12, padding: 12 },
  deniedText: { color: C.danger, fontSize: 13, fontWeight: '700' },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6 },
  stepper: { alignItems: 'center' },
  stepBtn: { width: 56, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F1EBDD' },
  stepText: { fontSize: 12, color: C.inkSoft },
  stepValue: { fontSize: 40, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'], marginVertical: 4 },
  colon: { fontSize: 40, fontWeight: '800', color: C.ink, marginHorizontal: 2 },
  ampm: { marginLeft: 12, gap: 6 },
  ampmBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#F1EBDD' },
  ampmOn: { backgroundColor: C.green },
  ampmText: { fontWeight: '800', color: C.inkSoft, fontSize: 14 },
  presets: { flexDirection: 'row', gap: 8, marginTop: 16 },
  preset: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: '#F1EBDD', borderWidth: 2, borderColor: 'transparent' },
  presetOn: { backgroundColor: C.greenSoft, borderColor: C.green },
  presetLabel: { fontSize: 11, fontWeight: '800', color: C.ink, marginTop: 2 },
  presetTime: { fontSize: 10, color: C.inkSoft, marginTop: 1 },
});
